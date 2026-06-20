import type { ApiBaseUrlMode, GenerationParams } from "../types/studio";
import { blobToDataUrl } from "../shared/blobUtils";
import { NetworkError, isRetryableStatus, SERVER_DISCONNECTED_MESSAGE } from "../shared/apiErrors";
import { normalizeImageCount } from "./generationParams";

type GrokImageInput = {
  apiBaseUrl: string;
  apiBaseUrlMode: ApiBaseUrlMode;
  apiKey: string;
  model: string;
  prompt: string;
  params: GenerationParams;
};

type GrokImageBatchInput = GrokImageInput & {
  count: number;
};

type GrokEditInput = GrokImageInput & {
  images: Array<{
    blob: Blob;
    name: string;
  }>;
  mask?: {
    blob: Blob;
    name: string;
  };
};

type GrokImageApiResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    mime_type?: string;
  }>;
  error?: {
    message?: string;
  } | string;
  message?: string;
};

export type GrokImageApiResult = {
  b64Json: string;
  requestPrompt?: string;
  revisedPrompt?: string;
  mimeType?: string;
};

export async function generateGrokImage(input: GrokImageInput): Promise<GrokImageApiResult> {
  const [result] = await generateGrokImages({ ...input, count: 1 });
  if (!result) {
    throw new Error("Grok 响应中没有 data[0].b64_json。");
  }
  return result;
}

export async function generateGrokImages(input: GrokImageBatchInput): Promise<GrokImageApiResult[]> {
  validateGrokParams(input.params);
  const count = normalizeImageCount(input.count);
  const results: GrokImageApiResult[] = [];

  for (let remaining = count; remaining > 0; remaining -= 10) {
    results.push(...await requestGrokImages(input, Math.min(10, remaining)));
  }

  return results;
}

async function requestGrokImages(input: GrokImageInput, count: number): Promise<GrokImageApiResult[]> {
  const sizeFields = buildGrokSizeFields(input.params);
  let response: Response;
  try {
    response = await fetch(buildGrokEndpoint(input.apiBaseUrl, input.apiBaseUrlMode, "generations"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        ...(count > 1 ? { n: count } : {}),
        ...sizeFields,
        response_format: "b64_json",
      }),
    });
  } catch (error) {
    throw new NetworkError(SERVER_DISCONNECTED_MESSAGE, { cause: error });
  }

  const results = await parseGrokImageResponses(response);
  return results.map((result) => ({
    ...result,
    requestPrompt: input.prompt,
  }));
}

export async function editGrokImage(input: GrokEditInput): Promise<GrokImageApiResult> {
  validateGrokParams(input.params);
  if (input.mask) {
    throw new Error("Grok 图片接口当前不支持本应用的局部遮罩编辑。");
  }

  const imageDataUrls = await Promise.all(
    input.images.map((image) => blobToDataUrl(image.blob)),
  );
  const imagePayload = buildGrokEditImagePayload(imageDataUrls);
  const sizeFields = buildGrokSizeFields(input.params);

  let response: Response;
  try {
    response = await fetch(buildGrokEndpoint(input.apiBaseUrl, input.apiBaseUrlMode, "edits"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        ...imagePayload,
        ...sizeFields,
        response_format: "b64_json",
      }),
    });
  } catch (error) {
    throw new NetworkError(SERVER_DISCONNECTED_MESSAGE, { cause: error });
  }

  const result = await parseSingleGrokImageResponse(response);
  return {
    ...result,
    requestPrompt: input.prompt,
  };
}

export const GROK_SUPPORTED_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export const GROK_SUPPORTED_RESOLUTIONS = ["1k", "2k"] as const;

function validateGrokParams(params: GenerationParams) {
  if (params.background === "transparent") {
    throw new Error("Grok 图片接口当前不支持透明背景输出。");
  }
  if (params.size === "custom") {
    throw new Error("Grok 图片接口不支持自定义宽高，请使用比例选项。");
  }
  if (params.size !== "auto" && !GROK_SUPPORTED_RATIOS.includes(params.size as typeof GROK_SUPPORTED_RATIOS[number])) {
    throw new Error(`Grok 图片接口不支持 ${params.size} 比例，仅支持 ${GROK_SUPPORTED_RATIOS.join("、")}。`);
  }
  if (!GROK_SUPPORTED_RESOLUTIONS.includes(params.resolution as typeof GROK_SUPPORTED_RESOLUTIONS[number])) {
    throw new Error(`Grok 图片接口不支持 ${params.resolution} 分辨率，仅支持 1K 和 2K。`);
  }
}

function buildGrokSizeFields(params: GenerationParams) {
  const fields: { aspect_ratio?: string; resolution?: string } = {};
  if (params.size !== "auto" && params.size !== "custom") {
    fields.aspect_ratio = params.size;
  }
  fields.resolution = params.resolution;
  return fields;
}

export function buildGrokEditImagePayload(imageDataUrls: string[]) {
  const references = imageDataUrls.map((url) => ({
    type: "image_url",
    url,
  }));

  return references.length === 1
    ? { image: references[0] }
    : { images: references };
}

function buildGrokEndpoint(apiBaseUrl: string, mode: ApiBaseUrlMode, path: "generations" | "edits") {
  return `${normalizeGrokImagesBaseUrl(apiBaseUrl, mode)}/${path}`;
}

function normalizeGrokImagesBaseUrl(apiBaseUrl: string, mode: ApiBaseUrlMode) {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  if (mode === "origin") {
    return `${trimmed}/v1/images`;
  }

  if (/\/v1$/i.test(trimmed)) {
    return `${trimmed}/images`;
  }

  return trimmed;
}

async function parseSingleGrokImageResponse(response: Response): Promise<GrokImageApiResult> {
  const [result] = await parseGrokImageResponses(response);
  if (!result) {
    throw new Error("Grok 响应中没有 data[0].b64_json。");
  }
  return result;
}

async function parseGrokImageResponses(response: Response): Promise<GrokImageApiResult[]> {
  const text = await response.text();
  const payload = (text ? JSON.parse(text) : {}) as GrokImageApiResponse;

  if (!response.ok) {
    const message = grokErrorMessage(response.status, payload);
    if (isRetryableStatus(response.status)) {
      throw new NetworkError(message, { status: response.status });
    }
    throw new Error(message);
  }

  const results = (payload.data ?? [])
    .filter((item) => Boolean(item?.b64_json))
    .map((item) => ({
      b64Json: item.b64_json!,
      revisedPrompt: item.revised_prompt,
      mimeType: item.mime_type,
    }));
  if (!results.length) {
    throw new Error("Grok 响应中没有 data[0].b64_json。");
  }

  return results;
}

function grokErrorMessage(status: number, payload: GrokImageApiResponse) {
  const detail = typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || payload.message;
  if (isGrokBillingError(status, detail)) {
    return [
      "Grok 请求失败：HTTP 403：xAI/Grok 账号没有可用额度，或当前 API key 所属账号没有可用订阅权限。",
      "请在 xAI 控制台充值或确认订阅后重试，也可以临时切换到 OpenAI/Gemini。",
      detail ? `原始错误：${detail}` : "",
    ].filter(Boolean).join("\n");
  }

  return detail
    ? `Grok 请求失败：HTTP ${status}：${detail}`
    : `Grok 请求失败：HTTP ${status}`;
}

function isGrokBillingError(status: number, detail?: string) {
  if (status !== 403 || !detail) return false;
  const normalized = detail.toLowerCase();
  return (
    normalized.includes("run out of credits") ||
    normalized.includes("need a grok subscription") ||
    normalized.includes("add credits") ||
    normalized.includes("upgrade")
  );
}
