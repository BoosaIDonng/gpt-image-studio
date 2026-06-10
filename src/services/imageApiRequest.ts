import type { ApiMode, GenerationParams } from "../types/studio";

export function normalizeApiBaseUrl(
  url: string,
  mode: "origin" | "full" = "full",
  apiMode: ApiMode = "images",
) {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  if (mode === "origin") {
    return `${trimmed}${apiMode === "responses" ? "/v1" : "/v1/images"}`;
  }

  if (apiMode === "responses") {
    return trimmed.replace(/\/v1\/images$/i, "/v1");
  }

  if (/\/v1$/i.test(trimmed)) {
    return `${trimmed}/images`;
  }

  return trimmed;
}

export function buildApiEndpoint(
  apiBaseUrl: string,
  apiBaseUrlMode: "origin" | "full",
  apiMode: ApiMode,
  path: string,
) {
  return `${normalizeApiBaseUrl(apiBaseUrl, apiBaseUrlMode, apiMode)}/${path}`;
}

export function imageApiParams(
  model: string,
  params: GenerationParams,
  apiMode: ApiMode = "images",
) {
  validateBackground(model, params.background, apiMode);

  return {
    size: apiSize(params),
    background: params.background,
    output_format: params.outputFormat,
    response_format: "b64_json",
  };
}

function validateBackground(
  model: string,
  background: GenerationParams["background"],
  apiMode: ApiMode = "images",
) {
  if (apiMode === "images" && model === "gpt-image-2" && background === "transparent") {
    throw new Error("gpt-image-2 当前不支持透明背景，请选择自动或不透明背景。");
  }
}

export function apiSize(params: GenerationParams) {
  if (params.size === "auto") {
    return "auto";
  }

  if (params.size.includes(":") || params.size === "custom") {
    validateCustomSize(params.width, params.height);
    return `${params.width}x${params.height}`;
  }

  return params.size;
}

export function normalizeStreamPartialImages(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(3, Math.max(0, Math.trunc(numeric))) as 0 | 1 | 2 | 3;
}

function validateCustomSize(width: number, height: number) {
  const error = getCustomSizeError(width, height);
  if (error) {
    throw new Error(error);
  }
}

export function getCustomSizeError(width: number, height: number) {
  const normalizedWidth = Math.trunc(width);
  const normalizedHeight = Math.trunc(height);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    normalizedWidth !== width ||
    normalizedHeight !== height
  ) {
    return "自定义尺寸的宽高必须是整数。";
  }

  if (
    normalizedWidth < 16 ||
    normalizedHeight < 16 ||
    normalizedWidth > 3840 ||
    normalizedHeight > 3840 ||
    normalizedWidth % 16 !== 0 ||
    normalizedHeight % 16 !== 0
  ) {
    return "自定义尺寸的宽高必须是 16 到 3840 之间的 16 的倍数。";
  }

  const pixels = normalizedWidth * normalizedHeight;
  if (pixels < 655360 || pixels > 8294400) {
    return "自定义尺寸的总像素必须在 655,360 到 8,294,400 之间。";
  }

  const longSide = Math.max(normalizedWidth, normalizedHeight);
  const shortSide = Math.min(normalizedWidth, normalizedHeight);
  if (longSide / shortSide > 3) {
    return "自定义尺寸的长边与短边比例不能超过 3:1。";
  }

  return "";
}
