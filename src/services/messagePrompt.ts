import type { Message } from "../types/studio";
import { buildFinalRequestPrompt } from "./promptRequest";

export function finalPromptFromMessage(message: Message) {
  const settings = message.promptRequestSettings;
  if (!settings) return message.content;

  return buildFinalRequestPrompt({
    prompt: message.content,
    promptMode: settings.promptMode,
    promptWordbanks: settings.promptWordbanks,
    promptRewriteGuardEnabled: settings.promptRewriteGuardEnabled,
    promptRewriteGuardText: settings.promptRewriteGuardText,
    ragContext: settings.ragContext,
  });
}
