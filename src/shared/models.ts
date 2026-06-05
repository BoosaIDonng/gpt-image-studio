export const FIXED_IMAGE_MODEL = "gpt-image-2";
export const OPENAI_IMAGE_MODEL = "gpt-image-2";
export const GROK_IMAGE_MODEL = "grok-imagine-image-quality";
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export function defaultModelForProvider(provider: "openai" | "grok" | "gemini") {
  if (provider === "grok") return GROK_IMAGE_MODEL;
  if (provider === "gemini") return GEMINI_IMAGE_MODEL;
  return OPENAI_IMAGE_MODEL;
}
