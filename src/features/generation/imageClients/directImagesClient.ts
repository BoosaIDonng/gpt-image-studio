import type { ApiMode, ApiProvider } from "../../../types/studio";
import { editGeminiImage, generateGeminiImage } from "../../../services/geminiImagesApi";
import { editGrokImage, generateGrokImage, generateGrokImages } from "../../../services/grokImagesApi";
import { buildFinalRequestPrompt } from "../../../services/promptRequest";
import {
  editImage,
  generateImage,
} from "../../../services/imagesApi";
import type { ImageClient } from "./imageClient";

type DirectClientConfig = {
  getApiProvider: () => ApiProvider;
  getApiBaseUrl: () => string;
  getApiBaseUrlMode: () => "origin" | "full";
  getApiMode: () => ApiMode;
  getApiKey: () => string;
  getModel: () => string;
  getStreamImages: () => boolean;
  getStreamPartialImages: () => 0 | 1 | 2 | 3;
};

export function createDirectImagesClient(config: DirectClientConfig): ImageClient {
  return {
    canGenerateBatch() {
      return config.getApiProvider() === "grok";
    },
    async generate(input) {
      const apiBaseUrl = config.getApiBaseUrl().trim();
      const apiKey = config.getApiKey().trim();
      const model = config.getModel();

      if (!apiKey) {
        throw new Error("请先在设置里填写 OpenAI API key。");
      }

      if (!apiBaseUrl) {
        throw new Error("请先在设置里填写 API Base URL。");
      }

      if (config.getApiProvider() === "grok") {
        return generateGrokImage({
          apiBaseUrl,
          apiBaseUrlMode: config.getApiBaseUrlMode(),
          apiKey,
          model,
          prompt: buildFinalRequestPrompt({
            prompt: input.prompt,
            promptMode: input.promptRequestSettings.promptMode,
            promptWordbanks: input.promptRequestSettings.promptWordbanks,
            promptRewriteGuardEnabled:
              input.promptRequestSettings.promptRewriteGuardEnabled,
            promptRewriteGuardText:
              input.promptRequestSettings.promptRewriteGuardText,
            ragContext: input.promptRequestSettings.ragContext,
          }),
          params: input.params,
        });
      }

      if (config.getApiProvider() === "gemini") {
        return generateGeminiImage({
          apiBaseUrl,
          apiBaseUrlMode: config.getApiBaseUrlMode(),
          apiKey,
          model,
          prompt: buildFinalRequestPrompt({
            prompt: input.prompt,
            promptMode: input.promptRequestSettings.promptMode,
            promptWordbanks: input.promptRequestSettings.promptWordbanks,
            promptRewriteGuardEnabled:
              input.promptRequestSettings.promptRewriteGuardEnabled,
            promptRewriteGuardText:
              input.promptRequestSettings.promptRewriteGuardText,
            ragContext: input.promptRequestSettings.ragContext,
          }),
          params: input.params,
        });
      }

      return generateImage({
        apiBaseUrl,
        apiBaseUrlMode: config.getApiBaseUrlMode(),
        apiMode: config.getApiMode(),
        apiKey,
        model,
        prompt: input.prompt,
        promptMode: input.promptRequestSettings.promptMode,
        promptWordbanks: input.promptRequestSettings.promptWordbanks,
        promptRewriteGuardEnabled:
          input.promptRequestSettings.promptRewriteGuardEnabled,
        promptRewriteGuardText:
          input.promptRequestSettings.promptRewriteGuardText,
        ragContext: input.promptRequestSettings.ragContext,
        streamImages: config.getStreamImages(),
        streamPartialImages: config.getStreamPartialImages(),
        onPartialImage: input.onPartialImage,
        params: input.params,
      });
    },
    async generateBatch(input) {
      const apiBaseUrl = config.getApiBaseUrl().trim();
      const apiKey = config.getApiKey().trim();
      const model = config.getModel();

      if (!apiKey) {
        throw new Error("请先在设置里填写 OpenAI API key。");
      }

      if (!apiBaseUrl) {
        throw new Error("请先在设置里填写 API Base URL。");
      }

      if (config.getApiProvider() !== "grok") {
        throw new Error("当前供应商不支持批量单请求生成。");
      }

      return generateGrokImages({
        apiBaseUrl,
        apiBaseUrlMode: config.getApiBaseUrlMode(),
        apiKey,
        model,
        prompt: buildFinalRequestPrompt({
          prompt: input.prompt,
          promptMode: input.promptRequestSettings.promptMode,
          promptWordbanks: input.promptRequestSettings.promptWordbanks,
          promptRewriteGuardEnabled:
            input.promptRequestSettings.promptRewriteGuardEnabled,
          promptRewriteGuardText:
            input.promptRequestSettings.promptRewriteGuardText,
          ragContext: input.promptRequestSettings.ragContext,
        }),
        params: input.params,
        count: input.count,
      });
    },
    async edit(input) {
      const apiBaseUrl = config.getApiBaseUrl().trim();
      const apiKey = config.getApiKey().trim();
      const model = config.getModel();

      if (!apiKey) {
        throw new Error("请先在设置里填写 OpenAI API key。");
      }

      if (!apiBaseUrl) {
        throw new Error("请先在设置里填写 API Base URL。");
      }

      if (config.getApiProvider() === "grok") {
        return editGrokImage({
          apiBaseUrl,
          apiBaseUrlMode: config.getApiBaseUrlMode(),
          apiKey,
          model,
          prompt: buildFinalRequestPrompt({
            prompt: input.prompt,
            promptMode: input.promptRequestSettings.promptMode,
            promptWordbanks: input.promptRequestSettings.promptWordbanks,
            promptRewriteGuardEnabled:
              input.promptRequestSettings.promptRewriteGuardEnabled,
            promptRewriteGuardText:
              input.promptRequestSettings.promptRewriteGuardText,
            ragContext: input.promptRequestSettings.ragContext,
          }),
          params: input.params,
          images: input.images,
          mask: input.mask,
        });
      }

      if (config.getApiProvider() === "gemini") {
        return editGeminiImage({
          apiBaseUrl,
          apiBaseUrlMode: config.getApiBaseUrlMode(),
          apiKey,
          model,
          prompt: buildFinalRequestPrompt({
            prompt: input.prompt,
            promptMode: input.promptRequestSettings.promptMode,
            promptWordbanks: input.promptRequestSettings.promptWordbanks,
            promptRewriteGuardEnabled:
              input.promptRequestSettings.promptRewriteGuardEnabled,
            promptRewriteGuardText:
              input.promptRequestSettings.promptRewriteGuardText,
            ragContext: input.promptRequestSettings.ragContext,
          }),
          params: input.params,
          images: input.images,
          mask: input.mask,
        });
      }

      return editImage({
        apiBaseUrl,
        apiBaseUrlMode: config.getApiBaseUrlMode(),
        apiMode: config.getApiMode(),
        apiKey,
        model,
        prompt: input.prompt,
        promptMode: input.promptRequestSettings.promptMode,
        promptWordbanks: input.promptRequestSettings.promptWordbanks,
        promptRewriteGuardEnabled:
          input.promptRequestSettings.promptRewriteGuardEnabled,
        promptRewriteGuardText:
          input.promptRequestSettings.promptRewriteGuardText,
        ragContext: input.promptRequestSettings.ragContext,
        streamImages: config.getStreamImages(),
        streamPartialImages: config.getStreamPartialImages(),
        onPartialImage: input.onPartialImage,
        params: input.params,
        images: input.images,
        mask: input.mask,
      });
    },
  };
}
