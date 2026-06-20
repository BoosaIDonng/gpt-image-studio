import type { InjectionKey, Ref } from "vue";
import { inject, provide } from "vue";
import type {
  ApiMode,
  ApiProvider,
  ConnectionMode,
  Conversation,
  FavoritePrompt,
  ImageAsset,
  Message,
  PromptMode,
  PromptWordbankSectionKey,
  PromptWordbanks,
  PromptRewriteGuardHistoryItem,
} from "../../types/studio";

/**
 * SettingsModal 的 provide/inject 上下文。
 * 子面板通过 inject(settingsModalContextKey) 获取，无需层层 props 传递。
 */
export type SettingsModalContext = {
  // ── API 设置 ──
  connectionMode: Ref<ConnectionMode>;
  apiProvider: Ref<ApiProvider>;
  apiBaseUrl: Ref<string>;
  apiBaseUrlMode: Ref<"origin" | "full">;
  apiMode: Ref<ApiMode>;
  apiKey: Ref<string>;
  model: Ref<string>;
  streamImages: Ref<boolean>;
  streamPartialImages: Ref<0 | 1 | 2 | 3>;
  companionUrl: Ref<string>;
  companionSessionToken: Ref<string>;
  companionPaired: Ref<boolean>;
  updateConnectionMode: (value: ConnectionMode) => void;
  updateApiProvider: (value: ApiProvider) => void;
  updateApiBaseUrl: (value: string) => void;
  updateApiBaseUrlMode: (value: "origin" | "full") => void;
  updateApiMode: (value: ApiMode) => void;
  updateApiKey: (value: string) => void;
  updateModel: (value: string) => void;
  updateStreamImages: (value: boolean) => void;
  updateStreamPartialImages: (value: 0 | 1 | 2 | 3) => void;
  updateCompanionSessionToken: (value: string) => void;

  // ── 通用设置 ──
  autoRetryOnNetworkError: Ref<boolean>;
  promptExpandEnabled: Ref<boolean>;
  chatApiKey: Ref<string>;
  chatApiBaseUrl: Ref<string>;
  chatModel: Ref<string>;
  chatSystemPrompt: Ref<string>;
  updateAutoRetryOnNetworkError: (value: boolean) => void;
  updatePromptExpandEnabled: (value: boolean) => void;
  updateChatApiKey: (value: string) => void;
  updateChatApiBaseUrl: (value: string) => void;
  updateChatModel: (value: string) => void;
  updateChatSystemPrompt: (value: string) => void;

  // ── 提示词模式 ──
  promptMode: Ref<PromptMode>;
  promptWordbanks: Ref<PromptWordbanks>;
  ragEnabled: Ref<boolean>;
  ragTopK: Ref<number>;
  updatePromptMode: (value: PromptMode) => void;
  updateRagEnabled: (value: boolean) => void;
  updateRagTopK: (value: number) => void;
  saveWordbank: (section: PromptWordbankSectionKey, terms: string[]) => void;
  restoreDefaultWordbank: (section: PromptWordbankSectionKey) => void;

  // ── 提示词保护 ──
  promptRewriteGuardEnabled: Ref<boolean>;
  promptRewriteGuardText: Ref<string>;
  promptRewriteGuardHistory: Ref<PromptRewriteGuardHistoryItem[]>;
  updatePromptRewriteGuardEnabled: (value: boolean) => void;
  savePromptRewriteGuardText: (value: string) => void;
  restoreDefaultPromptRewriteGuardText: () => void;
  restorePromptRewriteGuardHistoryItem: (id: string) => void;
  deletePromptRewriteGuardHistoryItem: (id: string) => void;

  // ── 常用提示词 ──
  favoritePrompts: Ref<FavoritePrompt[]>;
  addFavoritePrompt: (value: { title: string; text: string }) => void;
  updateFavoritePrompt: (id: string, value: { title: string; text: string }) => void;
  deleteFavoritePrompt: (id: string) => void;

  // ── 数据 ──
  conversations: Ref<Conversation[]>;
  images: Ref<ImageAsset[]>;
  messages: Ref<Message[]>;
  deleteConversations: (ids: string[]) => void;
  deleteImages: (ids: string[]) => void;
  previewImage: (id: string) => void;
  exportBackup: () => void;
  importBackupRequest: (file: File) => void;
};

export const settingsModalContextKey: InjectionKey<SettingsModalContext> =
  Symbol("settingsModalContext");

export function provideSettingsModalContext(ctx: SettingsModalContext) {
  provide(settingsModalContextKey, ctx);
}

export function useSettingsModalContext(): SettingsModalContext {
  const ctx = inject(settingsModalContextKey);
  if (!ctx) {
    throw new Error("useSettingsModalContext must be used within SettingsModal");
  }
  return ctx;
}
