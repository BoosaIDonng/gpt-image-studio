import type { ApiMode, ApiProvider } from "../types/studio";

/**
 * Single source of truth for per-model image capabilities.
 *
 * Previously the same rules were hardcoded in three places
 * (imageCapabilities.ts, imageApiRequest.ts, shared/models.ts) and any new
 * model required touching all of them. Declare a rule here instead; unknown
 * models fall back to conservative defaults.
 */
export type ModelCapabilityInput = {
  provider: ApiProvider;
  apiMode: ApiMode;
  model: string;
};

export type ModelCapabilities = {
  background: boolean;
  customSize: boolean;
  outputFormat: boolean;
  quality: boolean;
  transparentBackground: boolean;
  /** Whether the `response_format` request parameter may be sent (dall-e needs it, gpt-image rejects it with HTTP 400). */
  responseFormatParam: boolean;
  streaming: boolean;
};

/** gpt-image-N family (gpt-image-1, gpt-image-2, ...). */
export const GPT_IMAGE_MODEL_PATTERN = /^gpt-image-\d/i;

/**
 * Conservative defaults for unknown providers/models: no optional parameters
 * are sent, so requests stay valid on arbitrary OpenAI-compatible endpoints.
 */
export const CONSERVATIVE_MODEL_CAPABILITIES: ModelCapabilities = {
  background: false,
  customSize: false,
  outputFormat: false,
  quality: false,
  transparentBackground: false,
  responseFormatParam: true,
  streaming: false,
};

type CapabilityRule = {
  id: string;
  match: (input: ModelCapabilityInput) => boolean;
  capabilities: Partial<ModelCapabilities>;
};

const OPENAI_IMAGES_FULL: Partial<ModelCapabilities> = {
  background: true,
  customSize: true,
  outputFormat: true,
  quality: true,
  transparentBackground: true,
  streaming: true,
};

const RULES: CapabilityRule[] = [
  {
    id: "openai-images-gpt-image-2",
    // gpt-image-2 (images API) rejects transparent backgrounds.
    match: ({ provider, apiMode, model }) =>
      provider === "openai" && apiMode === "images" && model.trim() === "gpt-image-2",
    capabilities: {
      ...OPENAI_IMAGES_FULL,
      transparentBackground: false,
      responseFormatParam: false,
    },
  },
  {
    id: "openai-gpt-image-family",
    // gpt-image-N always returns b64_json and rejects response_format.
    match: ({ provider, model }) =>
      provider === "openai" && GPT_IMAGE_MODEL_PATTERN.test(model.trim()),
    capabilities: {
      ...OPENAI_IMAGES_FULL,
      responseFormatParam: false,
    },
  },
  {
    id: "openai-other",
    // Dall-e-style / OpenAI-compatible catch-all. Mirrors the historical
    // behavior: optional params like quality were only ever sent to
    // gpt-image-N, so unknown models keep them off.
    match: ({ provider }) => provider === "openai",
    capabilities: {
      background: true,
      customSize: true,
      outputFormat: true,
      quality: false,
      transparentBackground: true,
      responseFormatParam: true,
      streaming: true,
    },
  },
];

export function resolveModelCapabilities(input: ModelCapabilityInput): ModelCapabilities {
  const rule = RULES.find((candidate) => candidate.match(input));
  return { ...CONSERVATIVE_MODEL_CAPABILITIES, ...(rule?.capabilities ?? {}) };
}

/** Whether the stream-partial-images flow is available for this provider/model. */
export function supportsImageStreaming(input: ModelCapabilityInput): boolean {
  return resolveModelCapabilities(input).streaming;
}
