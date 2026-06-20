import type { PromptMode, PromptRequestSettings, PromptWordbanks } from "../types/studio";
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

export function applyPromptRewriteGuard(prompt: string, enabled: boolean, guardText?: string) {
  if (!enabled) return prompt;
  const normalizedGuardText = normalizePromptRewriteGuardText(guardText);
  if (prompt.startsWith(`${normalizedGuardText}\n`)) return prompt;
  return `${normalizedGuardText}\n${prompt}`;
}

export function buildFinalRequestPrompt(input: BuildFinalRequestPromptInput) {
  const sourcePrompt = input.ragContext?.trim()
    ? [input.ragContext.trim(), "", "用户原始提示词：", input.prompt].join("\n")
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

/**
 * 基于「用户输入 + 提示词请求设置」一次性构造最终请求 prompt。
 *
 * 之前该 7 字段解构在 Grok/Gemini/companion 等多个客户端的
 * generate/edit/generateBatch 路径里逐字复制了 12 遍，现收敛到此处。
 */
export function buildPromptRequest(input: {
  prompt: string;
  promptRequestSettings: PromptRequestSettings;
}) {
  return buildFinalRequestPrompt({
    prompt: input.prompt,
    promptMode: input.promptRequestSettings.promptMode,
    promptWordbanks: input.promptRequestSettings.promptWordbanks,
    promptRewriteGuardEnabled: input.promptRequestSettings.promptRewriteGuardEnabled,
    promptRewriteGuardText: input.promptRequestSettings.promptRewriteGuardText,
    ragContext: input.promptRequestSettings.ragContext,
  });
}
