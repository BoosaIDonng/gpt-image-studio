import type { Ref } from "vue";
import {
  deleteConversationDraft,
  deleteConversationDrafts,
  loadConversationDraft,
  saveConversationDraft,
} from "../../features/drafts";
import { readJsonStorage, readStorage } from "../../shared/localStorage";
import type {
  ConversationDraft,
  GenerationParams,
  ImageAsset,
  Message,
  SizeResolution,
} from "../../types/studio";

const STORAGE_KEYS = {
  draftComposerText: "gpt-image-studio:draft-composer-text",
  draftAttachments: "gpt-image-studio:draft-attachments",
} as const;

export function useStudioDrafts(ctx: {
  composerText: Ref<string>;
  editModeEnabled: Ref<boolean>;
  activeEditSourceImageId: Ref<string>;
  activeEditMaskImageId: Ref<string>;
  clearEditSelection: () => void;
  activeConversationId: Ref<string>;
  selectConversation: (id: string) => void;
  createConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<unknown>;
  deleteConversations: (ids: string[]) => Promise<unknown>;
  attachedImages: Ref<string[]>;
  imageById: (id: string) => ImageAsset | undefined;
  messages: Ref<Message[]>;
  currentGenerationParams: () => GenerationParams;
  applySizeResolution: (resolution: SizeResolution) => void;
  applySizePreset: (size: GenerationParams["size"]) => void;
  imageWidth: Ref<number>;
  imageHeight: Ref<number>;
  quality: Ref<string>;
  background: Ref<string>;
  outputFormat: Ref<string>;
  notifySuccess: (message: string) => void;
  reportStorageError: (error: unknown) => void;
}) {
  const legacyComposerText = readStorage(STORAGE_KEYS.draftComposerText, "");
  const legacyAttachedImageIds = readJsonStorage<string[]>(STORAGE_KEYS.draftAttachments, []);
  let isApplyingDraft = false;
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let draftSwitchQueue = Promise.resolve();

  function clearConversationDraft() {
    ctx.attachedImages.value = [];
    ctx.composerText.value = "";
    ctx.clearEditSelection();
  }

  function createDefaultDraft(conversationId: string): ConversationDraft {
    return {
      conversationId,
      composerText: "",
      attachedImageIds: [],
      editModeEnabled: false,
      generationParams: ctx.currentGenerationParams(),
      updatedAtMs: Date.now(),
    };
  }

  function createLegacyDraft(conversationId: string): ConversationDraft {
    return {
      conversationId,
      composerText: legacyComposerText,
      attachedImageIds: legacyAttachedImageIds,
      editModeEnabled: false,
      generationParams: ctx.currentGenerationParams(),
      updatedAtMs: Date.now(),
    };
  }

  function applyConversationDraft(draft: ConversationDraft) {
    isApplyingDraft = true;
    ctx.composerText.value = draft.composerText;
    ctx.attachedImages.value = draft.attachedImageIds.filter((id) => Boolean(ctx.imageById(id)));
    ctx.editModeEnabled.value = draft.editModeEnabled;
    ctx.activeEditSourceImageId.value = draft.editSourceImageId ?? "";
    ctx.activeEditMaskImageId.value = draft.editMaskImageId ?? "";
    applyGenerationParams(draft.generationParams);
    isApplyingDraft = false;
  }

  function applyGenerationParams(params: GenerationParams) {
    ctx.applySizeResolution(params.resolution);
    ctx.applySizePreset(params.size);
    ctx.imageWidth.value = params.width;
    ctx.imageHeight.value = params.height;
    ctx.quality.value = params.quality;
    ctx.background.value = params.background;
    ctx.outputFormat.value = params.outputFormat;
  }

  async function copyText(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        copyTextWithTextarea(text);
      }
      ctx.notifySuccess("文本已复制。");
    } catch (error) {
      ctx.notifySuccess("复制失败，请手动选择文本复制。");
      ctx.reportStorageError(error);
    }
  }

  function loadMessageConfig(message: Message) {
    ctx.composerText.value = message.content;
    ctx.attachedImages.value = message.referencedImageIds.filter((id) =>
      Boolean(ctx.imageById(id)),
    );
    ctx.clearEditSelection();
    ctx.editModeEnabled.value = false;

    if (message.generationParams) {
      applyGenerationParams(message.generationParams);
    }

    const conversationId = ctx.activeConversationId.value;
    if (conversationId) {
      void saveConversationDraft(currentConversationDraft(conversationId)).catch(
        ctx.reportStorageError,
      );
    }
    ctx.notifySuccess("已加载到输入面板。");
  }

  function applyUrlDraftOverrides(
    prompt: string | undefined,
    shouldApplyGenerationParams: boolean,
  ) {
    if (prompt === undefined && !shouldApplyGenerationParams) return;

    isApplyingDraft = true;
    if (prompt !== undefined) ctx.composerText.value = prompt;
    if (shouldApplyGenerationParams) {
      applyGenerationParams(ctx.currentGenerationParams());
    }
    isApplyingDraft = false;
    void saveActiveDraft().catch(ctx.reportStorageError);
  }

  function currentConversationDraft(conversationId: string): ConversationDraft {
    return {
      conversationId,
      composerText: ctx.composerText.value,
      attachedImageIds: [...ctx.attachedImages.value],
      editModeEnabled: ctx.editModeEnabled.value,
      editSourceImageId: ctx.activeEditSourceImageId.value || undefined,
      editMaskImageId: ctx.activeEditMaskImageId.value || undefined,
      generationParams: ctx.currentGenerationParams(),
      updatedAtMs: Date.now(),
    };
  }

  function scheduleSaveActiveDraft() {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
    }
    draftSaveTimer = setTimeout(() => {
      draftSaveTimer = null;
      void saveActiveDraft();
    }, 250);
  }

  async function saveActiveDraft() {
    const conversationId = ctx.activeConversationId.value;
    if (!conversationId) return;

    const draft = currentConversationDraft(conversationId);
    await saveConversationDraft(draft).catch(ctx.reportStorageError);
  }

  function selectConversationWithDraft(id: string) {
    draftSwitchQueue = draftSwitchQueue.catch(ctx.reportStorageError).then(async () => {
      await saveActiveDraft();
      ctx.selectConversation(id);
      const nextDraft = await loadConversationDraft(id).catch(ctx.reportStorageError);
      if (nextDraft) {
        applyConversationDraft(nextDraft);
      } else {
        applyConversationDraft(createDefaultDraft(id));
      }
    });
  }

  async function createConversationWithDraft() {
    await saveActiveDraft();
    await ctx.createConversation();
    const id = ctx.activeConversationId.value;
    if (!id) return;
    applyConversationDraft(createDefaultDraft(id));
    await saveConversationDraft(currentConversationDraft(id)).catch(ctx.reportStorageError);
  }

  async function deleteConversationWithDraft(id: string) {
    await ctx.deleteConversation(id);
    await deleteConversationDraft(id).catch(ctx.reportStorageError);

    const activeId = ctx.activeConversationId.value;
    if (!activeId) return;
    const draft = await loadConversationDraft(activeId).catch(ctx.reportStorageError);
    if (draft) {
      applyConversationDraft(draft);
    } else {
      applyConversationDraft(createDefaultDraft(activeId));
    }
  }

  async function deleteConversationsWithDraft(ids: string[]) {
    await ctx.deleteConversations(ids);
    await deleteConversationDrafts(ids).catch(ctx.reportStorageError);

    const activeId = ctx.activeConversationId.value;
    if (!activeId) {
      clearConversationDraft();
      return;
    }

    const draft = await loadConversationDraft(activeId).catch(ctx.reportStorageError);
    if (draft) {
      applyConversationDraft(draft);
    } else {
      applyConversationDraft(createDefaultDraft(activeId));
    }
  }

  /** 加载指定会话的草稿并应用；若无已保存草稿则使用默认/遗留草稿。 */
  async function loadAndApplyDraft(conversationId: string) {
    const draft = await loadConversationDraft(conversationId).catch(ctx.reportStorageError);
    if (draft) {
      applyConversationDraft(draft);
    } else if (legacyComposerText || legacyAttachedImageIds.length) {
      applyConversationDraft(createLegacyDraft(conversationId));
    } else {
      applyConversationDraft(createDefaultDraft(conversationId));
    }
  }

  return {
    clearConversationDraft,
    applyConversationDraft,
    applyGenerationParams,
    copyText,
    loadMessageConfig,
    loadAndApplyDraft,
    selectConversationWithDraft,
    createConversationWithDraft,
    deleteConversationWithDraft,
    deleteConversationsWithDraft,
    saveActiveDraft,
    applyUrlDraftOverrides,
    currentConversationDraft,
    scheduleSaveActiveDraft,
    isApplyingDraft: () => isApplyingDraft,
  };
}

/** 兼容旧浏览器的文本复制（execCommand 已废弃，仅作为 Clipboard API 不可用时的回退）。 */
function copyTextWithTextarea(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
