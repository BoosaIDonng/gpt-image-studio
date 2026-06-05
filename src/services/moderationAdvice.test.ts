import { describe, expect, it } from "vitest";
import {
  analyzeModerationRejection,
  formatModerationAdvice,
} from "./moderationAdvice";

describe("analyzeModerationRejection", () => {
  it("detects generated image content moderation rejections", () => {
    const advice = analyzeModerationRejection(
      "HTTP 400：Generated image rejected by content moderation.",
      "雨夜街头肖像",
    );

    expect(advice.isModerationRejection).toBe(true);
    expect(advice.reasons).toContain("接口内容审核拒绝了这次图片生成请求。");
  });

  it("suggests a safer prompt that preserves composition and style", () => {
    const advice = analyzeModerationRejection(
      "HTTP 400: Generated image rejected by content moderation.",
      "nsfw, completely nude, girl sitting on chair, cinematic rain street, detailed nipples",
    );

    expect(advice.saferPrompt).toContain("girl sitting on chair");
    expect(advice.saferPrompt).toContain("cinematic rain street");
    expect(advice.saferPrompt).toContain("fully clothed");
    expect(advice.saferPrompt).not.toMatch(/nsfw|nude|nipples/i);
  });

  it("formats moderation advice for image error messages", () => {
    const text = formatModerationAdvice(
      analyzeModerationRejection(
        "HTTP 400: Generated image rejected by content moderation.",
        "topless portrait with blood",
      ),
    );

    expect(text).toContain("可能触发内容审核的原因");
    expect(text).toContain("建议改写");
    expect(text).toContain("非露骨");
  });
});
