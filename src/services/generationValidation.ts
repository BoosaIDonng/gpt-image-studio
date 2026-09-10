import type { GenerationParams, ImageAsset } from "../types/studio";
import { apiSize } from "./imageApiRequest";

/**
 * Post-generation validation: surfaces silent deviations between what was
 * requested and what actually came back. All inputs already exist on
 * ImageAsset / GenerationParams, so no data-structure change is needed.
 */

export type GenerationDeviation =
  | { type: "countMismatch"; requested: number; actual: number }
  | { type: "sizeDeviation"; requested: string; actual: string }
  | { type: "transparentIgnored"; mimeType: string }
  | { type: "promptRewritten"; requestPrompt: string; revisedPrompt: string };

const TRANSPARENT_CAPABLE_MIME_TYPES = new Set(["image/png", "image/webp"]);

/** Per-image deviations derived from the stored asset metadata. */
export function validateGeneratedImage(input: {
  params?: GenerationParams;
  image: Pick<
    ImageAsset,
    "width" | "height" | "mimeType" | "prompt" | "requestPrompt" | "revisedPrompt"
  >;
}): GenerationDeviation[] {
  const deviations: GenerationDeviation[] = [];
  const { params, image } = input;

  if (params && params.size !== "auto" && image.width && image.height) {
    const requested = apiSize(params);
    const actual = `${image.width}x${image.height}`;
    if (requested !== actual) {
      deviations.push({ type: "sizeDeviation", requested, actual });
    }
  }

  if (
    params?.background === "transparent" &&
    image.mimeType &&
    !TRANSPARENT_CAPABLE_MIME_TYPES.has(image.mimeType)
  ) {
    deviations.push({ type: "transparentIgnored", mimeType: image.mimeType });
  }

  const requestPrompt = image.requestPrompt ?? image.prompt;
  if (image.revisedPrompt && image.revisedPrompt !== requestPrompt) {
    deviations.push({
      type: "promptRewritten",
      requestPrompt,
      revisedPrompt: image.revisedPrompt,
    });
  }

  return deviations;
}

/**
 * Message-level count validation. Skipped when the message already reports a
 * failure — partial failures are communicated through the error text instead.
 */
export function validateGenerationCount(input: {
  requested?: number;
  actual: number;
  hasError: boolean;
}): GenerationDeviation[] {
  const requested = input.requested;
  if (!requested || input.hasError || input.actual >= requested) return [];

  return [{ type: "countMismatch", requested, actual: input.actual }];
}

export function describeGenerationDeviation(deviation: GenerationDeviation): string {
  switch (deviation.type) {
    case "countMismatch":
      return `请求 ${deviation.requested} 张，实际返回 ${deviation.actual} 张。`;
    case "sizeDeviation":
      return `请求尺寸 ${deviation.requested}，实际返回 ${deviation.actual}。`;
    case "transparentIgnored":
      return `请求了透明背景，但返回的 ${deviation.mimeType} 格式不支持透明。`;
    case "promptRewritten":
      return "接口改写了提示词，实际使用的提示词与输入不一致。";
  }
}
