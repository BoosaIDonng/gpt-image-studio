import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROMPT_REWRITE_GUARD_PREFIX,
  editImage,
  generateImage,
  getCustomSizeError,
} from "./imagesApi";
import type { GenerationParams } from "../types/studio";

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

describe("images API requests", () => {
  it("requests base64 JSON for image generation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: "generated-image",
      requestPrompt: "画一张图",
      revisedPrompt: undefined,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      devProxyUrl("https://api.example.test/v1/images/generations"),
    );
    // gpt-image 系列不支持 response_format 参数，传了会报 HTTP 400。
    expect(requestBody.response_format).toBeUndefined();
    expect(requestBody.quality).toBe("auto");
  });

  it("sends response_format for dall-e models", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "dall-e-3",
      prompt: "画一张图",
      params: generationParams,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.response_format).toBe("b64_json");
  });

  it("appends the Images API path when API base URL is configured as an origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "https://api.example.test",
      apiBaseUrlMode: "origin",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      params: generationParams,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      devProxyUrl("https://api.example.test/v1/images/generations"),
    );
  });

  it("preserves a port in a proxied API origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "http://127.0.0.1:8787/?url=http%3A%2F%2Fgateway.example.com%3A8080",
      apiBaseUrlMode: "origin",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      params: generationParams,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:8787/?url=http%3A%2F%2Fgateway.example.com%3A8080/v1/images/generations",
    );
  });

  it("normalizes extra trailing slashes before appending the Images API path", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "https://api.example.test///",
      apiBaseUrlMode: "origin",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      params: generationParams,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      devProxyUrl("https://api.example.test/v1/images/generations"),
    );
  });

  it("adds the prompt rewrite guard when enabled for image generation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    const result = await generateImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      promptRewriteGuardEnabled: true,
      params: generationParams,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.prompt).toBe(`${PROMPT_REWRITE_GUARD_PREFIX}\n画一张图`);
    expect(result).toMatchObject({
      requestPrompt: `${PROMPT_REWRITE_GUARD_PREFIX}\n画一张图`,
    });
  });

  it("adds RAG context before the original prompt for image generation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    const result = await generateImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张雨夜街景",
      ragContext: "RAG 参考内容：\n1. cinematic rain street",
      params: generationParams,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.prompt).toContain("RAG 参考内容：");
    expect(requestBody.prompt).toContain("用户原始提示词：\n画一张雨夜街景");
    expect(result.requestPrompt).toBe(requestBody.prompt);
  });

  it("applies prompt mode before the prompt rewrite guard", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      promptMode: "creative",
      promptRewriteGuardEnabled: true,
      params: generationParams,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.prompt).toContain(`${PROMPT_REWRITE_GUARD_PREFIX}\n`);
    expect(requestBody.prompt).toContain("当前模式：创意");
    expect(requestBody.prompt).toContain("用户原始提示词：\n画一张图");
  });

  it("uses custom prompt rewrite guard text when provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      promptRewriteGuardEnabled: true,
      promptRewriteGuardText: "请不要改写下面的提示词：",
      params: generationParams,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.prompt).toBe("请不要改写下面的提示词：\n画一张图");
  });

  it("converts ratio size presets to calculated dimensions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "generated-image" }],
      }),
    );

    await generateImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "画一张图",
      params: {
        ...generationParams,
        size: "16:9",
        width: 1920,
        height: 1088,
      },
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.size).toBe("1920x1088");
  });

  it("requests base64 JSON for image edits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "edited-image", revised_prompt: "rewritten edit" }],
      }),
    );

    await expect(
      editImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "改一下图",
        params: generationParams,
        images: [
          {
            blob: new Blob(["image"], { type: "image/png" }),
            name: "image.png",
          },
        ],
      }),
    ).resolves.toEqual({
      b64Json: "edited-image",
      requestPrompt: "改一下图",
      revisedPrompt: "rewritten edit",
    });

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    // gpt-image 系列不支持 response_format 参数，传了会报 HTTP 400。
    expect((requestBody as FormData).has("response_format")).toBe(false);
    expect((requestBody as FormData).get("quality")).toBe("auto");
  });

  it("calls the Responses API with the image_generation tool", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        output: [
          {
            type: "image_generation_call",
            result: { b64_json: "responses-image" },
            revised_prompt: "responses rewrite",
          },
        ],
      }),
    );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1",
        apiBaseUrlMode: "full",
        apiMode: "responses",
        apiKey: "sk-test",
        model: "gpt-5.5",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: "responses-image",
      requestPrompt: "画一张图",
      revisedPrompt: "responses rewrite",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(devProxyUrl("https://api.example.test/v1/responses"));
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody).toMatchObject({
      model: "gpt-5.5",
      input: "画一张图",
      tool_choice: "required",
    });
    expect(requestBody.tools).toEqual([
      expect.objectContaining({
        type: "image_generation",
        action: "generate",
        size: "1024x1024",
        quality: "auto",
        background: "auto",
        output_format: "png",
      }),
    ]);
  });

  it("parses Images API streaming responses and emits partial previews", async () => {
    const onPartialImage = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      eventStreamResponse([
        {
          type: "image_generation.partial_image",
          b64_json: "partial-image",
          partial_image_index: 1,
        },
        {
          type: "image_generation.completed",
          b64_json: "final-image",
          revised_prompt: "stream rewrite",
        },
      ]),
    );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        streamImages: true,
        streamPartialImages: 2,
        onPartialImage,
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: "final-image",
      requestPrompt: "画一张图",
      revisedPrompt: "stream rewrite",
    });

    expect(onPartialImage).toHaveBeenCalledWith({
      b64Json: "partial-image",
      partialImageIndex: 1,
    });
  });

  it("parses Responses API streaming responses and emits partial previews", async () => {
    const onPartialImage = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      eventStreamResponse([
        {
          type: "response.image_generation_call.partial_image",
          partial_image_b64: "partial-image",
          partial_image_index: 2,
        },
        {
          type: "response.output_item.done",
          item: {
            type: "image_generation_call",
            result: { b64_json: "final-image" },
            revised_prompt: "responses stream rewrite",
          },
        },
      ]),
    );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test",
        apiBaseUrlMode: "origin",
        apiMode: "responses",
        apiKey: "sk-test",
        model: "gpt-5.5",
        prompt: "画一张图",
        streamImages: true,
        streamPartialImages: 2,
        onPartialImage,
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: "final-image",
      requestPrompt: "画一张图",
      revisedPrompt: "responses stream rewrite",
    });

    expect(onPartialImage).toHaveBeenCalledWith({
      b64Json: "partial-image",
      partialImageIndex: 2,
    });
  });

  it("adds the prompt rewrite guard when enabled for image edits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "edited-image" }],
      }),
    );

    await editImage({
      apiBaseUrl: "https://api.example.test/v1/images",
      apiBaseUrlMode: "full",
      apiKey: "sk-test",
      model: "gpt-image-2",
      prompt: "改一下图",
      promptRewriteGuardEnabled: true,
      params: generationParams,
      images: [
        {
          blob: new Blob(["image"], { type: "image/png" }),
          name: "image.png",
        },
      ],
    });

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(requestBody.get("prompt")).toBe(`${PROMPT_REWRITE_GUARD_PREFIX}\n改一下图`);
  });

  it("keeps the HTTP status in API error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: { message: "Invalid bearer token" },
        },
        401,
      ),
    );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).rejects.toThrow("请求失败：HTTP 401：Invalid bearer token");
  });
});

describe("getCustomSizeError", () => {
  it("requires integer dimensions", () => {
    expect(getCustomSizeError(1024.5, 1024)).toBe("自定义尺寸的宽高必须是整数。");
    expect(getCustomSizeError(Number.NaN, 1024)).toBe("自定义尺寸的宽高必须是整数。");
  });

  it("requires dimensions between 16 and 3840 in 16px increments", () => {
    expect(getCustomSizeError(15, 1024)).toBe(
      "自定义尺寸的宽高必须是 16 到 3840 之间的 16 的倍数。",
    );
    expect(getCustomSizeError(3856, 1024)).toBe(
      "自定义尺寸的宽高必须是 16 到 3840 之间的 16 的倍数。",
    );
    expect(getCustomSizeError(1025, 1024)).toBe(
      "自定义尺寸的宽高必须是 16 到 3840 之间的 16 的倍数。",
    );
  });

  it("requires total pixels within the supported range", () => {
    expect(getCustomSizeError(256, 256)).toBe(
      "自定义尺寸的总像素必须在 655,360 到 8,294,400 之间。",
    );
    expect(getCustomSizeError(3840, 3840)).toBe(
      "自定义尺寸的总像素必须在 655,360 到 8,294,400 之间。",
    );
  });

  it("rejects dimensions with an aspect ratio greater than 3:1", () => {
    expect(getCustomSizeError(2048, 512)).toBe("自定义尺寸的长边与短边比例不能超过 3:1。");
  });

  it("allows valid dimensions", () => {
    expect(getCustomSizeError(1024, 1024)).toBe("");
    expect(getCustomSizeError(1536, 1024)).toBe("");
    expect(getCustomSizeError(1920, 1088)).toBe("");
  });
});

describe("provider URL responses (direct mode downloads)", () => {
  // PNG 签名 + 填充字节，足够 magic bytes 嗅探判定格式。
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const pngBase64 = btoa(String.fromCharCode(...pngBytes));

  function imageResponse(bytes: Uint8Array<ArrayBuffer>, contentType = "image/png") {
    return new Response(new Blob([bytes]), {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  }

  it("downloads data[0].url images for generation when b64_json is missing", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ url: "https://cdn.example.test/image.png", revised_prompt: "url rewrite" }],
        }),
      )
      .mockResolvedValueOnce(imageResponse(pngBytes));

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: pngBase64,
      mimeType: "image/png",
      revisedPrompt: "url rewrite",
      requestPrompt: "画一张图",
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://cdn.example.test/image.png");
  });

  it("downloads data[0].url images for edits when b64_json is missing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ url: "https://cdn.example.test/edited.png" }] }),
      )
      .mockResolvedValueOnce(imageResponse(pngBytes));

    await expect(
      editImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "改一下图",
        params: generationParams,
        images: [
          {
            blob: new Blob(["image"], { type: "image/png" }),
            name: "image.png",
          },
        ],
      }),
    ).resolves.toEqual({
      b64Json: pngBase64,
      mimeType: "image/png",
      revisedPrompt: undefined,
      requestPrompt: "改一下图",
    });
  });

  it("downloads url results from the Responses API", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          output: [
            {
              type: "image_generation_call",
              result: "https://cdn.example.test/responses.png",
              revised_prompt: "responses rewrite",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(imageResponse(pngBytes));

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test",
        apiBaseUrlMode: "origin",
        apiMode: "responses",
        apiKey: "sk-test",
        model: "gpt-5.5",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: pngBase64,
      mimeType: "image/png",
      revisedPrompt: "responses rewrite",
      requestPrompt: "画一张图",
    });
  });

  it("downloads url-only completed events from Images API streaming responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        eventStreamResponse([
          {
            type: "image_generation.partial_image",
            b64_json: "partial-image",
            partial_image_index: 0,
          },
          {
            type: "image_generation.completed",
            url: "https://cdn.example.test/final.png",
            revised_prompt: "stream url rewrite",
          },
        ]),
      )
      .mockResolvedValueOnce(imageResponse(pngBytes));

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        streamImages: true,
        streamPartialImages: 1,
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: pngBase64,
      mimeType: "image/png",
      revisedPrompt: "stream url rewrite",
      requestPrompt: "画一张图",
    });
  });

  it("keeps the fallback hint when the URL download is blocked by CORS", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ url: "https://cdn.example.test/image.png" }] }),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).rejects.toThrow("建议切换到 Companion 模式");
  });

  it("rejects image URLs with unsupported protocols", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ data: [{ url: "ftp://cdn.example.test/image.png" }] }),
    );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).rejects.toThrow("仅允许 http/https");
  });

  it("rejects downloaded payloads without an image signature", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ url: "https://cdn.example.test/not-image" }] }),
      )
      .mockResolvedValueOnce(
        new Response("<html>not an image</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

    await expect(
      generateImage({
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiKey: "sk-test",
        model: "gpt-image-2",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).rejects.toThrow("不是有效的 PNG/JPEG/WebP");
  });
});

function devProxyUrl(endpoint: string) {
  return `/__api-proxy?url=${encodeURIComponent(endpoint)}`;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function eventStreamResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}
