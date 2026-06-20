import { describe, expect, it } from "vitest";
import { defaultPromptWordbanks } from "./promptWordbanks";
import type { Message, PromptRequestSettings } from "../types/studio";
import { finalPromptFromMessage } from "./messagePrompt";

describe("finalPromptFromMessage", () => {
  it("returns the message content when no prompt request settings were captured", () => {
    expect(finalPromptFromMessage(message({ content: "raw rain street prompt" }))).toBe(
      "raw rain street prompt",
    );
  });

  it("rebuilds the final request prompt from the message prompt settings", () => {
    const prompt = finalPromptFromMessage(
      message({
        content: "rain street portrait",
        promptRequestSettings: {
          promptMode: "default",
          promptWordbanks: defaultPromptWordbanks,
          promptRewriteGuardEnabled: true,
          promptRewriteGuardText: "Use exactly:",
          ragContext: "Reference:\ncinematic neon reflection",
        },
      }),
    );

    expect(prompt).toBe(
      [
        "Use exactly:",
        "Reference:",
        "cinematic neon reflection",
        "",
        "用户原始提示词：",
        "rain street portrait",
      ].join("\n"),
    );
  });
});

function message(input: {
  content: string;
  promptRequestSettings?: PromptRequestSettings;
}): Message {
  return {
    id: "m1",
    conversationId: "c1",
    role: "user",
    content: input.content,
    referencedImageIds: [],
    resultImageIds: [],
    status: "success",
    createdAt: "2026-06-08T00:00:00.000Z",
    promptRequestSettings: input.promptRequestSettings,
  };
}
