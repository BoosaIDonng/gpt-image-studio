export const FIXED_IMAGE_MODEL = "gpt-image-2";
export const OPENAI_IMAGE_MODEL = "gpt-image-2";
export const GROK_IMAGE_MODEL = "grok-imagine-image-quality";
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export function defaultModelForProvider(provider: "openai" | "grok" | "gemini") {
  if (provider === "grok") return GROK_IMAGE_MODEL;
  if (provider === "gemini") return GEMINI_IMAGE_MODEL;
  return OPENAI_IMAGE_MODEL;
}

/**
 * gpt-image 系列（gpt-image-1、gpt-image-2 等）固定返回 b64_json，
 * 不接受也不识别 response_format 参数，传了会报 HTTP 400 Unknown parameter。
 * 只有 dall-e 系列需要通过 response_format 切换 url / b64_json。
 */
export function isGptImageModel(model: string): boolean {
  return /^gpt-image-\d/i.test(model.trim());
}
