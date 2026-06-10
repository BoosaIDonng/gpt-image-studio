export type ModerationAdvice = {
  isModerationRejection: boolean;
  reasons: string[];
  riskMatches: PromptRiskMatch[];
  saferPrompt?: string;
};

export type PromptRiskMatch = {
  term: string;
  replacement: string;
};

type RiskRule = {
  reason: string;
  patterns: RegExp[];
};

const MODERATION_ERROR_PATTERNS = [
  /generated image rejected by content moderation/i,
  /content moderation/i,
  /moderation/i,
  /safety system/i,
  /policy/i,
  /内容审核/,
  /安全策略/,
];

const RISK_RULES: RiskRule[] = [
  {
    reason: "提示词可能包含裸露、露骨身体部位或成人化词汇。",
    patterns: [
      /\bnsfw\b/i,
      /\bnude\b/i,
      /\bnaked\b/i,
      /\btopless\b/i,
      /\bbottomless\b/i,
      /\bnipples?\b/i,
      /\bareolae?\b/i,
      /\bpussy\b/i,
      /\bexplicit\b/i,
      /裸露|全裸|色情|露骨/,
    ],
  },
  {
    reason: "提示词可能包含过强的性暗示姿势或身体接触描述。",
    patterns: [
      /spread legs/i,
      /doggy/i,
      /missionary/i,
      /girl on top/i,
      /groping/i,
      /handjob/i,
      /ahegao/i,
      /cameltoe/i,
      /性暗示|挑逗|抚摸/,
    ],
  },
  {
    reason: "提示词可能把年轻主体和成人化表达放在一起，容易触发高风险审核。",
    patterns: [
      /\bminor\b/i,
      /\bteen\b/i,
      /\bloli\b/i,
      /\bschoolgirl\b/i,
      /未成年|少女|萝莉|学生妹/,
    ],
  },
  {
    reason: "提示词可能包含血腥、暴力或伤害性元素。",
    patterns: [
      /\bblood\b/i,
      /\bgore\b/i,
      /\bwound\b/i,
      /\bviolence\b/i,
      /血腥|流血|伤口|暴力/,
    ],
  },
];

const PROMPT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnsfw\b/gi, "tasteful editorial style"],
  [/\bextremely explicit\b/gi, "non-explicit"],
  [/\bexplicit\b/gi, "non-explicit"],
  [/\bcompletely nude\b/gi, "fully clothed"],
  [/\bnude\b/gi, "fully clothed"],
  [/\bnaked\b/gi, "fully clothed"],
  [/\btopless\b/gi, "modest fashion styling"],
  [/\bbottomless\b/gi, "modest fashion styling"],
  [/\bdetailed nipples?\b/gi, "elegant silhouette"],
  [/\bnipples?\b/gi, "elegant silhouette"],
  [/\bareolae?\b/gi, "natural fabric detail"],
  [/\bpussy\b/gi, "tasteful pose"],
  [/\bahegao\b/gi, "soft expressive eyes"],
  [/\bgroping\b/gi, "relaxed hand pose"],
  [/\bspread legs\b/gi, "balanced seated pose"],
  [/\bopen your legs wide\b/gi, "natural seated pose"],
  [/\bdoggy pose\b/gi, "dynamic pose"],
  [/\bdoggystyle\b/gi, "dynamic pose"],
  [/\bmissionary position\b/gi, "cinematic portrait pose"],
  [/\bhandjob gesture\b/gi, "subtle hand gesture"],
  [/\bcameltoe\b/gi, "smooth fabric fit"],
  [/全裸|裸露/g, "完整着装"],
  [/色情|露骨/g, "非露骨"],
  [/血腥|流血/g, "无血腥"],
];

export function analyzeModerationRejection(
  errorMessage: string,
  prompt = "",
): ModerationAdvice {
  const isModerationRejection = MODERATION_ERROR_PATTERNS.some((pattern) =>
    pattern.test(errorMessage),
  );
  if (!isModerationRejection) {
    return {
      isModerationRejection: false,
      reasons: [],
      riskMatches: [],
    };
  }

  const riskMatches = findPromptRiskMatches(prompt);
  const reasons = [
    "接口内容审核拒绝了这次图片生成请求。",
    ...RISK_RULES.filter((rule) =>
      rule.patterns.some((pattern) => pattern.test(prompt)),
    ).map((rule) => rule.reason),
  ];

  if (reasons.length === 1) {
    reasons.push("具体命中项不会由接口完整返回，通常需要从提示词里的裸露、性暗示、血腥暴力或敏感主体组合排查。");
  }

  return {
    isModerationRejection: true,
    reasons,
    riskMatches,
    saferPrompt: prompt ? buildSaferPrompt(prompt) : undefined,
  };
}

export function formatModerationAdvice(advice: ModerationAdvice) {
  if (!advice.isModerationRejection) return "";

  const lines = [
    "可能触发内容审核的原因：",
    ...advice.reasons.map((reason) => `- ${reason}`),
  ];

  if (advice.riskMatches.length) {
    lines.push(
      "命中风险词：",
      ...advice.riskMatches.map(
        (match) => `- ${match.term} -> ${match.replacement}`,
      ),
    );
  }

  if (advice.saferPrompt) {
    lines.push(
      "建议改写：保留主体、构图、镜头、光影和氛围，移除露骨或高风险表达。",
      advice.saferPrompt,
    );
  }

  return lines.join("\n");
}

function findPromptRiskMatches(prompt: string): PromptRiskMatch[] {
  const usedRanges: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();
  const matches: PromptRiskMatch[] = [];

  PROMPT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    const globalPattern = toGlobalRegExp(pattern);
    Array.from(prompt.matchAll(globalPattern)).forEach((match) => {
      const term = match[0]?.trim();
      if (!term) return;

      const start = match.index ?? -1;
      const end = start + match[0].length;
      if (start < 0 || overlapsUsedRange(start, end, usedRanges)) return;

      const key = `${term.toLowerCase()}->${replacement.toLowerCase()}`;
      if (seen.has(key)) return;

      seen.add(key);
      usedRanges.push({ start, end });
      matches.push({ term, replacement });
    });
  });

  return matches;
}

function toGlobalRegExp(pattern: RegExp) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function overlapsUsedRange(
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>,
) {
  return ranges.some((range) => start < range.end && end > range.start);
}

function buildSaferPrompt(prompt: string) {
  let saferPrompt = prompt;
  PROMPT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    saferPrompt = saferPrompt.replace(pattern, replacement);
  });

  saferPrompt = saferPrompt
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, parts) => {
      const key = part.toLowerCase();
      return parts.findIndex((candidate) => candidate.toLowerCase() === key) === index;
    })
    .join(", ");

  return [
    saferPrompt,
    "fully clothed, non-explicit, tasteful editorial, safe for work, 非露骨",
  ].filter(Boolean).join(", ");
}
