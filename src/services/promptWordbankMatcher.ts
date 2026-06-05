import type { PromptMode, PromptWordbanks } from "../types/studio";
import { promptWordbanks as defaultPromptWordbanks } from "./promptWordbanks";

type PromptWordbankMatchMode = Exclude<PromptMode, "default">;

export type PromptWordbankMatchInput = {
  prompt: string;
  mode: PromptWordbankMatchMode;
  seed?: string;
  wordbanks?: PromptWordbanks;
};

export type PromptWordbankMatchResult = {
  terms: string[];
  matchedTerms: string[];
  fallbackTerms: string[];
  blockedTerms: string[];
  debug: {
    matchedTriggers: string[];
    conflicts: string[];
    source: "wordbank-match";
  };
};

type TriggerRule = {
  id: string;
  triggers: string[];
  terms: string[];
  conflictGroup?: string;
};

const TRIGGER_RULES: TriggerRule[] = [
  {
    id: "sitting",
    triggers: ["坐", "坐着", "椅子", "chair", "sitting", "seat"],
    terms: ["sitting on chair", "sitting", "sitting on the ground", "sitting on bed"],
    conflictGroup: "sitting",
  },
  {
    id: "standing",
    triggers: ["站", "站立", "全身", "standing", "stand"],
    terms: ["standing"],
    conflictGroup: "standing",
  },
  {
    id: "lying",
    triggers: ["躺", "躺着", "床", "lying", "lie", "bed", "on stomach"],
    terms: ["lying", "lying on back", "lying on bed", "on stomach", "lie on your side"],
    conflictGroup: "lying",
  },
  {
    id: "kneel",
    triggers: ["跪", "跪姿", "kneel", "wariza"],
    terms: ["kneel", "wariza"],
    conflictGroup: "kneel",
  },
  {
    id: "walking",
    triggers: ["走", "行走", "步行", "walk", "walking"],
    terms: ["walk"],
    conflictGroup: "walking",
  },
  {
    id: "window-light",
    triggers: ["窗", "窗边", "window"],
    terms: ["soft window light"],
  },
  {
    id: "rain-street",
    triggers: ["雨", "雨夜", "街头", "rain", "street"],
    terms: ["cinematic rain street"],
  },
  {
    id: "selfie",
    triggers: ["自拍", "selfie"],
    terms: ["selfie"],
  },
  {
    id: "yoga",
    triggers: ["瑜伽", "yoga"],
    terms: ["yoga"],
  },
  {
    id: "hair",
    triggers: ["头发", "发型", "hair"],
    terms: ["hands in hair", "adjusting hair", "tying hair"],
  },
];

const CONFLICT_GROUP_TERMS: Record<string, string[]> = {
  sitting: ["sitting", "chair", "bed", "figure four sitting"],
  standing: ["standing", "walk", "standing split"],
  lying: ["lying", "lie ", "on stomach", "prostrate", "fetal position"],
  kneel: ["kneel", "wariza", "all fours"],
  walking: ["walk"],
};

const SAFE_INTENT_PATTERNS = [
  "不要裸露",
  "无裸露",
  "不能裸露",
  "不要色情",
  "非色情",
  "安全",
  "not nude",
  "no nude",
  "no nudity",
  "non nude",
  "sfw",
  "safe for work",
  "non explicit",
  "no nsfw",
];

const UNSAFE_TERM_PATTERNS = [
  "nsfw",
  "nude",
  "naked",
  "topless",
  "bottomless",
  "explicit",
  "uncensored",
  "nipples",
  "pussy",
  "ahegao",
  "areola",
  "breast",
  "cleavage",
  "groin",
  "cameltoe",
  "ass",
  "groping",
  "bondage",
  "shibari",
  "spread legs",
  "open your legs",
  "doggy",
  "missionary",
  "handjob",
  "glory hole",
  "vibrator",
];

export function matchPromptWordbankTerms(
  input: PromptWordbankMatchInput,
): PromptWordbankMatchResult {
  const wordbanks = input.wordbanks ?? defaultPromptWordbanks;
  const prompt = input.prompt;
  const promptKey = normalizeForMatch(prompt);
  const selectedRules = TRIGGER_RULES.filter((rule) =>
    rule.triggers.some((trigger) => promptKey.includes(normalizeForMatch(trigger))),
  );
  const selectedConflictGroups = new Set(
    selectedRules.flatMap((rule) => (rule.conflictGroup ? [rule.conflictGroup] : [])),
  );
  const safeIntent = input.mode === "safe" || hasSafeIntent(promptKey);
  const candidates = candidatesForMode(input.mode, wordbanks);
  const blockedTerms: string[] = [];
  const conflicts: string[] = [];

  const availableTerms = candidates.filter((term) => {
    const conflict = blockingReason(term, selectedConflictGroups, safeIntent);
    if (!conflict) return true;
    pushUnique(blockedTerms, term);
    pushUnique(conflicts, conflict);
    return false;
  });

  const matchedTerms = availableTerms.filter((term) =>
    selectedRules.some((rule) => ruleMatchesTerm(rule, term)) ||
    promptKey.includes(normalizeForMatch(term)),
  );
  const targetCount = targetTermCount(input.mode);
  const fallbackTerms = pickDeterministic(
    availableTerms.filter((term) => !matchedTerms.includes(term)),
    Math.max(0, targetCount - matchedTerms.length),
    `${input.seed ?? input.prompt}:wordbank-match`,
  );

  return {
    terms: [...matchedTerms, ...fallbackTerms].slice(0, targetCount),
    matchedTerms,
    fallbackTerms,
    blockedTerms,
    debug: {
      matchedTriggers: selectedRules.map((rule) => rule.id),
      conflicts,
      source: "wordbank-match",
    },
  };
}

function candidatesForMode(
  mode: PromptWordbankMatchMode,
  wordbanks: PromptWordbanks,
) {
  if (mode === "safe") return uniqueTerms(wordbanks.pose.safe);
  if (mode === "creative") {
    return uniqueTerms([...wordbanks.pose.safe, ...wordbanks.pose.creative]);
  }
  return uniqueTerms([
    ...wordbanks.pose.safe,
    ...wordbanks.pose.creative,
    ...wordbanks.pose.nsfw,
    ...wordbanks.adultInspiration,
  ]);
}

function targetTermCount(mode: PromptWordbankMatchMode) {
  if (mode === "safe") return 2;
  if (mode === "creative") return 3;
  return 5;
}

function blockingReason(
  term: string,
  selectedConflictGroups: Set<string>,
  safeIntent: boolean,
) {
  const normalizedTerm = normalizeForMatch(term);
  if (safeIntent && UNSAFE_TERM_PATTERNS.some((pattern) => normalizedTerm.includes(pattern))) {
    return "safe-intent";
  }

  if (!selectedConflictGroups.size) return "";

  for (const [group, patterns] of Object.entries(CONFLICT_GROUP_TERMS)) {
    if (selectedConflictGroups.has(group)) continue;
    if (patterns.some((pattern) => normalizedTerm.includes(pattern))) {
      return `conflict:${group}`;
    }
  }

  return "";
}

function ruleMatchesTerm(rule: TriggerRule, term: string) {
  const normalizedTerm = normalizeForMatch(term);
  return rule.terms.some((ruleTerm) =>
    normalizedTerm.includes(normalizeForMatch(ruleTerm)),
  );
}

function hasSafeIntent(promptKey: string) {
  return SAFE_INTENT_PATTERNS.some((pattern) =>
    promptKey.includes(normalizeForMatch(pattern)),
  );
}

function uniqueTerms(terms: readonly string[]) {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = normalizeForMatch(term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushUnique(items: string[], item: string) {
  if (!items.includes(item)) items.push(item);
}

function pickDeterministic(items: readonly string[], count: number, seed: string) {
  if (!items.length || count <= 0) return [];

  const scored = items.map((item, index) => ({
    item,
    score: hashString(`${seed}:${item}:${index}`),
  }));

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.min(count, items.length))
    .map(({ item }) => item);
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}
