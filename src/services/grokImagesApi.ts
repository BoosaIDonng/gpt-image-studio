import type { ApiBaseUrlMode, GenerationParams } from "../types/studio";

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
  const count = normalizeGrokImageCount(input.count);
  const results: GrokImageApiResult[] = [];

  for (let remaining = count; remaining > 0; remaining -= 10) {
    results.push(...await requestGrokImages(input, Math.min(10, remaining)));
  }

  return results;
}

async function requestGrokImages(input: GrokImageInput, count: number): Promise<GrokImageApiResult[]> {
  const response = await fetch(buildGrokEndpoint(input.apiBaseUrl, input.apiBaseUrlMode, "generations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      ...(count > 1 ? { n: count } : {}),
      response_format: "b64_json",
    }),
  });

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

  const response = await fetch(buildGrokEndpoint(input.apiBaseUrl, input.apiBaseUrlMode, "edits"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      ...imagePayload,
      response_format: "b64_json",
    }),
  });

  const result = await parseSingleGrokImageResponse(response);
  return {
    ...result,
    requestPrompt: input.prompt,
  };
}

function buildGrokEditImagePayload(imageDataUrls: string[]) {
  const references = imageDataUrls.map((url) => ({
    type: "image_url",
    url,
  }));

  return references.length === 1
    ? { image: references[0] }
    : { images: references };
}

function validateGrokParams(params: GenerationParams) {
  if (params.background === "transparent") {
    throw new Error("Grok 图片接口当前不支持透明背景输出。");
  }
}

function normalizeGrokImageCount(count: unknown) {
  const numericCount = typeof count === "number" ? count : Number(count);
  if (!Number.isFinite(numericCount)) return 1;
  return Math.max(1, Math.round(numericCount));
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
    throw new Error(grokErrorMessage(response.status, payload));
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
  return detail
    ? `Grok 请求失败：HTTP ${status}：${detail}`
    : `Grok 请求失败：HTTP ${status}`;
}

async function blobToDataUrl(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
