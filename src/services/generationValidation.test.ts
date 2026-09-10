import { describe, expect, it } from "vitest";
import type { GenerationParams } from "../types/studio";
import {
  describeGenerationDeviation,
  validateGeneratedImage,
  validateGenerationCount,
} from "./generationValidation";

const baseParams: GenerationParams = {
  size: "custom",
  resolution: "1k",
  width: 1024,
  height: 1536,
  imageCount: 4,
  quality: "auto",
  background: "auto",
  outputFormat: "png",
};

describe("validateGeneratedImage", () => {
  it("无偏差时返回空数组", () => {
    const deviations = validateGeneratedImage({
      params: baseParams,
      image: { width: 1024, height: 1536, mimeType: "image/png", prompt: "a cat" },
    });
    expect(deviations).toEqual([]);
  });

  it("检测尺寸偏差", () => {
    const deviations = validateGeneratedImage({
      params: baseParams,
      image: { width: 1024, height: 1024, mimeType: "image/png", prompt: "a cat" },
    });
    expect(deviations).toContainEqual({
      type: "sizeDeviation",
      requested: "1024x1536",
      actual: "1024x1024",
    });
  });

  it("检测透明背景被忽略（返回 JPEG）", () => {
    const deviations = validateGeneratedImage({
      params: { ...baseParams, background: "transparent" },
      image: { width: 1024, height: 1536, mimeType: "image/jpeg", prompt: "a cat" },
    });
    expect(deviations).toContainEqual({
      type: "transparentIgnored",
      mimeType: "image/jpeg",
    });
  });

  it("不把 PNG/WebP 的透明背景误报为偏差", () => {
    const deviations = validateGeneratedImage({
      params: { ...baseParams, background: "transparent" },
      image: { width: 1024, height: 1536, mimeType: "image/webp", prompt: "a cat" },
    });
    expect(deviations).toEqual([]);
  });

  it("检测接口改写 prompt（revisedPrompt ≠ requestPrompt）", () => {
    const deviations = validateGeneratedImage({
      params: baseParams,
      image: {
        prompt: "a cat",
        requestPrompt: "a cat",
        revisedPrompt: "a fluffy orange cat sitting by the window",
      },
    });
    expect(deviations).toContainEqual({
      type: "promptRewritten",
      requestPrompt: "a cat",
      revisedPrompt: "a fluffy orange cat sitting by the window",
    });
  });

  it("revisedPrompt 与原文一致时不报偏差", () => {
    const deviations = validateGeneratedImage({
      params: baseParams,
      image: { prompt: "a cat", revisedPrompt: "a cat" },
    });
    expect(deviations).toEqual([]);
  });

  it("size 为 auto 时不检测尺寸", () => {
    const deviations = validateGeneratedImage({
      params: { ...baseParams, size: "auto" },
      image: { width: 512, height: 512, mimeType: "image/png", prompt: "a cat" },
    });
    expect(deviations).toEqual([]);
  });
});

describe("validateGenerationCount", () => {
  it("请求 4 张返回 2 张时报告数量偏差", () => {
    expect(validateGenerationCount({ requested: 4, actual: 2, hasError: false })).toEqual([
      { type: "countMismatch", requested: 4, actual: 2 },
    ]);
  });

  it("有失败任务时不重复报告（错误文案已说明）", () => {
    expect(validateGenerationCount({ requested: 4, actual: 2, hasError: true })).toEqual([]);
  });

  it("数量一致时不报告", () => {
    expect(validateGenerationCount({ requested: 4, actual: 4, hasError: false })).toEqual([]);
  });
});

describe("describeGenerationDeviation", () => {
  it("给出可读的中文描述", () => {
    expect(
      describeGenerationDeviation({ type: "countMismatch", requested: 4, actual: 2 }),
    ).toContain("4 张");
    expect(
      describeGenerationDeviation({ type: "sizeDeviation", requested: "1024x1536", actual: "1024x1024" }),
    ).toContain("1024x1536");
    expect(describeGenerationDeviation({ type: "transparentIgnored", mimeType: "image/jpeg" })).toContain(
      "透明",
    );
    expect(
      describeGenerationDeviation({
        type: "promptRewritten",
        requestPrompt: "a",
        revisedPrompt: "b",
      }),
    ).toContain("改写");
  });
});
