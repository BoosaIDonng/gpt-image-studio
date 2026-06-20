import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationParams } from "../../../types/studio";
import { PROMPT_REWRITE_GUARD_PREFIX } from "../../../services/imagesApi";
import { defaultPromptWordbanks } from "../../../services/promptWordbanks";
import { createDirectImagesClient } from "./directImagesClient";

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

describe("direct image client", () => {
  it("applies prompt mode and rewrite guard before calling Grok", async () => {
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
    const client = createDirectImagesClient({
      getApiProvider: () => "grok",
      getApiBaseUrl: () => "https://api.x.ai/v1",
      getApiBaseUrlMode: () => "full",
      getApiMode: () => "images",
      getApiKey: () => "xai-test",
      getModel: () => "grok-imagine-image-quality",
      getStreamImages: () => false,
      getStreamPartialImages: () => 1,
    });

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
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.x.ai/v1/images/generations");
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.prompt).toContain(`${PROMPT_REWRITE_GUARD_PREFIX}\n`);
    expect(body.prompt).toContain("当前模式：创意");
    expect(body.prompt).toContain("用户原始提示词：\n画一张图");
    expect(result.requestPrompt).toBe(body.prompt);
  });

  it("adds RAG context before calling Grok", async () => {
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
    const client = createDirectImagesClient({
      getApiProvider: () => "grok",
      getApiBaseUrl: () => "https://api.x.ai/v1",
      getApiBaseUrlMode: () => "full",
      getApiMode: () => "images",
      getApiKey: () => "xai-test",
      getModel: () => "grok-imagine-image-quality",
      getStreamImages: () => false,
      getStreamPartialImages: () => 1,
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

  it("batches Grok text generation with n", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: Array.from({ length: 8 }, (_, index) => ({
            b64_json: `grok-image-${index + 1}`,
          })),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = createDirectImagesClient({
      getApiProvider: () => "grok",
      getApiBaseUrl: () => "https://api.x.ai/v1",
      getApiBaseUrlMode: () => "full",
      getApiMode: () => "images",
      getApiKey: () => "xai-test",
      getModel: () => "grok-imagine-image-quality",
      getStreamImages: () => false,
      getStreamPartialImages: () => 1,
    });

    expect(client.canGenerateBatch?.()).toBe(true);
    await expect(
      client.generateBatch?.({
        prompt: "画一张图",
        count: 8,
        params: generationParams,
        promptRequestSettings: {
          promptMode: "default",
          promptWordbanks: defaultPromptWordbanks,
          promptRewriteGuardEnabled: false,
          promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
        },
      }),
    ).resolves.toHaveLength(8);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.n).toBe(8);
    expect(body.prompt).toBe("画一张图");
  });

  it("applies prompt mode and rewrite guard before calling Gemini", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: "gemini-image",
                      mimeType: "image/png",
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = createDirectImagesClient({
      getApiProvider: () => "gemini",
      getApiBaseUrl: () => "https://generativelanguage.googleapis.com",
      getApiBaseUrlMode: () => "origin",
      getApiMode: () => "images",
      getApiKey: () => "gemini-test",
      getModel: () => "gemini-3.1-flash-image-preview",
      getStreamImages: () => false,
      getStreamPartialImages: () => 1,
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image-preview:generateContent",
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const sentPrompt = requestBody.contents[0].parts[0].text;
    expect(sentPrompt).toContain(`${PROMPT_REWRITE_GUARD_PREFIX}\n`);
    expect(sentPrompt).toContain("当前模式：创意");
    expect(sentPrompt).toContain("用户原始提示词：\n画一张图");
    expect(result.requestPrompt).toBe(sentPrompt);
  });

  it("adds RAG context before calling Gemini", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: "gemini-image",
                      mimeType: "image/png",
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = createDirectImagesClient({
      getApiProvider: () => "gemini",
      getApiBaseUrl: () => "https://generativelanguage.googleapis.com",
      getApiBaseUrlMode: () => "origin",
      getApiMode: () => "images",
      getApiKey: () => "gemini-test",
      getModel: () => "gemini-3.1-flash-image-preview",
      getStreamImages: () => false,
      getStreamPartialImages: () => 1,
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

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const sentPrompt = requestBody.contents[0].parts[0].text;
    expect(sentPrompt).toContain("RAG 参考内容：");
    expect(sentPrompt).toContain("用户原始提示词：\n画一张雨夜街景");
    expect(result.requestPrompt).toBe(sentPrompt);
  });
});
