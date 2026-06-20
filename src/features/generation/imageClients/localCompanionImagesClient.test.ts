import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationParams } from "../../../types/studio";
import { PROMPT_REWRITE_GUARD_PREFIX } from "../../../services/imagesApi";
import { defaultPromptWordbanks } from "../../../services/promptWordbanks";
import { createLocalCompanionImagesClient } from "./localCompanionImagesClient";

const generationParams: GenerationParams = {
  size: "1:1",
  resolution: "1k",
  width: 1024,
  height: 1024,
  imageCount: 1,
  quality: "auto",
  background: "auto",
  outputFormat: "png",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local companion image client", () => {
  it("sends Gemini generation through Companion with the final request prompt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ b64_json: "gemini-image", mime_type: "image/png" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = createLocalCompanionImagesClient({
      getCompanionUrl: () => "http://127.0.0.1:19750",
      getSessionToken: () => "session-token",
      getApiProvider: () => "gemini",
      getModel: () => "gemini-3.1-flash-image-preview",
    });

    expect(client.canGenerateBatch?.()).toBe(false);
    const result = await client.generate({
      prompt: "画一张图",
      params: generationParams,
      promptRequestSettings: {
        promptMode: "creative",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: true,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:19750/images/generations");
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe("gemini-3.1-flash-image-preview");
    expect(body.prompt).toContain("当前模式：创意");
    expect(body.gemini).toEqual({
      aspectRatio: "1:1",
      imageSize: "1K",
    });
    expect(result).toEqual({
      b64Json: "gemini-image",
      requestPrompt: body.prompt,
      revisedPrompt: undefined,
      mimeType: "image/png",
    });
  });

  it("adds RAG context before sending the final prompt through Companion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ b64_json: "grok-image" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = createLocalCompanionImagesClient({
      getCompanionUrl: () => "http://127.0.0.1:19750",
      getSessionToken: () => "session-token",
      getApiProvider: () => "grok",
      getModel: () => "grok-imagine-image-quality",
    });

    const result = await client.generate({
      prompt: "画一张雨夜街景",
      params: generationParams,
      promptRequestSettings: {
        promptMode: "default",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: false,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
        ragContext: "RAG 参考内容：\n1. cinematic rain street",
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.prompt).toContain("RAG 参考内容：");
    expect(body.prompt).toContain("用户原始提示词：\n画一张雨夜街景");
    expect(result.requestPrompt).toBe(body.prompt);
  });
});
