import { streamChatReply, type ChatMessage } from "./floatingChatService";
import type { PromptRiskMatch } from "./moderationAdvice";

export type PromptSafetyRewriteInput = {
  prompt: string;
  errorMessage: string;
  fallbackPrompt?: string;
  riskMatches?: PromptRiskMatch[];
};

export async function rewritePromptWithAssistant(input: PromptSafetyRewriteInput) {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a prompt rewriting tool for AI image generation. Output only the rewritten prompt.",
    },
    {
      role: "user",
      content: buildSafetyRewritePrompt(input, false),
    },
  ];
  const response = await streamChatReply(messages, () => undefined, undefined, {
    useBuiltinPersona: false,
  });
  const cleaned = cleanAssistantPromptRewrite(response);
  if (!isProbablyLocalFallbackCopy(cleaned, input.fallbackPrompt)) {
    return cleaned;
  }

  const retryMessages: ChatMessage[] = [
    ...messages,
    { role: "assistant", content: cleaned },
    {
      role: "user",
      content: buildFallbackCopyRetryPrompt(input),
    },
  ];
  const retryResponse = await streamChatReply(retryMessages, () => undefined, undefined, {
    useBuiltinPersona: false,
  });
  return cleanAssistantPromptRewrite(retryResponse);
}

export function cleanAssistantPromptRewrite(text: string) {
  return text
    .trim()
    .replace(/^```(?:text|prompt|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^here(?:'| i)?s the rewritten prompt:\s*/i, "")
    .replace(/^rewritten prompt:\s*/i, "")
    .replace(/^prompt:\s*/i, "")
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
}

export function isProbablyLocalFallbackCopy(text: string, fallback?: string) {
  if (!text.trim() || !fallback?.trim()) return false;

  const textTerms = normalizedTermSet(text);
  const fallbackTerms = normalizedTermSet(fallback);
  if (textTerms.size === 0 || fallbackTerms.size === 0) return false;

  let shared = 0;
  textTerms.forEach((term) => {
    if (fallbackTerms.has(term)) shared += 1;
  });
  const textCoverage = shared / textTerms.size;
  const fallbackCoverage = shared / fallbackTerms.size;
  return textCoverage >= 0.8 && fallbackCoverage >= 0.55;
}

function buildSafetyRewritePrompt(input: PromptSafetyRewriteInput, includeFallbackPrompt: boolean) {
  const riskLines = input.riskMatches?.length
    ? input.riskMatches.map((match) => `- ${match.term} -> ${match.replacement}`).join("\n")
    : "- No explicit local risk terms were detected.";
  const fallbackInstruction = input.fallbackPrompt?.trim()
    ? [
        "Local safety baseline:",
        includeFallbackPrompt
          ? input.fallbackPrompt.trim()
          : "Use the listed safe replacements as constraints, but do not copy the local fallback wording.",
      ]
    : [];

  return [
    "You are helping rewrite an AI image generation prompt after a failed request.",
    "Return ONLY one rewritten prompt. No explanation, no markdown, no quotes.",
    "Keep the subject, composition, camera framing, lighting, mood, style, and important scene details.",
    "Reduce policy risk for image generation. Prefer natural visual language instead of mechanical word swaps or tag lists.",
    "Do not add new people, new explicit details, or unrelated themes.",
    "",
    "Original prompt:",
    input.prompt,
    "",
    "Generation error:",
    input.errorMessage,
    "",
    "Local risk replacements:",
    riskLines,
    "",
    ...fallbackInstruction,
  ].join("\n");
}

function buildFallbackCopyRetryPrompt(input: PromptSafetyRewriteInput) {
  return [
    "Your previous answer copied the local fallback instead of rewriting the original prompt.",
    "Rewrite again as one natural image prompt.",
    "Preserve concrete visual details from the original prompt after removing or softening risky words.",
    "Do not output a plain safety tag list.",
    "",
    "Original prompt:",
    input.prompt,
  ].join("\n");
}

function normalizedTermSet(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  return new Set(
    normalized
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3),
  );
}
