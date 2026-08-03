import type { ApiBaseUrlMode, GenerationParams } from "../types/studio";
import { blobToBase64 } from "../shared/blobUtils";
import { NetworkError, isRetryableStatus, SERVER_DISCONNECTED_MESSAGE } from "../shared/apiErrors";
import { isSizeRatio } from "./generationParams";

type GeminiImageInput = {
  apiBaseUrl: string;
  apiBaseUrlMode: ApiBaseUrlMode;
  apiKey: string;
  model: string;
  prompt: string;
  params: GenerationParams;
  signal?: AbortSignal;
};

type GeminiEditInput = GeminiImageInput & {
  images: Array<{
    blob: Blob;
    name: string;
  }>;
  mask?: {
    blob: Blob;
    name: string;
  };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?:
    | {
        message?: string;
      }
    | string;
  message?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  inline_data?: {
    data?: string;
    mime_type?: string;
  };
};

export type GeminiImageApiResult = {
  b64Json: string;
  requestPrompt?: string;
  revisedPrompt?: string;
  mimeType?: string;
};

export async function generateGeminiImage(input: GeminiImageInput): Promise<GeminiImageApiResult> {
  validateGeminiParams(input.params);
  const response = await requestGeminiImage(input, [{ text: input.prompt }]);
  const result = await parseSingleGeminiImageResponse(response);
  return {
    ...result,
    requestPrompt: input.prompt,
  };
}

export async function editGeminiImage(input: GeminiEditInput): Promise<GeminiImageApiResult> {
  validateGeminiParams(input.params);
  if (input.mask) {
    throw new Error("Gemini 图片接口当前不支持本应用的局部遮罩编辑。");
  }

  const imageParts = await Promise.all(
    input.images.map(async (image) => ({
      inline_data: {
        mime_type: image.blob.type || "application/octet-stream",
        data: await blobToBase64(image.blob),
      },
    })),
  );
  const response = await requestGeminiImage(input, [{ text: input.prompt }, ...imageParts]);
  const result = await parseSingleGeminiImageResponse(response);
  return {
    ...result,
    requestPrompt: input.prompt,
  };
}

async function requestGeminiImage(input: GeminiImageInput, parts: Array<Record<string, unknown>>) {
  try {
    return await fetch(buildGeminiEndpoint(input.apiBaseUrl, input.apiBaseUrlMode, input.model), {
      method: "POST",
      signal: input.signal,
      headers: {
        "x-goog-api-key": input.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        generationConfig: buildGeminiGenerationConfig(input.params),
      }),
    });
  } catch (error) {
    throw new NetworkError(SERVER_DISCONNECTED_MESSAGE, { cause: error });
  }
}

function buildGeminiGenerationConfig(params: GenerationParams) {
  const image: Record<string, string> = {};
  if (isSizeRatio(params.size)) image.aspectRatio = params.size;
  image.imageSize = params.resolution.toUpperCase();

  return {
    responseModalities: ["TEXT", "IMAGE"],
    responseFormat: {
      image,
    },
  };
}

function validateGeminiParams(params: GenerationParams) {
  if (params.background === "transparent") {
    throw new Error("Gemini 图片接口当前不支持透明背景输出。");
  }
}

function buildGeminiEndpoint(apiBaseUrl: string, mode: ApiBaseUrlMode, model: string) {
  const baseUrl = normalizeGeminiBaseUrl(apiBaseUrl, mode);
  return `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
}

function normalizeGeminiBaseUrl(apiBaseUrl: string, mode: ApiBaseUrlMode) {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (mode === "origin") return `${trimmed}/v1`;
  return trimmed;
}

async function parseSingleGeminiImageResponse(response: Response): Promise<GeminiImageApiResult> {
  const [result] = await parseGeminiImageResponses(response);
  if (!result) {
    throw new Error("Gemini 响应中没有 candidates[].content.parts[].inlineData.data。");
  }
  return result;
}

async function parseGeminiImageResponses(response: Response): Promise<GeminiImageApiResult[]> {
  const text = await response.text();
  const payload = (text ? JSON.parse(text) : {}) as GeminiGenerateContentResponse;

  if (!response.ok) {
    const message = geminiErrorMessage(response.status, payload);
    if (isRetryableStatus(response.status)) {
      throw new NetworkError(message, { status: response.status });
    }
    throw new Error(message);
  }

  const results = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map<GeminiImageApiResult | null>((part) => {
      const inlineData = part.inlineData ?? part.inline_data;
      const data = inlineData?.data;
      if (!data) return null;
      return {
        b64Json: data,
        mimeType: readInlineMimeType(inlineData),
      };
    })
    .filter((item): item is GeminiImageApiResult => item !== null);

  if (!results.length) {
    throw new Error("Gemini 响应中没有 candidates[].content.parts[].inlineData.data。");
  }

  return results;
}

function readInlineMimeType(
  inlineData:
    | { data?: string; mimeType?: string }
    | { data?: string; mime_type?: string }
    | undefined,
) {
  if (!inlineData) return undefined;
  if ("mimeType" in inlineData) return inlineData.mimeType;
  if ("mime_type" in inlineData) return inlineData.mime_type;
  return undefined;
}

function geminiErrorMessage(status: number, payload: GeminiGenerateContentResponse) {
  const detail =
    typeof payload.error === "string" ? payload.error : payload.error?.message || payload.message;
  return detail ? `Gemini 请求失败：HTTP ${status}：${detail}` : `Gemini 请求失败：HTTP ${status}`;
}
