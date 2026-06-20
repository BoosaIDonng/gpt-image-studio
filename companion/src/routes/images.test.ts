import { describe, expect, it } from "vitest";
import { createSecurityConfig } from "../securityConfig.js";
import {
  buildGeminiGenerateContentRequest,
  normalizeGeminiGenerateContentResponse,
  validateEditMultipart,
  validateGeminiEditBody,
  validateGrokEditBody,
} from "./images.js";

function multipart(parts: Array<{ name: string; contentType?: string; body?: string }>): Buffer {
  const boundary = "----test-boundary";
  const content =
    parts
      .map((part) => {
        const headers = [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.name}.bin"`,
          part.contentType ? `Content-Type: ${part.contentType}` : undefined,
        ].filter(Boolean);
        return `${headers.join("\r\n")}\r\n\r\n${part.body ?? "data"}`;
      })
      .join("\r\n") + `\r\n--${boundary}--\r\n`;

  return Buffer.from(content, "latin1");
}

describe("companion image route validation", () => {
  const security = createSecurityConfig({ channel: "dev" });

  it("accepts image references and png mask", () => {
    const body = multipart([
      { name: "image[]", contentType: "image/png" },
      { name: "mask", contentType: "image/png" },
    ]);

    expect(validateEditMultipart(body, security)).toBeNull();
  });

  it("requires at least one image", () => {
    const body = multipart([{ name: "mask", contentType: "image/png" }]);

    expect(validateEditMultipart(body, security)).toContain("至少需要一张引用图片");
  });

  it("rejects too many image references", () => {
    const body = multipart(
      Array.from({ length: 17 }, () => ({
        name: "image[]",
        contentType: "image/png",
      })),
    );

    expect(validateEditMultipart(body, security)).toContain("最多支持 16 张引用图片");
  });

  it("rejects unsupported image mime types", () => {
    const body = multipart([{ name: "image[]", contentType: "image/gif" }]);

    expect(validateEditMultipart(body, security)).toContain("不支持的图片类型");
  });

  it("requires mask to be png", () => {
    const body = multipart([
      { name: "image[]", contentType: "image/png" },
      { name: "mask", contentType: "image/jpeg" },
    ]);

    expect(validateEditMultipart(body, security)).toContain("mask 必须是 image/png");
  });

  it("accepts a Grok JSON edit image_url object", () => {
    expect(
      validateGrokEditBody({
        model: "grok-imagine-image-quality",
        prompt: "改一下图",
        image: { type: "image_url", url: "data:image/png;base64,aW1hZ2U=" },
        response_format: "b64_json",
      }),
    ).toBeNull();
  });

  it("accepts Grok JSON edit image_url arrays", () => {
    expect(
      validateGrokEditBody({
        model: "grok-imagine-image-quality",
        prompt: "改一下图",
        images: [
          { type: "image_url", url: "data:image/png;base64,aW1hZ2U=" },
          { type: "image_url", url: "data:image/jpeg;base64,aW1hZ2U=" },
        ],
        response_format: "b64_json",
      }),
    ).toBeNull();
  });

  it("rejects Grok JSON edits without data URL image_url objects", () => {
    expect(
      validateGrokEditBody({
        model: "grok-imagine-image-quality",
        prompt: "改一下图",
        image: { type: "image_url", url: "https://example.com/image.png" },
      }),
    ).toContain("data URL");
  });

  it("builds Gemini generateContent requests from Companion JSON bodies", () => {
    expect(
      buildGeminiGenerateContentRequest({
        model: "gemini-3.1-flash-image-preview",
        prompt: "画一张图",
        gemini: {
          aspectRatio: "16:9",
          imageSize: "2K",
        },
      }),
    ).toEqual({
      model: "gemini-3.1-flash-image-preview",
      body: {
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
      },
    });
  });

  it("normalizes Gemini inline image responses to the existing Images API shape", () => {
    expect(
      normalizeGeminiGenerateContentResponse({
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
    ).toEqual({
      data: [
        {
          b64_json: "gemini-image",
          mime_type: "image/png",
        },
      ],
    });
  });

  it("accepts Gemini JSON edit inline image parts", () => {
    expect(
      validateGeminiEditBody({
        model: "gemini-3.1-flash-image-preview",
        prompt: "改一下图",
        images: [
          {
            inline_data: {
              mime_type: "image/png",
              data: "aW1hZ2U=",
            },
          },
        ],
      }),
    ).toBeNull();
  });
});
