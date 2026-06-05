import type { PromptMode, PromptWordbanks } from "../types/studio";
import { buildImagePrompt } from "./promptBuilder";

export type BuildFinalRequestPromptInput = {
  prompt: string;
  promptMode?: PromptMode;
  promptWordbanks?: PromptWordbanks;
  promptRewriteGuardEnabled?: boolean;
  promptRewriteGuardText?: string;
  ragContext?: string;
  seed?: string;
};

export const PROMPT_REWRITE_GUARD_PREFIX =
  "Use the following text as the complete prompt. Do not rewrite it:";

export function normalizePromptRewriteGuardText(text?: string) {
  const normalized = text?.trim();
  return normalized || PROMPT_REWRITE_GUARD_PREFIX;
}

export function applyPromptRewriteGuard(
  prompt: string,
  enabled: boolean,
  guardText?: string,
) {
  if (!enabled) return prompt;
  const normalizedGuardText = normalizePromptRewriteGuardText(guardText);
  if (prompt.startsWith(`${normalizedGuardText}\n`)) return prompt;
  return `${normalizedGuardText}\n${prompt}`;
}

export function buildFinalRequestPrompt(input: BuildFinalRequestPromptInput) {
  const sourcePrompt = input.ragContext?.trim()
    ? [
        input.ragContext.trim(),
        "",
        "用户原始提示词：",
        input.prompt,
      ].join("\n")
    : input.prompt;
  const modePrompt = buildImagePrompt({
    prompt: sourcePrompt,
    mode: input.promptMode ?? "default",
    seed: input.seed,
    wordbanks: input.promptWordbanks,
  });

  return applyPromptRewriteGuard(
    modePrompt,
    input.promptRewriteGuardEnabled ?? false,
    input.promptRewriteGuardText,
  );
}
