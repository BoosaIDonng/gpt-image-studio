import { describe, expect, it } from "vitest";
import type { GenerationParams } from "../types/studio";
import { imageApiParams } from "./imageApiRequest";

const baseParams: GenerationParams = {
  size: "1:1",
  resolution: "1k",
  width: 1024,
  height: 1024,
  imageCount: 1,
  quality: "high",
  background: "auto",
  outputFormat: "png",
};

describe("imageApiParams", () => {
  it("sends gpt-image-only params for the gpt-image family and drops response_format", () => {
    const params = imageApiParams("gpt-image-1", baseParams, "images");
    expect(params).toEqual({
      size: "1024x1024",
      quality: "high",
      background: "auto",
      output_format: "png",
    });
  });

  it("trims background/output_format/quality for non-gpt-image models (strict upstream 400 guard)", () => {
    const params = imageApiParams("dall-e-3", baseParams, "images");
    expect(params).toEqual({ size: "1024x1024", response_format: "b64_json" });
  });

  it("keeps tool-level params in Responses API mode regardless of model name", () => {
    const params = imageApiParams("gpt-4o", baseParams, "responses");
    expect(params).toEqual({
      size: "1024x1024",
      quality: "high",
      background: "auto",
      output_format: "png",
    });
  });

  it("rejects transparent backgrounds with JPEG output (no alpha channel upstream)", () => {
    expect(() =>
      imageApiParams(
        "gpt-image-1",
        { ...baseParams, background: "transparent", outputFormat: "jpeg" },
        "images",
      ),
    ).toThrow("透明背景仅支持 PNG 或 WebP");
  });

  it("rejects transparent backgrounds for dall-e-like models via the registry", () => {
    expect(() =>
      imageApiParams("dall-e-3", { ...baseParams, background: "transparent" }, "images"),
    ).toThrow("不支持透明背景");
  });
});
