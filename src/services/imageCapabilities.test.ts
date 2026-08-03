import { describe, expect, it } from "vitest";
import { imageCapabilities, validateImageParams } from "./imageCapabilities";

const params = {
  size: "1:1" as const,
  resolution: "1k" as const,
  width: 1024,
  height: 1024,
  imageCount: 1,
  quality: "auto" as const,
  background: "auto" as const,
  outputFormat: "png" as const,
};

describe("image capabilities", () => {
  it("keeps GPT Image quality but disables unsupported transparent backgrounds", () => {
    expect(imageCapabilities("openai", "images", "gpt-image-2").quality).toBe(true);
    expect(imageCapabilities("openai", "images", "gpt-image-2").transparentBackground).toBe(false);
  });

  it("rejects options that Grok ignores", () => {
    expect(() =>
      validateImageParams("grok", "images", "grok-imagine-image-quality", {
        ...params,
        outputFormat: "webp",
      }),
    ).toThrow("输出格式");
  });
});
