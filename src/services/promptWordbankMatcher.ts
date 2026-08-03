import type { PromptMode, PromptWordbanks } from "../types/studio";
import { hashString } from "../shared/hash";
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
    triggers: ["躺", "躺着", "床", "lying", "lie", "bed"],
    terms: ["lying", "lying on back", "on stomach", "Lie on your side"],
    conflictGroup: "lying",
  },
  {
    id: "on-stomach",
    triggers: ["趴", "趴着", "俯卧", "on stomach"],
    terms: ["on stomach"],
    conflictGroup: "lying",
  },
  {
    id: "kneel",
    triggers: ["跪", "跪姿", "跪坐", "kneel", "wariza"],
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
    id: "squatting",
    triggers: ["蹲", "蹲着", "蹲下", "squat", "squatting"],
    terms: ["squatting"],
    conflictGroup: "squatting",
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
  {
    id: "looking-back",
    triggers: ["回头", "转身", "over shoulder", "looking back"],
    terms: ["looking over shoulder"],
  },
  {
    id: "bent-over",
    triggers: ["弯腰", "俯身", "bent over"],
    terms: ["bent over"],
  },
];

const CONFLICT_GROUP_TERMS: Record<string, string[]> = {
  sitting: ["sitting", "chair", "figure four sitting"],
  standing: ["standing", "standing split"],
  lying: ["lying", "lie on", "on stomach", "prostrate", "fetal position"],
  kneel: ["kneel", "wariza", "all fours"],
  walking: ["walk"],
  squatting: ["squat"],
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

  const targetCount = targetTermCount(input.mode);
  const allMatchedTerms = availableTerms.filter(
    (term) =>
      selectedRules.some((rule) => ruleMatchesTerm(rule, term)) ||
      promptKey.includes(normalizeForMatch(term)),
  );
  const matchedTerms = allMatchedTerms.slice(0, targetCount);
  const fallbackTerms = pickDeterministic(
    availableTerms.filter((term) => !allMatchedTerms.includes(term)),
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
function candidatesForMode(mode: PromptWordbankMatchMode, wordbanks: PromptWordbanks) {
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

function blockingReason(term: string, selectedConflictGroups: Set<string>, safeIntent: boolean) {
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
  return rule.terms.some((ruleTerm) => normalizedTerm.includes(normalizeForMatch(ruleTerm)));
}

function hasSafeIntent(promptKey: string) {
  return SAFE_INTENT_PATTERNS.some((pattern) => promptKey.includes(normalizeForMatch(pattern)));
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
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
