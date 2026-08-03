<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted } from "vue";
import ChatWorkspace from "./components/studio/ChatWorkspace.vue";
import ConversationSidebar from "./components/studio/ConversationSidebar.vue";
import ImageLibrary from "./components/studio/ImageLibrary.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";
import FloatingChat from "./components/studio/FloatingChat.vue";
import NoticeToast from "./components/ui/NoticeToast.vue";
import RenameDialog from "./components/ui/RenameDialog.vue";
import { useStudioViewModel } from "./app/studio";
import { useDarkMode } from "./composables/useDarkMode";

// 模态框懒加载：这些组件只在用户主动操作时才需要，
// 用 defineAsyncComponent 拆成独立 chunk，减少首屏加载体积。
const SettingsModal = defineAsyncComponent(() => import("./components/studio/SettingsModal.vue"));
const ImagePreviewModal = defineAsyncComponent(
  () => import("./components/studio/ImagePreviewModal.vue"),
);
const ExpandPreviewModal = defineAsyncComponent(
  () => import("./components/ui/ExpandPreviewModal.vue"),
);

const studio = useStudioViewModel();
// useDarkMode 内部自行设置 HTML class，无需在 script 中使用返回值
useDarkMode();

// 全局快捷键
function handleGlobalKeydown(e: KeyboardEvent) {
  // Ctrl+K / Cmd+K → 打开设置
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    if (studio.settingsModal.isOpen) {
      studio.settingsModal.close();
    } else {
      studio.settingsModal.open();
    }
  }
  // Escape → 关闭当前最上层模态框
  if (e.key === "Escape") {
    if (studio.settingsModal.isOpen) {
      studio.settingsModal.close();
    } else if (studio.preview.image) {
      studio.preview.close();
    } else if (studio.expandPreview.value) {
      // expandPreview 没有直接 close，忽略
    }
  }
}

onMounted(() => document.addEventListener("keydown", handleGlobalKeydown));
onUnmounted(() => document.removeEventListener("keydown", handleGlobalKeydown));
</script>

<template>
  <main class="cupertino-app flex h-screen text-gray-900 antialiased dark:text-gray-100">
    <ConversationSidebar
      @create-conversation="studio.sidebar.createConversation"
      @delete-conversation="studio.sidebar.deleteConversation"
      @rename-conversation="studio.sidebar.renameConversation"
      @open-settings="studio.sidebar.openSettings"
      @select-conversation="studio.sidebar.selectConversation"
    />

    <ChatWorkspace
      :actions="studio.chat.actions"
      :header="studio.chat.header"
      :messages="studio.chat.messages"
    />

    <ImageLibrary
      @open-batch-operations="studio.library.openBatchOperations"
      @preview-image="studio.library.previewImage"
      @rename-image="studio.library.renameImage"
    />

    <SettingsModal
      v-model:api-provider="studio.settingsModal.apiProvider"
      v-model:api-base-url="studio.settingsModal.apiBaseUrl"
      v-model:api-base-url-mode="studio.settingsModal.apiBaseUrlMode"
      v-model:api-mode="studio.settingsModal.apiMode"
      v-model:api-key="studio.settingsModal.apiKey"
      v-model:connection-mode="studio.settingsModal.connectionMode"
      v-model:model="studio.settingsModal.model"
      v-model:stream-images="studio.settingsModal.streamImages"
      v-model:stream-partial-images="studio.settingsModal.streamPartialImages"
      :auto-retry-on-network-error="studio.settingsModal.autoRetryOnNetworkError"
      :prompt-expand-enabled="studio.settingsModal.promptExpandEnabled"
      :chat-api-key="studio.settingsModal.chatApiKey"
      :chat-api-base-url="studio.settingsModal.chatApiBaseUrl"
      :chat-model="studio.settingsModal.chatModel"
      :chat-system-prompt="studio.settingsModal.chatSystemPrompt"
      :companion-paired="studio.settingsModal.companionPaired"
      :companion-session-token="studio.settingsModal.companionSessionToken"
      :companion-url="studio.settingsModal.companionUrl"
      :favorite-prompts="studio.settingsModal.favoritePrompts"
      :prompt-mode="studio.settingsModal.promptMode"
      :prompt-wordbanks="studio.settingsModal.promptWordbanks"
      :rag-enabled="studio.settingsModal.ragEnabled"
      :rag-top-k="studio.settingsModal.ragTopK"
      :prompt-rewrite-guard-enabled="studio.settingsModal.promptRewriteGuardEnabled"
      :prompt-rewrite-guard-history="studio.settingsModal.promptRewriteGuardHistory"
      :prompt-rewrite-guard-text="studio.settingsModal.promptRewriteGuardText"
      :conversations="studio.settingsModal.conversations"
      :images="studio.settingsModal.images"
      :initial-batch-panel="studio.settingsModal.initialBatchPanel"
      :initial-tab="studio.settingsModal.initialTab"
      :is-open="studio.settingsModal.isOpen"
      :messages="studio.settingsModal.messages"
      @close="studio.settingsModal.close"
      @delete-conversations="studio.settingsModal.deleteConversations"
      @delete-images="studio.settingsModal.deleteImages"
      @delete-favorite-prompt="studio.settingsModal.deleteFavoritePrompt"
      @delete-prompt-rewrite-guard-history-item="
        studio.settingsModal.deletePromptRewriteGuardHistoryItem
      "
      @export-backup="studio.settingsModal.exportBackup"
      @import-backup="studio.settingsModal.importBackup"
      @preview-image="studio.settingsModal.previewImage"
      @restore-default-prompt-rewrite-guard-text="
        studio.settingsModal.restoreDefaultPromptRewriteGuardText
      "
      @restore-default-prompt-wordbank="studio.settingsModal.restoreDefaultPromptWordbank"
      @restore-prompt-rewrite-guard-history-item="
        studio.settingsModal.restorePromptRewriteGuardHistoryItem
      "
      @save-prompt-rewrite-guard-text="studio.settingsModal.savePromptRewriteGuardText"
      @save-prompt-wordbank="studio.settingsModal.savePromptWordbank"
      @add-favorite-prompt="studio.settingsModal.addFavoritePrompt"
      @set-prompt-rewrite-guard-enabled="studio.settingsModal.setPromptRewriteGuardEnabled"
      @update-favorite-prompt="studio.settingsModal.updateFavoritePrompt"
      @update:companion-session-token="studio.settingsModal.companionSessionToken = $event"
      @update:auto-retry-on-network-error="studio.settingsModal.setAutoRetryOnNetworkError($event)"
      @update:prompt-expand-enabled="studio.settingsModal.setPromptExpandEnabled($event)"
      @update:chat-api-key="studio.settingsModal.setChatApiKey($event)"
      @update:chat-api-base-url="studio.settingsModal.setChatApiBaseUrl($event)"
      @update:chat-model="studio.settingsModal.setChatModel($event)"
      @update:chat-system-prompt="studio.settingsModal.setChatSystemPrompt($event)"
      @update:prompt-mode="studio.settingsModal.setPromptMode"
      @update:rag-enabled="studio.settingsModal.setRagEnabled"
      @update:rag-top-k="studio.settingsModal.setRagTopK"
    />

    <ExpandPreviewModal
      v-if="studio.expandPreview.value"
      :original-prompt="studio.expandPreview.value!.originalPrompt"
      :expanded-prompt="studio.expandPreview.value!.expandedPrompt"
      @confirm="
        (action: string, text?: string) =>
          studio.expandPreview.value?.onConfirm(action as any, text)
      "
    />

    <ImagePreviewModal
      :image="studio.preview.image"
      :mask-url="studio.preview.maskUrl"
      @close="studio.preview.close"
      @edit-image="studio.preview.editImage"
    />

    <NoticeToast :notice="studio.noticeToast.notice" @close="studio.noticeToast.close" />

    <RenameDialog
      :confirm-label="studio.renameModal.confirmLabel"
      :description="studio.renameModal.description"
      :initial-value="studio.renameModal.initialValue"
      :is-open="studio.renameModal.isOpen"
      :title="studio.renameModal.title"
      @cancel="studio.renameModal.cancel"
      @confirm="studio.renameModal.confirm"
    />
    <RenameDialog
      :confirm-label="studio.renameImageModal.confirmLabel"
      :description="studio.renameImageModal.description"
      :initial-value="studio.renameImageModal.initialValue"
      :is-open="studio.renameImageModal.isOpen"
      :title="studio.renameImageModal.title"
      @cancel="studio.renameImageModal.cancel"
      @confirm="studio.renameImageModal.confirm"
    />

    <ConfirmDialog
      :dialog="studio.confirmDialog.dialog"
      @cancel="studio.confirmDialog.cancel"
      @confirm="studio.confirmDialog.confirm"
    />

    <FloatingChat />
  </main>
</template>
