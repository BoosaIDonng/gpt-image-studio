import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationParams } from "../types/studio";
import { editGeminiImage, generateGeminiImage } from "./geminiImagesApi";

const generationParams: GenerationParams = {
  size: "16:9",
  resolution: "2k",
  width: 1920,
  height: 1080,
  imageCount: 1,
  quality: "auto",
  background: "auto",
  outputFormat: "png",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Gemini image API", () => {
  it("requests Gemini native image generation and returns inline image data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { text: "Image ready." },
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
      }));

    await expect(
      generateGeminiImage({
        apiBaseUrl: "https://generativelanguage.googleapis.com",
        apiBaseUrlMode: "origin",
        apiKey: "gemini-test",
        model: "gemini-3.1-flash-image-preview",
        prompt: "画一张图",
        params: generationParams,
      }),
    ).resolves.toEqual({
      b64Json: "gemini-image",
      requestPrompt: "画一张图",
      mimeType: "image/png",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image-preview:generateContent",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-goog-api-key": "gemini-test",
      "Content-Type": "application/json",
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody).toEqual({
      contents: [
        {
          parts: [{ text: "画一张图" }],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        responseFormat: {
          image: {
            aspectRatio: "16:9",
            imageSize: "2K",
          },
        },
      },
    });
  });

  it("sends Gemini edits with inline image parts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  inline_data: {
                    data: "gemini-edited",
                    mime_type: "image/jpeg",
                  },
                },
              ],
            },
          },
        ],
      }));

    await expect(
      editGeminiImage({
        apiBaseUrl: "https://generativelanguage.googleapis.com/v1",
        apiBaseUrlMode: "full",
        apiKey: "gemini-test",
        model: "gemini-3.1-flash-image-preview",
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
      b64Json: "gemini-edited",
      requestPrompt: "改一下图",
      mimeType: "image/jpeg",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image-preview:generateContent",
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.contents[0].parts).toEqual([
      { text: "改一下图" },
      {
        inline_data: {
          mime_type: "image/png",
          data: expect.any(String),
        },
      },
    ]);
    expect(requestBody.contents[0].parts[1].inline_data.data).not.toContain("data:image");
  });

  it("rejects Gemini mask edits before sending a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      editGeminiImage({
        apiBaseUrl: "https://generativelanguage.googleapis.com",
        apiBaseUrlMode: "origin",
        apiKey: "gemini-test",
        model: "gemini-3.1-flash-image-preview",
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
    ).rejects.toThrow("Gemini 图片接口当前不支持本应用的局部遮罩编辑。");

    expect(fetchMock).not.toHaveBeenCalled();
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
