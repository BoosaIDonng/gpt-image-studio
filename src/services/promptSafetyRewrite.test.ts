import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanAssistantPromptRewrite,
  isProbablyLocalFallbackCopy,
  rewritePromptWithAssistant,
} from "./promptSafetyRewrite";

const mocks = vi.hoisted(() => ({
  streamChatReply: vi.fn(),
}));

vi.mock("./floatingChatService", () => ({
  streamChatReply: mocks.streamChatReply,
}));

describe("rewritePromptWithAssistant", () => {
  beforeEach(() => {
    mocks.streamChatReply.mockReset();
  });

  it("asks the AI assistant to rewrite a failed prompt with error and risk context", async () => {
    mocks.streamChatReply.mockResolvedValue(
      "```text\nfully clothed girl sitting on a chair, cinematic rain street, neon reflection\n```",
    );

    const rewritten = await rewritePromptWithAssistant({
      prompt: "nsfw, completely nude, girl sitting on chair, cinematic rain street",
      errorMessage: "HTTP 403: forbidden by content policy",
      fallbackPrompt: "fully clothed, girl sitting on chair, cinematic rain street",
      riskMatches: [
        { term: "nsfw", replacement: "tasteful editorial style" },
        { term: "completely nude", replacement: "fully clothed" },
      ],
    });

    expect(rewritten).toBe(
      "fully clothed girl sitting on a chair, cinematic rain street, neon reflection",
    );
    expect(mocks.streamChatReply).toHaveBeenCalledWith(
      [
        {
          role: "system",
          content: expect.stringContaining("prompt rewriting"),
        },
        {
          role: "user",
          content: expect.stringContaining("HTTP 403"),
        },
      ],
      expect.any(Function),
      undefined,
      { useBuiltinPersona: false },
    );
    expect(mocks.streamChatReply.mock.calls[0][0][1].content).toContain(
      "nsfw, completely nude",
    );
    expect(mocks.streamChatReply.mock.calls[0][0][1].content).toContain(
      "nsfw -> tasteful editorial style",
    );
  });

  it("retries when the assistant copies the local fallback prompt", async () => {
    const fallbackPrompt =
      "fully clothed, girl sitting on chair, cinematic rain street, safe for work";
    const improvedPrompt =
      "fully clothed woman sitting on a chair in a cinematic rain street, neon reflections, modest fashion styling";
    mocks.streamChatReply
      .mockResolvedValueOnce(fallbackPrompt)
      .mockResolvedValueOnce(improvedPrompt);

    const rewritten = await rewritePromptWithAssistant({
      prompt: "nsfw, completely nude, girl sitting on chair, cinematic rain street",
      errorMessage: "HTTP 403: forbidden by content policy",
      fallbackPrompt,
      riskMatches: [
        { term: "nsfw", replacement: "tasteful editorial style" },
        { term: "completely nude", replacement: "fully clothed" },
      ],
    });

    expect(rewritten).toBe(improvedPrompt);
    expect(mocks.streamChatReply).toHaveBeenCalledTimes(2);
    expect(mocks.streamChatReply.mock.calls[0][3]).toEqual({
      useBuiltinPersona: false,
    });
    expect(mocks.streamChatReply.mock.calls[1][3]).toEqual({
      useBuiltinPersona: false,
    });
    expect(mocks.streamChatReply.mock.calls[0][0][0]).toEqual({
      role: "system",
      content: expect.stringContaining("prompt rewriting"),
    });
    expect(mocks.streamChatReply.mock.calls[0][0][1].content).not.toContain(
      `Local fallback prompt:\n${fallbackPrompt}`,
    );
    expect(mocks.streamChatReply.mock.calls[1][0].at(-1)?.content).toContain(
      "copied the local fallback",
    );
  });
});

describe("cleanAssistantPromptRewrite", () => {
  it("removes common answer wrappers while keeping the prompt text", () => {
    expect(
      cleanAssistantPromptRewrite(
        'Here is the rewritten prompt:\n"fully clothed portrait, cinematic light"',
      ),
    ).toBe("fully clothed portrait, cinematic light");
  });
});

describe("isProbablyLocalFallbackCopy", () => {
  it("detects fallback copies even when the assistant drops one safety tag", () => {
    expect(
      isProbablyLocalFallbackCopy(
        "non-explicit portrait, fully clothed, tasteful editorial",
        "non-explicit portrait, fully clothed, tasteful editorial, safe for work",
      ),
    ).toBe(true);
  });

  it("allows rewritten prompts with preserved visual details", () => {
    expect(
      isProbablyLocalFallbackCopy(
        "fully clothed portrait in soft window light, neutral studio background",
        "fully clothed, non-explicit, tasteful editorial, safe for work",
      ),
    ).toBe(false);
  });
});
