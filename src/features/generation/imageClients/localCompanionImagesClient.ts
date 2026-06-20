import type { ApiProvider, GenerationParams } from "../../../types/studio";
import { buildPromptRequest } from "../../../services/promptRequest";
import { isGptImageModel } from "../../../shared/models";
import { blobToBase64, blobToDataUrl } from "../../../shared/blobUtils";
import { isSizeRatio, normalizeImageCount } from "../../../services/generationParams";
import { buildGrokEditImagePayload } from "../../../services/grokImagesApi";
import type { ImageClient, ImageClientResult } from "./imageClient";

type CompanionClientConfig = {
  getCompanionUrl: () => string;
  getSessionToken: () => string;
  getApiProvider: () => ApiProvider;
  getModel: () => string;
};

export function createLocalCompanionImagesClient(config: CompanionClientConfig): ImageClient {
  function headers() {
    const token = config.getSessionToken();
    if (!token) {
      throw new Error("尚未与本地 Companion 配对，请先在设置中完成配对。");
    }
    return { Authorization: `Bearer ${token}` };
  }

  return {
    canGenerateBatch() {
      return config.getApiProvider() === "grok";
    },
    async generate(input) {
      const url = `${config.getCompanionUrl()}/images/generations`;
      const model = config.getModel();
      const prompt = buildPromptRequest(input);

      if (config.getApiProvider() === "grok") {
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            response_format: "b64_json",
          }),
        });

        const result = await extractB64Json(response);
        return {
          ...result,
          requestPrompt: prompt,
        };
      }

      if (config.getApiProvider() === "gemini") {
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            response_format: "b64_json",
            gemini: buildGeminiOptions(input.params),
          }),
        });

        return {
          ...(await extractB64Json(response)),
          requestPrompt: prompt,
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, ...buildParams(model, input.params) }),
      });

      return {
        ...(await extractB64Json(response)),
        requestPrompt: prompt,
      };
    },

    async generateBatch(input) {
      if (config.getApiProvider() !== "grok") {
        throw new Error("当前供应商不支持批量单请求生成。");
      }

      const url = `${config.getCompanionUrl()}/images/generations`;
      const model = config.getModel();
      const prompt = buildPromptRequest(input);
      const count = normalizeImageCount(input.count);
      const results: ImageClientResult[] = [];

      for (let remaining = count; remaining > 0; remaining -= 10) {
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            n: Math.min(10, remaining),
            response_format: "b64_json",
          }),
        });
        results.push(...(await extractB64JsonList(response)).map((result) => ({
          ...result,
          requestPrompt: prompt,
        })));
      }

      return results;
    },

    async edit(input) {
      const url = `${config.getCompanionUrl()}/images/edits`;
      const model = config.getModel();
      const prompt = buildPromptRequest(input);

      if (config.getApiProvider() === "grok") {
        if (input.mask) {
          throw new Error("Grok 图片接口当前不支持本应用的局部遮罩编辑。");
        }
        const imageDataUrls = await Promise.all(
          input.images.map((image) => blobToDataUrl(image.blob)),
        );
        const imagePayload = buildGrokEditImagePayload(imageDataUrls);
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            ...imagePayload,
            response_format: "b64_json",
          }),
        });

        const result = await extractB64Json(response);
        return {
          ...result,
          requestPrompt: prompt,
        };
      }

      if (config.getApiProvider() === "gemini") {
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
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            images: imageParts,
            response_format: "b64_json",
            gemini: buildGeminiOptions(input.params),
          }),
        });

        return {
          ...(await extractB64Json(response)),
          requestPrompt: prompt,
        };
      }

      const body = new FormData();
      body.append("model", model);
      body.append("prompt", prompt);
      input.images.forEach((image) => {
        body.append("image[]", image.blob, image.name);
      });
      if (input.mask) {
        body.append("mask", input.mask.blob, input.mask.name);
      }
      const params = buildParams(model, input.params);
      Object.entries(params).forEach(([key, value]) => {
        body.append(key, value);
      });

      const response = await fetch(url, {
        method: "POST",
        headers: headers(),
        body,
      });

      return {
        ...(await extractB64Json(response)),
        requestPrompt: prompt,
      };
    },
  };
}

function buildGeminiOptions(params: GenerationParams) {
  return {
    ...(isSizeRatio(params.size) ? { aspectRatio: params.size } : {}),
    imageSize: params.resolution.toUpperCase(),
  };
}

function buildParams(
  model: string,
  params: { size: string; width: number; height: number; background: string; outputFormat: string },
) {
  const size = params.size === "auto"
    ? "auto"
    : params.size.includes(":") || params.size === "custom"
      ? `${params.width}x${params.height}`
      : params.size;

  return {
    size,
    background: params.background,
    output_format: params.outputFormat,
    // gpt-image 系列不支持 response_format，会报 HTTP 400；dall-e 系列需要它。
    ...(isGptImageModel(model) ? {} : { response_format: "b64_json" }),
  };
}

async function extractB64Json(response: Response): Promise<ImageClientResult> {
  const [result] = await extractB64JsonList(response);
  if (!result) {
    throw new Error("响应中没有 data[0].b64_json。");
  }
  return result;
}

async function extractB64JsonList(response: Response): Promise<ImageClientResult[]> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const statusMessage = `请求失败：HTTP ${response.status}`;
    const detail = payload.error?.message || payload.error;
    const message = detail
      ? `${statusMessage}：${typeof detail === "string" ? detail : JSON.stringify(detail)}`
      : statusMessage;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  const results = (payload.data ?? [])
    .filter((item: { b64_json?: string }) => Boolean(item?.b64_json))
    .map((item: { b64_json: string; revised_prompt?: string; mime_type?: string }) => ({
      b64Json: item.b64_json,
      revisedPrompt: item.revised_prompt,
      mimeType: item.mime_type,
    }));
  if (!results.length) {
    throw new Error("响应中没有 data[0].b64_json。");
  }
  return results;
}

