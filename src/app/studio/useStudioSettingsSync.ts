import { ref, type Ref } from "vue";
import { formatError } from "../../shared/errors";
import type { PromptMode, PromptWordbankSectionKey } from "../../types/studio";

type SettingsTab =
  | "general"
  | "api"
  | "promptMode"
  | "favoritePrompts"
  | "prompt"
  | "backup"
  | "batch";
type BatchPanel = "images" | "conversations";

export function useStudioSettingsSync(ctx: {
  notifyError: (message: string) => void;
  promptRewriteGuardEnabled: Ref<boolean>;
  autoRetryOnNetworkError: Ref<boolean>;
  promptExpandEnabled: Ref<boolean>;
  chatApiKey: Ref<string>;
  chatApiBaseUrl: Ref<string>;
  chatModel: Ref<string>;
  chatSystemPrompt: Ref<string>;
  promptMode: Ref<PromptMode>;
  ragEnabled: Ref<boolean>;
  ragTopK: Ref<number>;
  savePromptWordbank: (section: PromptWordbankSectionKey, terms: string[]) => void;
  restoreDefaultPromptWordbank: (section: PromptWordbankSectionKey) => void;
  savePromptRewriteGuardText: (text: string) => void;
  restoreDefaultPromptRewriteGuardText: () => void;
  restorePromptRewriteGuardHistoryItem: (id: string) => void;
  deletePromptRewriteGuardHistoryItem: (id: string) => void;
  addFavoritePrompt: (input: { title?: string; text?: string }) => boolean;
  updateFavoritePrompt: (id: string, input: { title?: string; text?: string }) => boolean;
  deleteFavoritePrompt: (id: string) => void;
}) {
  const isSettingsOpen = ref(false);
  const settingsInitialTab = ref<SettingsTab | undefined>(undefined);
  const settingsInitialBatchPanel = ref<BatchPanel>("images");

  function openSettings() {
    isSettingsOpen.value = true;
  }

  function closeSettings() {
    isSettingsOpen.value = false;
  }

  function openBatchImageOperations() {
    settingsInitialTab.value = "batch";
    settingsInitialBatchPanel.value = "images";
    openSettings();
  }

  function openSettingsDefault() {
    settingsInitialTab.value = undefined;
    settingsInitialBatchPanel.value = "images";
    openSettings();
  }

  function openFavoritePromptSettings() {
    settingsInitialTab.value = "favoritePrompts";
    settingsInitialBatchPanel.value = "images";
    openSettings();
  }

  function openApiSettings() {
    settingsInitialTab.value = "api";
    settingsInitialBatchPanel.value = "images";
    openSettings();
  }

  function openApiSettingsFromGenerationError(error: unknown) {
    settingsInitialTab.value = "api";
    settingsInitialBatchPanel.value = "images";
    openSettings();
    ctx.notifyError(formatError(error));
  }

  function setPromptRewriteGuardEnabled(value: boolean) {
    ctx.promptRewriteGuardEnabled.value = value;
  }

  function setAutoRetryOnNetworkError(value: boolean) {
    ctx.autoRetryOnNetworkError.value = value;
  }

  function setPromptExpandEnabled(value: boolean) {
    ctx.promptExpandEnabled.value = value;
  }

  function setChatApiKey(value: string) {
    ctx.chatApiKey.value = value;
  }

  function setChatApiBaseUrl(value: string) {
    ctx.chatApiBaseUrl.value = value;
  }

  function setChatModel(value: string) {
    ctx.chatModel.value = value;
  }

  function setChatSystemPrompt(value: string) {
    ctx.chatSystemPrompt.value = value;
  }

  function setPromptMode(value: PromptMode) {
    ctx.promptMode.value = value;
  }

  function setRagEnabled(value: boolean) {
    ctx.ragEnabled.value = value;
  }

  function setRagTopK(value: number) {
    ctx.ragTopK.value = value;
  }

  function savePromptWordbank(section: PromptWordbankSectionKey, terms: string[]) {
    ctx.savePromptWordbank(section, terms);
  }

  function restoreDefaultPromptWordbank(section: PromptWordbankSectionKey) {
    ctx.restoreDefaultPromptWordbank(section);
  }

  function savePromptRewriteGuardText(text: string) {
    ctx.savePromptRewriteGuardText(text);
  }

  function restoreDefaultPromptRewriteGuardText() {
    ctx.restoreDefaultPromptRewriteGuardText();
  }

  function restorePromptRewriteGuardHistoryItem(id: string) {
    ctx.restorePromptRewriteGuardHistoryItem(id);
  }

  function deletePromptRewriteGuardHistoryItem(id: string) {
    ctx.deletePromptRewriteGuardHistoryItem(id);
  }

  function addFavoritePrompt(input: { title?: string; text?: string }) {
    return ctx.addFavoritePrompt(input);
  }

  function updateFavoritePrompt(id: string, input: { title?: string; text?: string }) {
    return ctx.updateFavoritePrompt(id, input);
  }

  function deleteFavoritePrompt(id: string) {
    ctx.deleteFavoritePrompt(id);
  }

  return {
    isSettingsOpen,
    settingsInitialTab,
    settingsInitialBatchPanel,
    openSettings,
    closeSettings,
    openBatchImageOperations,
    openSettingsDefault,
    openFavoritePromptSettings,
    openApiSettings,
    openApiSettingsFromGenerationError,
    setPromptRewriteGuardEnabled,
    setAutoRetryOnNetworkError,
    setPromptExpandEnabled,
    setChatApiKey,
    setChatApiBaseUrl,
    setChatModel,
    setChatSystemPrompt,
    setPromptMode,
    setRagEnabled,
    setRagTopK,
    savePromptWordbank,
    restoreDefaultPromptWordbank,
    savePromptRewriteGuardText,
    restoreDefaultPromptRewriteGuardText,
    restorePromptRewriteGuardHistoryItem,
    deletePromptRewriteGuardHistoryItem,
    addFavoritePrompt,
    updateFavoritePrompt,
    deleteFavoritePrompt,
  };
}
