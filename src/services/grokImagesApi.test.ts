import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationParams } from "../types/studio";
import { editGrokImage, generateGrokImage, generateGrokImages } from "./grokImagesApi";

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

describe("Grok image API", () => {
  it("requests base64 JSON for Grok image generation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            b64_json: "grok-image",
            revised_prompt: "grok rewrite",
            mime_type: "image/jpeg",
          },
        ],
      }),
    );

    await expect(
      generateGrokImage({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: "grok-image",
      requestPrompt: "画一张图",
      revisedPrompt: "grok rewrite",
      mimeType: "image/jpeg",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.x.ai/v1/images/generations");
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody).toMatchObject({
      model: "grok-imagine-image-quality",
      prompt: "画一张图",
      response_format: "b64_json",
    });
    expect(requestBody).not.toHaveProperty("output_format");
  });

  it("requests multiple Grok images with n and returns every data item", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        data: Array.from({ length: 8 }, (_, index) => ({
          b64_json: `grok-image-${index + 1}`,
          revised_prompt: `grok rewrite ${index + 1}`,
          mime_type: "image/jpeg",
        })),
      }),
    );

    await expect(
      generateGrokImages({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "画一张图",
        params: generationParams,
        count: 8,
      }),
    ).resolves.toEqual(
      Array.from({ length: 8 }, (_, index) => ({
        b64Json: `grok-image-${index + 1}`,
        requestPrompt: "画一张图",
        revisedPrompt: `grok rewrite ${index + 1}`,
        mimeType: "image/jpeg",
      })),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody).toMatchObject({
      model: "grok-imagine-image-quality",
      prompt: "画一张图",
      n: 8,
      response_format: "b64_json",
    });
  });

  it("uses the Images API revised prompt only when Grok returns one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        data: [{ b64_json: "grok-image", revised_prompt: "image api rewrite" }],
      }),
    );

    await expect(
      generateGrokImage({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toMatchObject({
      requestPrompt: "画一张图",
      revisedPrompt: "image api rewrite",
    });
  });

  it("explains Grok credit or subscription 403 errors in Chinese", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            message: "You have run out of credits or need a Grok subscription.",
          },
        },
        403,
      ),
    );

    await expect(
      generateGrokImage({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).rejects.toThrow("xAI/Grok 账号没有可用额度");
  });

  it("sends Grok image edits as an image_url JSON object", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        data: [{ b64_json: "grok-edited", mime_type: "image/png" }],
      }),
    );

    await expect(
      editGrokImage({
        apiBaseUrl: "https://api.x.ai",
        apiBaseUrlMode: "origin",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
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
      b64Json: "grok-edited",
      requestPrompt: "改一下图",
      revisedPrompt: undefined,
      mimeType: "image/png",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.x.ai/v1/images/edits");
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.prompt).toBe("改一下图");
    expect(requestBody.image).toEqual({
      type: "image_url",
      url: expect.stringMatching(/^data:image\/png;base64,/),
    });
    expect(requestBody).not.toHaveProperty("images");
    expect(requestBody.response_format).toBe("b64_json");
  });

  it("sends multiple Grok edit references as image_url JSON objects", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        data: [{ b64_json: "grok-edited", mime_type: "image/png" }],
      }),
    );

    await editGrokImage({
      apiBaseUrl: "https://api.x.ai",
      apiBaseUrlMode: "origin",
      apiKey: "xai-test",
      model: "grok-imagine-image-quality",
      prompt: "改一下图",
      params: generationParams,
      images: [
        { blob: new Blob(["image-a"], { type: "image/png" }), name: "a.png" },
        { blob: new Blob(["image-b"], { type: "image/jpeg" }), name: "b.jpg" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.images).toEqual([
      { type: "image_url", url: expect.stringMatching(/^data:image\/png;base64,/) },
      { type: "image_url", url: expect.stringMatching(/^data:image\/jpeg;base64,/) },
    ]);
    expect(requestBody).not.toHaveProperty("image");
  });

  it("rejects Grok mask edits before sending a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      editGrokImage({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "局部编辑",
        params: generationParams,
        images: [
          {
            blob: new Blob(["image"], { type: "image/png" }),
            name: "image.png",
          },
        ],
        mask: {
          blob: new Blob(["mask"], { type: "image/png" }),
          name: "mask.png",
        },
      }),
    ).rejects.toThrow("Grok 图片接口当前不支持本应用的局部遮罩编辑。");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Grok provider URL responses (direct mode downloads)", () => {
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

  it("downloads data[].url images when b64_json is missing", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ url: "https://cdn.example.test/grok.png", revised_prompt: "grok url rewrite" }],
        }),
      )
      .mockResolvedValueOnce(imageResponse(pngBytes));

    await expect(
      generateGrokImage({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: pngBase64,
      mimeType: "image/png",
      revisedPrompt: "grok url rewrite",
      requestPrompt: "画一张图",
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://cdn.example.test/grok.png");
  });

  it("keeps the fallback hint when the Grok URL download is blocked by CORS", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ data: [{ url: "https://cdn.example.test/grok.png" }] }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      generateGrokImage({
        apiBaseUrl: "https://api.x.ai/v1",
        apiBaseUrlMode: "full",
        apiKey: "xai-test",
        model: "grok-imagine-image-quality",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).rejects.toThrow("建议切换到 Companion 模式");
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
