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
  <main class="cupertino-app flex h-screen text-content antialiased dark:text-content">
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
      :context="studio.settingsModalContext"
      :initial-batch-panel="studio.settingsModal.initialBatchPanel"
      :initial-tab="studio.settingsModal.initialTab"
      :is-open="studio.settingsModal.isOpen"
      @close="studio.settingsModal.close"
      @import-backup="studio.settingsModal.importBackup"
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
