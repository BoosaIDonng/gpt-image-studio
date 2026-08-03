import type { ApiMode, ApiProvider } from "../../../types/studio";
import { editGeminiImage, generateGeminiImage } from "../../../services/geminiImagesApi";
import {
  editGrokImage,
  generateGrokImage,
  generateGrokImages,
} from "../../../services/grokImagesApi";
import { buildPromptRequest } from "../../../services/promptRequest";
import { editImage, generateImage } from "../../../services/imagesApi";
import { validateImageParams } from "../../../services/imageCapabilities";
import type { ImageClient } from "./imageClient";

type DirectClientConfig = {
  getApiProvider: () => ApiProvider;
  getApiBaseUrl: () => string;
  getApiBaseUrlMode: () => "origin" | "full";
  getApiMode: () => ApiMode;
  getApiKey: (provider: ApiProvider) => string;
  getModel: () => string;
  getStreamImages: () => boolean;
  getStreamPartialImages: () => 0 | 1 | 2 | 3;
};

export function createDirectImagesClient(config: DirectClientConfig): ImageClient {
  return {
    canGenerateBatch(input) {
      return (input?.recipe?.apiProvider ?? config.getApiProvider()) === "grok";
    },
    async generate(input) {
      const recipe = input.recipe;
      const provider = recipe?.apiProvider ?? config.getApiProvider();
      const apiBaseUrl = recipe?.apiBaseUrl ?? config.getApiBaseUrl().trim();
      const apiKey = config.getApiKey(provider).trim();
      const model = recipe?.model ?? config.getModel();
      const apiBaseUrlMode = recipe?.apiBaseUrlMode ?? config.getApiBaseUrlMode();
      const apiMode = recipe?.apiMode ?? config.getApiMode();
      requireImageModel(model);
      validateImageParams(provider, apiMode, model, input.params);

      if (!apiKey) {
        throw new Error("请先在设置里填写 OpenAI API key。");
      }

      if (!apiBaseUrl) {
        throw new Error("请先在设置里填写 API Base URL。");
      }

      if (provider === "grok") {
        return generateGrokImage({
          apiBaseUrl,
          apiBaseUrlMode,
          apiKey,
          model,
          prompt: buildPromptRequest(input),
          params: input.params,
          signal: input.signal,
        });
      }

      if (provider === "gemini") {
        return generateGeminiImage({
          apiBaseUrl,
          apiBaseUrlMode,
          apiKey,
          model,
          prompt: buildPromptRequest(input),
          params: input.params,
          signal: input.signal,
        });
      }

      return generateImage({
        apiBaseUrl,
        apiBaseUrlMode,
        apiMode,
        apiKey,
        model,
        prompt: input.prompt,
        promptMode: input.promptRequestSettings.promptMode,
        promptWordbanks: input.promptRequestSettings.promptWordbanks,
        promptRewriteGuardEnabled: input.promptRequestSettings.promptRewriteGuardEnabled,
        promptRewriteGuardText: input.promptRequestSettings.promptRewriteGuardText,
        ragContext: input.promptRequestSettings.ragContext,
        streamImages: config.getStreamImages(),
        streamPartialImages: config.getStreamPartialImages(),
        onPartialImage: input.onPartialImage,
        signal: input.signal,
        params: input.params,
      });
    },
    async generateBatch(input) {
      const recipe = input.recipe;
      const provider = recipe?.apiProvider ?? config.getApiProvider();
      const apiBaseUrl = recipe?.apiBaseUrl ?? config.getApiBaseUrl().trim();
      const apiKey = config.getApiKey(provider).trim();
      const model = recipe?.model ?? config.getModel();
      const apiBaseUrlMode = recipe?.apiBaseUrlMode ?? config.getApiBaseUrlMode();
      const apiMode = recipe?.apiMode ?? config.getApiMode();
      requireImageModel(model);
      validateImageParams(provider, apiMode, model, input.params);

      if (!apiKey) {
        throw new Error("请先在设置里填写 OpenAI API key。");
      }

      if (!apiBaseUrl) {
        throw new Error("请先在设置里填写 API Base URL。");
      }

      if (provider !== "grok") {
        throw new Error("当前供应商不支持批量单请求生成。");
      }

      return generateGrokImages({
        apiBaseUrl,
        apiBaseUrlMode,
        apiKey,
        model,
        prompt: buildPromptRequest(input),
        params: input.params,
        count: input.count,
        signal: input.signal,
      });
    },
    async edit(input) {
      const recipe = input.recipe;
      const provider = recipe?.apiProvider ?? config.getApiProvider();
      const apiBaseUrl = recipe?.apiBaseUrl ?? config.getApiBaseUrl().trim();
      const apiKey = config.getApiKey(provider).trim();
      const model = recipe?.model ?? config.getModel();
      const apiBaseUrlMode = recipe?.apiBaseUrlMode ?? config.getApiBaseUrlMode();
      const apiMode = recipe?.apiMode ?? config.getApiMode();
      requireImageModel(model);
      validateImageParams(provider, apiMode, model, input.params);

      if (!apiKey) {
        throw new Error("请先在设置里填写 OpenAI API key。");
      }

      if (!apiBaseUrl) {
        throw new Error("请先在设置里填写 API Base URL。");
      }

      if (provider === "grok") {
        return editGrokImage({
          apiBaseUrl,
          apiBaseUrlMode,
          apiKey,
          model,
          prompt: buildPromptRequest(input),
          params: input.params,
          images: input.images,
          mask: input.mask,
          signal: input.signal,
        });
      }

      if (provider === "gemini") {
        return editGeminiImage({
          apiBaseUrl,
          apiBaseUrlMode,
          apiKey,
          model,
          prompt: buildPromptRequest(input),
          params: input.params,
          images: input.images,
          mask: input.mask,
          signal: input.signal,
        });
      }

      return editImage({
        apiBaseUrl,
        apiBaseUrlMode,
        apiMode,
        apiKey,
        model,
        prompt: input.prompt,
        promptMode: input.promptRequestSettings.promptMode,
        promptWordbanks: input.promptRequestSettings.promptWordbanks,
        promptRewriteGuardEnabled: input.promptRequestSettings.promptRewriteGuardEnabled,
        promptRewriteGuardText: input.promptRequestSettings.promptRewriteGuardText,
        ragContext: input.promptRequestSettings.ragContext,
        streamImages: config.getStreamImages(),
        streamPartialImages: config.getStreamPartialImages(),
        onPartialImage: input.onPartialImage,
        signal: input.signal,
        params: input.params,
        images: input.images,
        mask: input.mask,
      });
    },
  };
}

function requireImageModel(model: string) {
  if (!model.trim()) throw new Error("请先获取并选择图片模型。");
}
