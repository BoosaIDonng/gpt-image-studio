import { ref } from "vue";
import { defineStore } from "pinia";
import type { EditorKey } from "../types/studio";
import { readStorage, writeStorage } from "../shared/localStorage";

export type ImageLibraryScope = "current" | "all";
export type ImageLibraryViewMode = "grid" | "list";

const UI_STORAGE_KEYS = {
  sidebarCollapsed: "gpt-image-studio:ui:sidebar-collapsed",
  libraryCollapsed: "gpt-image-studio:ui:library-collapsed",
  libraryViewMode: "gpt-image-studio:ui:library-view-mode",
  sidebarWidth: "gpt-image-studio:ui:sidebar-width",
} as const;

export const useComposerStore = defineStore("composer", () => {
  const activeEditor = ref<EditorKey | null>(null);
  const composerText = ref("");
  const editModeEnabled = ref(false);
  const activeEditSourceImageId = ref("");
  const activeEditMaskImageId = ref("");
  const isLibraryOpen = ref(false);
  const isLibraryCollapsed = ref(readStorage(UI_STORAGE_KEYS.libraryCollapsed, "0") === "1");
  const imageLibraryViewMode = ref<ImageLibraryViewMode>(
    readStorage(UI_STORAGE_KEYS.libraryViewMode, "grid") === "list" ? "list" : "grid",
  );
  const imageLibraryScope = ref<ImageLibraryScope>("current");
  const isConversationSidebarOpen = ref(false);
  const isConversationSidebarCollapsed = ref(
    readStorage(UI_STORAGE_KEYS.sidebarCollapsed, "0") === "1",
  );
  const sidebarWidth = ref(
    normalizeSidebarWidth(Number(readStorage(UI_STORAGE_KEYS.sidebarWidth, "280"))),
  );
  const selectingEditImageId = ref("");
  const ragExcludedMatchIds = ref<string[]>([]);
  const isPromptPreviewOpen = ref(false);

  function toggleEditor(key: EditorKey) {
    activeEditor.value = activeEditor.value === key ? null : key;
  }

  function closeAllEditors() {
    activeEditor.value = null;
  }

  function setEditModeEnabled(value: boolean) {
    editModeEnabled.value = value;
    if (!value) {
      clearEditSelection();
    }
  }

  function applyEditSelection(sourceImageId: string, maskImageId: string) {
    activeEditSourceImageId.value = sourceImageId;
    activeEditMaskImageId.value = maskImageId;
  }

  function clearEditSelection() {
    activeEditSourceImageId.value = "";
    activeEditMaskImageId.value = "";
  }

  function openConversations() {
    setConversationSidebarOpen(true);
    setConversationSidebarCollapsed(false);
  }

  function setConversationSidebarOpen(value: boolean) {
    isConversationSidebarOpen.value = value;
    if (value) isLibraryOpen.value = false;
  }

  function setConversationSidebarCollapsed(value: boolean) {
    isConversationSidebarCollapsed.value = value;
    writeStorage(UI_STORAGE_KEYS.sidebarCollapsed, value ? "1" : "0");
  }

  function setLibraryOpen(value: boolean) {
    isLibraryOpen.value = value;
    if (value) isConversationSidebarOpen.value = false;
  }

  function setSidebarWidth(value: number) {
    sidebarWidth.value = normalizeSidebarWidth(value);
    writeStorage(UI_STORAGE_KEYS.sidebarWidth, String(sidebarWidth.value));
  }

  function setLibraryCollapsed(value: boolean) {
    isLibraryCollapsed.value = value;
    writeStorage(UI_STORAGE_KEYS.libraryCollapsed, value ? "1" : "0");
  }

  function setImageLibraryViewMode(value: ImageLibraryViewMode) {
    imageLibraryViewMode.value = value;
    writeStorage(UI_STORAGE_KEYS.libraryViewMode, value);
  }

  function openImageLibrary(scope: ImageLibraryScope = "current") {
    imageLibraryScope.value = scope;
    setLibraryOpen(true);
    setLibraryCollapsed(false);
  }

  function openPromptPreview() {
    isPromptPreviewOpen.value = true;
  }

  function closePromptPreview() {
    isPromptPreviewOpen.value = false;
  }

  function excludeRagMatch(id: string) {
    if (!ragExcludedMatchIds.value.includes(id)) {
      ragExcludedMatchIds.value.push(id);
    }
  }

  function restoreRagMatch(id: string) {
    ragExcludedMatchIds.value = ragExcludedMatchIds.value.filter((item) => item !== id);
  }

  function clearRagExclusions() {
    ragExcludedMatchIds.value = [];
  }

  return {
    activeEditor,
    activeEditMaskImageId,
    activeEditSourceImageId,
    composerText,
    editModeEnabled,
    isConversationSidebarOpen,
    isLibraryOpen,
    imageLibraryScope,
    imageLibraryViewMode,
    sidebarWidth,
    isConversationSidebarCollapsed,
    isPromptPreviewOpen,
    isLibraryCollapsed,
    ragExcludedMatchIds,
    selectingEditImageId,
    applyEditSelection,
    clearEditSelection,
    closeAllEditors,
    closePromptPreview,
    clearRagExclusions,
    excludeRagMatch,
    openConversations,
    openImageLibrary,
    openPromptPreview,
    restoreRagMatch,
    setConversationSidebarOpen,
    setConversationSidebarCollapsed,
    setImageLibraryViewMode,
    setLibraryCollapsed,
    setSidebarWidth,
    setEditModeEnabled,
    setLibraryOpen,
    toggleEditor,
  };
});

function normalizeSidebarWidth(value: number) {
  return Number.isFinite(value) && value >= 240 && value <= 360 ? Math.round(value) : 280;
}
