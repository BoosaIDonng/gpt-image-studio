import type { ApiBaseUrlMode, ApiMode, ApiProvider } from "../types/studio";
import { extractUpstreamErrorDetail } from "../shared/apiErrors";
import { isTimeoutError, withTimeoutSignal } from "../shared/fetchTimeout";
import { proxyDevelopmentApiRequest } from "./devApiProxy";

/** 模型发现是短交互；上游挂起（如 CF 524 之前的黑洞）时 15s 内给用户反馈。 */
const MODEL_DISCOVERY_TIMEOUT_MS = 15_000;

type ImageModelDiscoveryInput = {
  apiProvider: ApiProvider;
  apiBaseUrl: string;
  apiBaseUrlMode: ApiBaseUrlMode;
  apiMode: ApiMode;
  apiKey: string;
};

export async function fetchImageModels(input: ImageModelDiscoveryInput): Promise<string[]> {
  const apiKey = input.apiKey.trim();
  const baseUrl = modelsBaseUrl(input);
  if (!apiKey) throw new Error("请先填写 API key。");
  if (!baseUrl) throw new Error("请先填写 API 地址。");

  const isGemini = input.apiProvider === "gemini";
  const endpoint = isGemini
    ? `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`
    : `${baseUrl}/models`;
  const response = await fetch(
    proxyDevelopmentApiRequest(endpoint),
    isGemini
      ? { signal: withTimeoutSignal(MODEL_DISCOVERY_TIMEOUT_MS) }
      : {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: withTimeoutSignal(MODEL_DISCOVERY_TIMEOUT_MS),
        },
  ).catch((error: unknown) => {
    throw new Error(
      isTimeoutError(error)
        ? "连接上游超时（15 秒），请检查地址是否可达。"
        : "无法连接上游 API，请检查地址和网络。",
    );
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = extractUpstreamErrorDetail(payload);
    throw new Error(`连接失败：HTTP ${response.status}${detail ? `，${detail}` : ""}`);
  }

  const models = isGemini ? geminiModels(payload) : openAiModels(payload);
  return [...new Set(models)].sort();
}

function modelsBaseUrl(input: ImageModelDiscoveryInput) {
  const trimmed = input.apiBaseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (input.apiBaseUrlMode === "origin") return `${trimmed}/v1`;
  return trimmed.replace(/\/v1\/images$/i, "/v1").replace(/\/images$/i, "");
}

/**
 * 中转站的 /models 往往混返回几百个 chat 模型，下拉里难以挑选；
 * 命中任一规则的模型会在 UI 里分组置顶。规则刻意保守——
 * 漏判的模型仍出现在“其他模型”里，误判却会误导选择。
 */
const IMAGE_MODEL_PATTERNS: RegExp[] = [
  /^gpt-image/i,
  /^dall[- ]?e/i,
  /^imagen/i,
  /^flux/i,
  /^seedream|^seededit/i,
  /^midjourney|^mj[-_]/i,
  /^stable-diffusion|^sd3|^sdxl/i,
  /^nano-banana/i,
  /^qwen-image/i,
  /^grok-2-image/i,
  /^gemini.*image/i,
  // gpt-4o-image、grok-2-image-1212 这类后缀命名
  /[-_.]image\b/i,
];

export function looksLikeImageModel(model: string): boolean {
  const id = model.trim();
  return IMAGE_MODEL_PATTERNS.some((pattern) => pattern.test(id));
}

export function partitionImageModels(models: string[]): {
  imageModels: string[];
  otherModels: string[];
} {
  const imageModels: string[] = [];
  const otherModels: string[] = [];
  for (const model of models) {
    (looksLikeImageModel(model) ? imageModels : otherModels).push(model);
  }
  return { imageModels, otherModels };
}

function openAiModels(payload: unknown) {
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : [];
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => (item && typeof item === "object" && "id" in item ? item.id : ""))
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function geminiModels(payload: unknown) {
  const models =
    payload && typeof payload === "object" && "models" in payload ? payload.models : [];
  if (!Array.isArray(models)) return [];
  return models
    .map((item) => (item && typeof item === "object" && "name" in item ? item.name : ""))
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .map((name) => name.replace(/^models\//, ""));
}
