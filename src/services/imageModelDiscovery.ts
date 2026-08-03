import type { ApiBaseUrlMode, ApiMode, ApiProvider } from "../types/studio";

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
  const response = await fetch(
    isGemini ? `${baseUrl}/models?key=${encodeURIComponent(apiKey)}` : `${baseUrl}/models`,
    isGemini ? undefined : { headers: { Authorization: `Bearer ${apiKey}` } },
  ).catch(() => {
    throw new Error("无法连接上游 API，请检查地址和网络。");
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = readErrorMessage(payload);
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

function openAiModels(payload: unknown) {
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : [];
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => (item && typeof item === "object" && "id" in item ? item.id : ""))
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function geminiModels(payload: unknown) {
  const models = payload && typeof payload === "object" && "models" in payload ? payload.models : [];
  if (!Array.isArray(models)) return [];
  return models
    .map((item) => (item && typeof item === "object" && "name" in item ? item.name : ""))
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .map((name) => name.replace(/^models\//, ""));
}

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = "error" in payload ? payload.error : undefined;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "message" in payload && typeof payload.message === "string" ? payload.message : "";
}
