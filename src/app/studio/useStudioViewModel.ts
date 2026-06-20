import { computed, onMounted, proxyRefs, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useStudioBackup, useStudioRestore } from "../../features/backup";
import { useStudioConversations } from "../../features/conversations";
import { useStudioFeedback } from "../../features/feedback";
import {
  createDirectImagesClient,
  createLocalCompanionImagesClient,
  type ImageClient,
  useStudioGeneration,
} from "../../features/generation";
import { useStudioImages } from "../../features/images";
import { useStudioSettings } from "../../features/settings";
import { withNetworkRetry } from "../../services/networkRetry";
import { clonePromptWordbanks } from "../../services/promptWordbanks";
import { collectRagDocuments, retrieveRagContext } from "../../services/rag";
import { saveSettings } from "../../services/settings";
import {
  applyUrlSettings,
  getPromptFromUrlParams,
  hasUrlGenerationParams,
} from "../../services/urlSettings";
import { useComposerStore } from "../../stores/composerStore";
import type { PromptRequestSettings } from "../../types/studio";
import { useStudioDrafts } from "./useStudioDrafts";
import { useStudioImagePreview } from "./useStudioImagePreview";
import { useStudioRenameDialog } from "./useStudioRenameDialog";
import { useStudioSettingsSync } from "./useStudioSettingsSync";

export function useStudioViewModel() {
  const isHydrated = ref(false);
  const settings = useStudioSettings({
    isHydrated,
    onStorageError: reportStorageError,
  });
  const composerState = useComposerStore();
  const {
    activeEditMaskImageId,
    activeEditSourceImageId,
    composerText,
    editModeEnabled,
    isLibraryOpen,
    ragExcludedMatchIds,
  } = storeToRefs(composerState);
  const feedback = useStudioFeedback();

  // ── 子 composable：预览 ──
  // images 在后面创建，先用占位；子 composable 仅在函数调用时访问依赖，不存在时序问题
  // eslint-disable-next-line prefer-const -- 前向引用：声明后延迟赋值
  let images: ReturnType<typeof useStudioImages>;

  const imagePreview = useStudioImagePreview({
    imageById: (id) => images.imageById(id),
    activeAttachments: computed(() => images?.activeAttachments.value ?? []),
    activeEditSourceImageId,
    activeEditMaskImageId,
  });

  // ── 子 composable：重命名 ──
  // eslint-disable-next-line prefer-const -- 前向引用：声明后延迟赋值
  let conversations: ReturnType<typeof useStudioConversations>;

  const renameDialogs = useStudioRenameDialog({
    conversations: computed(() => conversations?.conversations.value ?? []),
    renameConversation: (id, title) => conversations.renameConversation(id, title),
    imageById: (id) => images.imageById(id),
    renameImage: (id, name) => images.renameImage(id, name),
    notifySuccess: feedback.notifySuccess,
  });

  // ── 子 composable：设置同步 ──
  const settingsSync = useStudioSettingsSync({
    saveCurrentSettings: () => settings.saveCurrentSettings(),
    reportStorageError,
    notifyError: feedback.notifyError,
    promptRewriteGuardEnabled: settings.promptRewriteGuardEnabled,
    autoRetryOnNetworkError: settings.autoRetryOnNetworkError,
    promptExpandEnabled: settings.promptExpandEnabled,
    chatApiKey: settings.chatApiKey,
    chatApiBaseUrl: settings.chatApiBaseUrl,
    chatModel: settings.chatModel,
    chatSystemPrompt: settings.chatSystemPrompt,
    promptMode: settings.promptMode,
    ragEnabled: settings.ragEnabled,
    ragTopK: settings.ragTopK,
    savePromptWordbank: (section, terms) => settings.savePromptWordbank(section, terms),
    restoreDefaultPromptWordbank: (section) => settings.restoreDefaultPromptWordbank(section),
    savePromptRewriteGuardText: (text) => settings.savePromptRewriteGuardText(text),
    restoreDefaultPromptRewriteGuardText: () => settings.restoreDefaultPromptRewriteGuardText(),
    restorePromptRewriteGuardHistoryItem: (id) => settings.restorePromptRewriteGuardHistoryItem(id),
    deletePromptRewriteGuardHistoryItem: (id) => settings.deletePromptRewriteGuardHistoryItem(id),
    addFavoritePrompt: (input) => settings.addFavoritePrompt(input),
    updateFavoritePrompt: (id, input) => settings.updateFavoritePrompt(id, input),
    deleteFavoritePrompt: (id) => settings.deleteFavoritePrompt(id),
  });

  // ── 子 composable：草稿（依赖 conversations/images，先用前向引用） ──
  const drafts = useStudioDrafts({
    composerText,
    editModeEnabled,
    activeEditSourceImageId,
    activeEditMaskImageId,
    clearEditSelection: () => composerState.clearEditSelection(),
    activeConversationId: computed(() => conversations?.activeConversationId.value ?? ""),
    selectConversation: (id) => conversations.selectConversation(id),
    createConversation: () => conversations.createConversation(),
    deleteConversation: (id) => conversations.deleteConversation(id),
    deleteConversations: (ids) => conversations.deleteConversations(ids),
    attachedImages: computed({
      get: () => images?.attachedImages.value ?? [],
      set: (v) => {
        if (images) images.attachedImages.value = v;
      },
    }),
    imageById: (id) => images.imageById(id),
    messages: computed(() => conversations?.messages.value ?? []),
    currentGenerationParams: () => settings.currentGenerationParams(),
    applySizeResolution: (resolution) => settings.applySizeResolution(resolution),
    applySizePreset: (size) => settings.applySizePreset(size),
    imageWidth: settings.imageWidth,
    imageHeight: settings.imageHeight,
    quality: settings.quality,
    background: settings.background,
    outputFormat: settings.outputFormat,
    notifySuccess: feedback.notifySuccess,
    reportStorageError,
  });

  // ── 正式创建 conversations / images ──
  conversations = useStudioConversations({
    clearDraft: drafts.clearConversationDraft,
    onStorageError: reportStorageError,
    refreshStorageUsage: () => images.refreshStorageUsage(),
  });

  images = useStudioImages({
    activeConversationId: conversations.activeConversationId,
    messages: conversations.messages,
    onStorageError: reportStorageError,
  });

  // ── Image Client 组装 ──
  const directImagesClient = createDirectImagesClient({
    getApiProvider: () => settings.apiProvider.value,
    getApiBaseUrl: () => settings.apiBaseUrl.value,
    getApiBaseUrlMode: () => settings.apiBaseUrlMode.value,
    getApiMode: () => settings.apiMode.value,
    getApiKey: () => settings.apiKey.value,
    getModel: () => settings.model.value,
    getStreamImages: () => settings.streamImages.value,
    getStreamPartialImages: () => settings.streamPartialImages.value,
  });
  const localCompanionImagesClient = createLocalCompanionImagesClient({
    getCompanionUrl: () => settings.companionUrl.value,
    getSessionToken: () => settings.companionSessionToken.value,
    getApiProvider: () => settings.apiProvider.value,
    getModel: () => settings.model.value,
  });
  const imageClient: ImageClient = {
    canGenerateBatch() {
      if (
        settings.connectionMode.value === "localCompanion" &&
        settings.apiMode.value !== "images"
      ) {
        return false;
      }
      const client =
        settings.connectionMode.value === "localCompanion"
          ? localCompanionImagesClient
          : directImagesClient;
      return client.canGenerateBatch?.() ?? false;
    },
    generate(input) {
      if (
        settings.connectionMode.value === "localCompanion" &&
        settings.apiMode.value !== "images"
      ) {
        throw new Error("本地 Companion 当前仅支持 Images API。");
      }
      const fn = () =>
        settings.connectionMode.value === "localCompanion"
          ? localCompanionImagesClient.generate(input)
          : directImagesClient.generate(input);
      return withNetworkRetry(
        fn,
        () => settings.autoRetryOnNetworkError.value,
        input.onNetworkRetry,
      );
    },
    generateBatch(input) {
      if (
        settings.connectionMode.value === "localCompanion" &&
        settings.apiMode.value !== "images"
      ) {
        throw new Error("本地 Companion 当前仅支持 Images API。");
      }
      const client =
        settings.connectionMode.value === "localCompanion"
          ? localCompanionImagesClient
          : directImagesClient;
      const fn = () =>
        client.generateBatch
          ? client.generateBatch(input)
          : Promise.all(Array.from({ length: input.count }, () => client.generate(input)));
      return withNetworkRetry(
        fn,
        () => settings.autoRetryOnNetworkError.value,
        input.onNetworkRetry,
      );
    },
    edit(input) {
      if (
        settings.connectionMode.value === "localCompanion" &&
        settings.apiMode.value !== "images"
      ) {
        throw new Error("本地 Companion 当前仅支持 Images API。");
      }
      const fn = () =>
        settings.connectionMode.value === "localCompanion"
          ? localCompanionImagesClient.edit(input)
          : directImagesClient.edit(input);
      return withNetworkRetry(
        fn,
        () => settings.autoRetryOnNetworkError.value,
        input.onNetworkRetry,
      );
    },
  };

  // ── RAG 辅助 ──
  function currentPromptRequestSettings(prompt?: string): PromptRequestSettings {
    return {
      promptMode: settings.promptMode.value,
      promptWordbanks: clonePromptWordbanks(settings.promptWordbanks.value),
      promptRewriteGuardEnabled: settings.promptRewriteGuardEnabled.value,
      promptRewriteGuardText: settings.promptRewriteGuardText.value,
      ragContext: ragContextForPrompt(prompt),
    };
  }

  function ragContextForPrompt(prompt?: string) {
    const query = prompt?.trim();
    if (!settings.ragEnabled.value || !query) return undefined;

    return (
      retrieveRagContext({
        query,
        documents: collectRagDocuments({
          wordbanks: settings.promptWordbanks.value,
          imageAssets: images.imageAssets.value,
          favoritePrompts: settings.favoritePrompts.value,
          messages: conversations.messages.value,
        }),
        excludedIds: ragExcludedMatchIds.value,
        topK: settings.ragTopK.value,
      }).context || undefined
    );
  }

  // ── Generation ──
  const generation = useStudioGeneration({
    activeConversationId: conversations.activeConversationId,
    activeConversation: conversations.activeConversation,
    attachedImages: images.attachedImages,
    activeEditMaskImageId,
    activeEditSourceImageId,
    composerText,
    createConversationRecord: conversations.createConversationRecord,
    currentGenerationParams: settings.currentGenerationParams,
    currentPromptRequestSettings,
    customSizeError: settings.customSizeError,
    imageAssets: images.imageAssets,
    imageById: images.imageById,
    imageClient,
    promptExpandEnabled: settings.promptExpandEnabled,
    chatApiKey: settings.chatApiKey,
    chatApiBaseUrl: settings.chatApiBaseUrl,
    chatModel: settings.chatModel,
    chatSystemPrompt: settings.chatSystemPrompt,
    messages: conversations.messages,
    onApiConfigurationError: settingsSync.openApiSettingsFromGenerationError,
    onStorageError: reportStorageError,
    conversationExists: (id: string) =>
      conversations.conversations.value.some((item) => item.id === id),
    persistConversation: conversations.persistConversation,
    refreshStorageUsage: images.refreshStorageUsage,
    updateConversationSummary: conversations.updateConversationSummary,
  });

  // ── Restore / Backup ──
  const { restoreFromStorage } = useStudioRestore({
    activeConversationId: conversations.activeConversationId,
    applySettings: settings.applySettings,
    attachedImages: images.attachedImages,
    conversations: conversations.conversations,
    hydrateImagePreviews: images.hydrateImagePreviews,
    imageAssets: images.imageAssets,
    isHydrated,
    messages: conversations.messages,
    notifyError: feedback.notifyError,
    onStorageError: reportStorageError,
    refreshStorageUsage: images.refreshStorageUsage,
    saveCurrentSettings: settings.saveCurrentSettings,
  });
  const backup = useStudioBackup({
    activeConversationId: conversations.activeConversationId,
    attachedImages: images.attachedImages,
    composerText,
    conversations: conversations.conversations,
    imageAssets: images.imageAssets,
    messages: conversations.messages,
    notifyError: feedback.notifyError,
    notifySuccess: feedback.notifySuccess,
    onStorageError: reportStorageError,
    restoreFromStorage,
  });

  // ── 生命周期 ──
  onMounted(() => {
    void restoreFromStorage().then(async () => {
      const urlSearchParams = new URLSearchParams(window.location.search);
      const urlPrompt = getPromptFromUrlParams(urlSearchParams);
      const shouldApplyUrlGenerationParams = hasUrlGenerationParams(urlSearchParams);

      await applyUrlSettings(
        settings.currentSettings(),
        saveSettings,
        settings.applySettings,
      ).catch(reportStorageError);

      const activeConversationId = conversations.activeConversationId.value;
      if (!activeConversationId) return;

      await drafts.loadAndApplyDraft(activeConversationId);
      drafts.applyUrlDraftOverrides(urlPrompt, shouldApplyUrlGenerationParams);
    });
  });

  watch(
    [
      composerText,
      images.attachedImages,
      settings.activeSizePreset,
      settings.imageWidth,
      settings.imageHeight,
      settings.quality,
      settings.background,
      settings.outputFormat,
      editModeEnabled,
      activeEditSourceImageId,
      activeEditMaskImageId,
      conversations.activeConversationId,
    ],
    () => {
      if (!isHydrated.value || drafts.isApplyingDraft()) return;
      drafts.scheduleSaveActiveDraft();
    },
  );

  watch(composerText, () => {
    composerState.clearRagExclusions();
  });

  // ── 组装返回对象 ──
  const sidebar = proxyRefs({
    createConversation: drafts.createConversationWithDraft,
    deleteConversation: drafts.deleteConversationWithDraft,
    openSettings: settingsSync.openSettingsDefault,
    renameConversation: renameDialogs.renameConversation,
    selectConversation: drafts.selectConversationWithDraft,
  });
  const chatHeader = proxyRefs({
    activeConversation: conversations.activeConversation,
    isLibraryOpen,
  });
  const chatMessages = proxyRefs({
    activeAttachmentIds: imagePreview.attachedImageIds,
    activeMessages: conversations.activeMessages,
  });
  const chatActions = {
    closeAllEditors: composerState.closeAllEditors,
    copyText: drafts.copyText,
    deleteMessage: conversations.deleteSingleMessage,
    generateAnother: generation.generateAnother,
    loadMessageConfig: drafts.loadMessageConfig,
    openConversations: composerState.openConversations,
    openApiSettings: settingsSync.openApiSettings,
    openSettings: settingsSync.openSettingsDefault,
    openFavoritePromptSettings: settingsSync.openFavoritePromptSettings,
    previewImage: imagePreview.previewImageById,
    renameImage: renameDialogs.requestRenameImage,
    removeAttachment: (id: string) => {
      if (id === activeEditSourceImageId.value || id === activeEditMaskImageId.value) {
        const sourceId = activeEditSourceImageId.value;
        const maskId = activeEditMaskImageId.value;
        if (sourceId) {
          images.removeAttachment(sourceId);
        }
        if (maskId && maskId !== sourceId) {
          images.removeAttachment(maskId);
          images.clearTransientMask(maskId);
        }
        composerState.clearEditSelection();
        return;
      }

      images.removeAttachment(id);
    },
    retryMessage: generation.retryMessage,
    refreshImage: generation.refreshGeneratedImage,
    setEditModeEnabled: (value: boolean) => {
      if (!value) {
        if (activeEditMaskImageId.value) {
          images.clearTransientMask(activeEditMaskImageId.value);
        }
      }
      composerState.setEditModeEnabled(value);
    },
    openImageLibrary: composerState.openImageLibrary,
    setLibraryOpen: composerState.setLibraryOpen,
    applyEditSelection: (sourceImageId: string, maskImageId: string) => {
      const previousMaskId = activeEditMaskImageId.value;
      if (previousMaskId && previousMaskId !== maskImageId) {
        images.clearTransientMask(previousMaskId);
      }
      composerState.applyEditSelection(sourceImageId, maskImageId);
      images.attachedImages.value = [sourceImageId, maskImageId];
    },
    clearEditSelection: composerState.clearEditSelection,
    toggleEditor: composerState.toggleEditor,
  };
  const chat = {
    actions: chatActions,
    header: chatHeader,
    messages: chatMessages,
  };
  const library = proxyRefs({
    openBatchOperations: settingsSync.openBatchImageOperations,
    previewImage: imagePreview.previewImageById,
    renameImage: renameDialogs.requestRenameImage,
  });
  const settingsModal = proxyRefs({
    autoRetryOnNetworkError: settings.autoRetryOnNetworkError,
    promptExpandEnabled: settings.promptExpandEnabled,
    chatApiKey: settings.chatApiKey,
    chatApiBaseUrl: settings.chatApiBaseUrl,
    chatModel: settings.chatModel,
    setPromptExpandEnabled: settingsSync.setPromptExpandEnabled,
    setAutoRetryOnNetworkError: settingsSync.setAutoRetryOnNetworkError,
    setChatApiKey: settingsSync.setChatApiKey,
    setChatApiBaseUrl: settingsSync.setChatApiBaseUrl,
    setChatModel: settingsSync.setChatModel,
    setChatSystemPrompt: settingsSync.setChatSystemPrompt,
    chatSystemPrompt: settings.chatSystemPrompt,
    apiProvider: settings.apiProvider,
    apiMode: settings.apiMode,
    apiBaseUrl: settings.apiBaseUrl,
    apiBaseUrlMode: settings.apiBaseUrlMode,
    apiKey: settings.apiKey,
    companionPaired: settings.companionPaired,
    companionSessionToken: settings.companionSessionToken,
    companionUrl: settings.companionUrl,
    connectionMode: settings.connectionMode,
    favoritePrompts: settings.favoritePrompts,
    ragEnabled: settings.ragEnabled,
    ragTopK: settings.ragTopK,
    promptMode: settings.promptMode,
    promptWordbanks: settings.promptWordbanks,
    promptRewriteGuardEnabled: settings.promptRewriteGuardEnabled,
    promptRewriteGuardHistory: settings.promptRewriteGuardHistory,
    promptRewriteGuardText: settings.promptRewriteGuardText,
    close: settingsSync.closeSettings,
    open: settingsSync.openSettingsDefault,
    conversations: conversations.conversations,
    deleteConversations: drafts.deleteConversationsWithDraft,
    deleteImages: images.deleteImages,
    exportBackup: backup.exportBackup,
    images: images.imageAssets,
    importBackup: backup.importBackup,
    initialBatchPanel: settingsSync.settingsInitialBatchPanel,
    initialTab: settingsSync.settingsInitialTab,
    isOpen: settingsSync.isSettingsOpen,
    messages: conversations.messages,
    model: settings.model,
    previewImage: imagePreview.previewImageById,
    deletePromptRewriteGuardHistoryItem: settingsSync.deletePromptRewriteGuardHistoryItem,
    restoreDefaultPromptRewriteGuardText: settingsSync.restoreDefaultPromptRewriteGuardText,
    restorePromptRewriteGuardHistoryItem: settingsSync.restorePromptRewriteGuardHistoryItem,
    savePromptRewriteGuardText: settingsSync.savePromptRewriteGuardText,
    savePromptWordbank: settingsSync.savePromptWordbank,
    setPromptMode: settingsSync.setPromptMode,
    setRagEnabled: settingsSync.setRagEnabled,
    setRagTopK: settingsSync.setRagTopK,
    setPromptRewriteGuardEnabled: settingsSync.setPromptRewriteGuardEnabled,
    streamImages: settings.streamImages,
    streamPartialImages: settings.streamPartialImages,
    addFavoritePrompt: settingsSync.addFavoritePrompt,
    updateFavoritePrompt: settingsSync.updateFavoritePrompt,
    deleteFavoritePrompt: settingsSync.deleteFavoritePrompt,
    restoreDefaultPromptWordbank: settingsSync.restoreDefaultPromptWordbank,
  });
  const preview = proxyRefs({
    close: imagePreview.closePreview,
    editImage: (id: string) => {
      imagePreview.closePreview();
      composerState.selectingEditImageId = id;
    },
    image: imagePreview.previewImage,
    maskUrl: imagePreview.previewMaskUrl,
  });
  const noticeToast = proxyRefs({
    close: feedback.dismissNotice,
    notice: feedback.notice,
  });
  const confirmDialog = proxyRefs({
    cancel: feedback.cancelConfirmDialog,
    confirm: feedback.acceptConfirmDialog,
    dialog: feedback.confirmDialog,
  });
  const renameModal = proxyRefs({
    cancel: renameDialogs.cancelRenameConversation,
    confirm: renameDialogs.confirmRenameConversation,
    confirmLabel: "保存名称",
    description: "重命名后，会话标题不会再被新消息自动覆盖。",
    initialValue: computed(() => renameDialogs.renameDialog.value.initialTitle),
    isOpen: computed(() => renameDialogs.renameDialog.value.isOpen),
    title: "重命名会话",
  });
  const renameImageModal = proxyRefs({
    cancel: renameDialogs.cancelRenameImage,
    confirm: renameDialogs.confirmRenameImage,
    confirmLabel: "保存名称",
    description: "修改后会同步用于图片库展示和下载文件名。",
    initialValue: computed(() => renameDialogs.renameImageDialog.value.initialName),
    isOpen: computed(() => renameDialogs.renameImageDialog.value.isOpen),
    title: "重命名图片",
  });

  return {
    chat,
    confirmDialog,
    expandPreview: generation.expandPreview,
    isExpanding: generation.isExpanding,
    library,
    noticeToast,
    preview,
    renameImageModal,
    renameModal,
    settingsModal,
    sidebar,
  };
}

function reportStorageError(error: unknown) {
  // 注意：此函数在 useStudioViewModel 外部定义，无法直接访问 feedback store。
  // 调用方（useStudioViewModel 内部）应通过 feedback.notifyError 向用户展示通知。
  console.error("[storage] 本地存储访问失败", error);
}
