import {
  normalizeGenerationParams,
  type StoredGenerationParams,
} from "./generationParams";
import {
  PROMPT_REWRITE_GUARD_PREFIX,
  normalizePromptRewriteGuardText,
} from "./imagesApi";
import { normalizeFavoritePrompts } from "./favoritePrompts";
import { normalizePromptWordbanks } from "./promptWordbanks";
import { GEMINI_IMAGE_MODEL, defaultModelForProvider } from "../shared/models";
import type {
  ApiMode,
  ApiBaseUrlMode,
  ApiProvider,
  AppSettings,
  ConnectionMode,
  PromptMode,
  PromptRewriteGuardHistoryItem,
} from "../types/studio";
import { getFromStore, putInStore, STORE_NAMES } from "./db";

const SETTINGS_KEY = "app";

type SettingsRecord = {
  key: typeof SETTINGS_KEY;
  value: StoredAppSettings;
};

export async function loadSettings() {
  const record = await getFromStore<SettingsRecord>(
    STORE_NAMES.settings,
    SETTINGS_KEY,
  );

  if (!record?.value) return undefined;

  return normalizeSettings(record.value);
}

export function saveSettings(settings: AppSettings) {
  return putInStore<SettingsRecord>(STORE_NAMES.settings, {
    key: SETTINGS_KEY,
    value: {
      ...settings,
      model: normalizeModel(settings.apiProvider, settings.model),
    },
  });
}

type StoredAppSettings = Omit<
  AppSettings,
  | "connectionMode"
  | "apiProvider"
  | "apiBaseUrlMode"
  | "apiMode"
  | "streamImages"
  | "streamPartialImages"
  | "promptMode"
  | "promptWordbanks"
  | "promptRewriteGuardEnabled"
  | "promptRewriteGuardText"
  | "promptRewriteGuardHistory"
  | "favoritePrompts"
  | "ragEnabled"
  | "ragTopK"
> & {
  connectionMode?: ConnectionMode;
  apiProvider?: ApiProvider;
  apiBaseUrlMode?: ApiBaseUrlMode;
  apiMode?: ApiMode;
  streamImages?: boolean;
  streamPartialImages?: number;
  promptRewriteGuardEnabled?: boolean;
  promptRewriteGuardText?: string;
  promptRewriteGuardHistory?: PromptRewriteGuardHistoryItem[];
  favoritePrompts?: unknown;
  ragEnabled?: boolean;
  ragTopK?: unknown;
  promptMode?: PromptMode;
  promptWordbanks?: unknown;
  defaults: StoredGenerationParams;
};

function normalizeSettings(settings: StoredAppSettings): AppSettings {
  const apiProvider = normalizeApiProvider(settings.apiProvider);
  const promptRewriteGuardText = normalizePromptRewriteGuardText(
    settings.promptRewriteGuardText,
  );
  return {
    ...settings,
    connectionMode: settings.connectionMode ?? "direct",
    apiProvider,
    apiBaseUrlMode: settings.apiBaseUrlMode === "full" ? "full" : "origin",
    apiMode: settings.apiMode === "responses" ? "responses" : "images",
    streamImages: settings.streamImages ?? false,
    streamPartialImages: normalizeStreamPartialImages(
      settings.streamPartialImages,
    ),
    model: normalizeModel(apiProvider, settings.model),
    promptMode: normalizePromptMode(settings.promptMode),
    promptWordbanks: normalizePromptWordbanks(settings.promptWordbanks),
    promptRewriteGuardEnabled: settings.promptRewriteGuardEnabled ?? true,
    promptRewriteGuardText,
    promptRewriteGuardHistory:
      settings.promptRewriteGuardHistory ?? [
        {
          id: "prompt-guard-default",
          text: PROMPT_REWRITE_GUARD_PREFIX,
          createdAt: new Date(0).toISOString(),
        },
      ],
    favoritePrompts: normalizeFavoritePrompts(settings.favoritePrompts),
    ragEnabled: settings.ragEnabled ?? false,
    ragTopK: normalizeRagTopK(settings.ragTopK),
    defaults: normalizeGenerationParams(settings.defaults),
  };
}

function normalizeApiProvider(provider: ApiProvider | undefined): ApiProvider {
  if (provider === "grok") return "grok";
  if (provider === "gemini") return "gemini";
  return "openai";
}

function normalizeModel(provider: ApiProvider, model: string | undefined) {
  const trimmed = model?.trim();
  if (provider === "gemini" && trimmed === "gemini-3.1-flash-image") {
    return GEMINI_IMAGE_MODEL;
  }
  return trimmed || defaultModelForProvider(provider);
}

function normalizeStreamPartialImages(value: unknown): 0 | 1 | 2 | 3 {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(3, Math.max(0, Math.trunc(numeric))) as 0 | 1 | 2 | 3;
}

function normalizePromptMode(mode: PromptMode | undefined): PromptMode {
  if (
    mode === "default" ||
    mode === "safe" ||
    mode === "creative" ||
    mode === "adult"
  ) {
    return mode;
  }

  return "default";
}

function normalizeRagTopK(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 4;
  return Math.min(12, Math.max(1, Math.trunc(numeric)));
}
