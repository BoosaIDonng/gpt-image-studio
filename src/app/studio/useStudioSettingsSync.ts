import { ref, type Ref } from "vue";
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
  saveCurrentSettings: () => Promise<void>;
  reportStorageError: (error: unknown) => void;
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

  function persistSettingsChange() {
    void ctx.saveCurrentSettings().catch(ctx.reportStorageError);
  }

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

  function openApiSettingsFromGenerationError() {
    settingsInitialTab.value = "api";
    settingsInitialBatchPanel.value = "images";
    openSettings();
    ctx.notifyError("图片接口认证失败，请检查 API key 和接口地址。");
  }

  function setPromptRewriteGuardEnabled(value: boolean) {
    ctx.promptRewriteGuardEnabled.value = value;
    persistSettingsChange();
  }

  function setAutoRetryOnNetworkError(value: boolean) {
    ctx.autoRetryOnNetworkError.value = value;
    persistSettingsChange();
  }

  function setPromptExpandEnabled(value: boolean) {
    ctx.promptExpandEnabled.value = value;
    persistSettingsChange();
  }

  function setChatApiKey(value: string) {
    ctx.chatApiKey.value = value;
    persistSettingsChange();
  }

  function setChatApiBaseUrl(value: string) {
    ctx.chatApiBaseUrl.value = value;
    persistSettingsChange();
  }

  function setChatModel(value: string) {
    ctx.chatModel.value = value;
    persistSettingsChange();
  }

  function setChatSystemPrompt(value: string) {
    ctx.chatSystemPrompt.value = value;
    persistSettingsChange();
  }

  function setPromptMode(value: PromptMode) {
    ctx.promptMode.value = value;
    persistSettingsChange();
  }

  function setRagEnabled(value: boolean) {
    ctx.ragEnabled.value = value;
    persistSettingsChange();
  }

  function setRagTopK(value: number) {
    ctx.ragTopK.value = value;
    persistSettingsChange();
  }

  function savePromptWordbank(section: PromptWordbankSectionKey, terms: string[]) {
    ctx.savePromptWordbank(section, terms);
    persistSettingsChange();
  }

  function restoreDefaultPromptWordbank(section: PromptWordbankSectionKey) {
    ctx.restoreDefaultPromptWordbank(section);
    persistSettingsChange();
  }

  function savePromptRewriteGuardText(text: string) {
    ctx.savePromptRewriteGuardText(text);
    persistSettingsChange();
  }

  function restoreDefaultPromptRewriteGuardText() {
    ctx.restoreDefaultPromptRewriteGuardText();
    persistSettingsChange();
  }

  function restorePromptRewriteGuardHistoryItem(id: string) {
    ctx.restorePromptRewriteGuardHistoryItem(id);
    persistSettingsChange();
  }

  function deletePromptRewriteGuardHistoryItem(id: string) {
    ctx.deletePromptRewriteGuardHistoryItem(id);
    persistSettingsChange();
  }

  function addFavoritePrompt(input: { title?: string; text?: string }) {
    const didAdd = ctx.addFavoritePrompt(input);
    if (didAdd) persistSettingsChange();
    return didAdd;
  }

  function updateFavoritePrompt(id: string, input: { title?: string; text?: string }) {
    const didUpdate = ctx.updateFavoritePrompt(id, input);
    if (didUpdate) persistSettingsChange();
    return didUpdate;
  }

  function deleteFavoritePrompt(id: string) {
    ctx.deleteFavoritePrompt(id);
    persistSettingsChange();
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
    persistSettingsChange,
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
