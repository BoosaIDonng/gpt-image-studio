import type { ApiMode, ApiProvider, GenerationParams } from "../types/studio";

export function imageCapabilities(provider: ApiProvider, apiMode: ApiMode, model: string) {
  const openai = provider === "openai";

  return {
    background: openai,
    customSize: openai,
    outputFormat: openai,
    quality: openai,
    transparentBackground: openai && !(apiMode === "images" && model === "gpt-image-2"),
  };
}

export function validateImageParams(
  provider: ApiProvider,
  apiMode: ApiMode,
  model: string,
  params: GenerationParams,
) {
  const capabilities = imageCapabilities(provider, apiMode, model);
  if (!capabilities.customSize && params.size === "custom") {
    throw new Error("当前图片接口不支持自定义尺寸。");
  }
  if (!capabilities.background && params.background !== "auto") {
    throw new Error("当前图片接口不支持背景设置。");
  }
  if (!capabilities.transparentBackground && params.background === "transparent") {
    throw new Error("当前图片接口不支持透明背景。");
  }
  if (!capabilities.outputFormat && params.outputFormat !== "png") {
    throw new Error("当前图片接口不支持输出格式设置。");
  }
  if (!capabilities.quality && params.quality !== "auto") {
    throw new Error("当前图片接口不支持质量设置。");
  }
}
