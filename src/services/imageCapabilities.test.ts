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

describe("capability registry integration", () => {
  it("gpt-image-2（images API）不支持透明背景，但支持尺寸/质量/格式", () => {
    const capabilities = imageCapabilities("openai", "images", "gpt-image-2");
    expect(capabilities.transparentBackground).toBe(false);
    expect(capabilities.customSize).toBe(true);
    expect(capabilities.quality).toBe(true);
    expect(capabilities.streaming).toBe(true);
  });

  it("gpt-image-1（images API）支持透明背景", () => {
    expect(imageCapabilities("openai", "images", "gpt-image-1").transparentBackground).toBe(true);
  });

  it("未知模型保持历史基线行为（不发 quality，其余与原 openai 全支持一致）", () => {
    const capabilities = imageCapabilities("openai", "images", "totally-new-model");
    // quality 参数历史上只发给 gpt-image-N（isGptImageModel 门控），未知模型同样不发。
    expect(capabilities.quality).toBe(false);
    expect(capabilities.customSize).toBe(true);
    expect(capabilities.transparentBackground).toBe(true);
    expect(capabilities.streaming).toBe(true);
  });

  it("非 OpenAI 供应商保持保守默认", () => {
    const capabilities = imageCapabilities("grok", "images", "grok-imagine-image-quality");
    expect(capabilities.customSize).toBe(false);
    expect(capabilities.quality).toBe(false);
    expect(capabilities.streaming).toBe(false);
  });

  it("新增模型只需在 registry 声明一处", () => {
    // 声明处（imageCapabilityRegistry）之外无模型名硬编码：
    // 只要 registry 更新规则，所有消费方（参数校验/请求构造/设置面板）同步生效。
    expect(imageCapabilities("openai", "images", "gpt-image-2").background).toBe(true);
    expect(imageCapabilities("openai", "responses", "gpt-image-2").transparentBackground).toBe(
      true,
    );
  });
});
