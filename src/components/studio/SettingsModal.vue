<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import { FocusTrap } from "focus-trap-vue";
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
import { provideSettingsModalContext } from "../settings/settingsModalContext";
import ApiSettingsPanel from "../settings/ApiSettingsPanel.vue";
import BackupPanel from "../settings/BackupPanel.vue";
import BatchOperationsPanel from "../settings/BatchOperationsPanel.vue";
import FavoritePromptsPanel from "../settings/FavoritePromptsPanel.vue";
import GeneralSettingsPanel from "../settings/GeneralSettingsPanel.vue";
import PromptGuardSettingsPanel from "../settings/PromptGuardSettingsPanel.vue";
import PromptModeSettingsPanel from "../settings/PromptModeSettingsPanel.vue";
import TutorialSettingsPanel from "../settings/TutorialSettingsPanel.vue";
import ConfirmInputModal from "../ui/ConfirmInputModal.vue";

type SettingsTab =
  | "general"
  | "tutorial"
  | "api"
  | "promptMode"
  | "favoritePrompts"
  | "prompt"
  | "backup"
  | "batch";
type BatchPanel = "images" | "conversations";

const props = defineProps<{
  isOpen: boolean;
  initialBatchPanel?: BatchPanel;
  initialTab?: SettingsTab;
  autoRetryOnNetworkError: boolean;
  promptExpandEnabled: boolean;
  chatApiKey: string;
  chatApiBaseUrl: string;
  chatModel: string;
  chatSystemPrompt: string;
  connectionMode: ConnectionMode;
  apiProvider: ApiProvider;
  apiKey: string;
  apiBaseUrl: string;
  apiBaseUrlMode: "origin" | "full";
  apiMode: ApiMode;
  streamImages: boolean;
  streamPartialImages: 0 | 1 | 2 | 3;
  model: string;
  companionUrl: string;
  companionSessionToken: string;
  companionPaired: boolean;
  promptMode: PromptMode;
  promptWordbanks: PromptWordbanks;
  ragEnabled: boolean;
  ragTopK: number;
  favoritePrompts: FavoritePrompt[];
  promptRewriteGuardEnabled: boolean;
  promptRewriteGuardText: string;
  promptRewriteGuardHistory: PromptRewriteGuardHistoryItem[];
  conversations: Conversation[];
  images: ImageAsset[];
  messages: Message[];
}>();

const emit = defineEmits<{
  close: [];
  deleteConversations: [ids: string[]];
  deleteImages: [ids: string[]];
  exportBackup: [];
  importBackup: [file: File];
  previewImage: [id: string];
  "update:autoRetryOnNetworkError": [value: boolean];
  "update:promptExpandEnabled": [value: boolean];
  "update:chatApiKey": [value: string];
  "update:chatApiBaseUrl": [value: string];
  "update:chatModel": [value: string];
  "update:chatSystemPrompt": [value: string];
  "update:connectionMode": [value: ConnectionMode];
  "update:apiProvider": [value: ApiProvider];
  "update:apiKey": [value: string];
  "update:apiBaseUrl": [value: string];
  "update:apiBaseUrlMode": [value: "origin" | "full"];
  "update:apiMode": [value: ApiMode];
  "update:streamImages": [value: boolean];
  "update:streamPartialImages": [value: 0 | 1 | 2 | 3];
  "update:model": [value: string];
  "update:companionSessionToken": [value: string];
  "update:promptMode": [value: PromptMode];
  "update:ragEnabled": [value: boolean];
  "update:ragTopK": [value: number];
  savePromptWordbank: [section: PromptWordbankSectionKey, terms: string[]];
  restoreDefaultPromptWordbank: [section: PromptWordbankSectionKey];
  addFavoritePrompt: [value: { title: string; text: string }];
  updateFavoritePrompt: [id: string, value: { title: string; text: string }];
  deleteFavoritePrompt: [id: string];
  "update:promptRewriteGuardEnabled": [value: boolean];
  savePromptRewriteGuardText: [value: string];
  restoreDefaultPromptRewriteGuardText: [];
  restorePromptRewriteGuardHistoryItem: [id: string];
  deletePromptRewriteGuardHistoryItem: [id: string];
  setPromptRewriteGuardEnabled: [value: boolean];
}>();

// 通过 provide/inject 向子面板共享数据，消除层层 props 传递
provideSettingsModalContext({
  connectionMode: toRef(props, "connectionMode"),
  apiProvider: toRef(props, "apiProvider"),
  apiBaseUrl: toRef(props, "apiBaseUrl"),
  apiBaseUrlMode: toRef(props, "apiBaseUrlMode"),
  apiMode: toRef(props, "apiMode"),
  apiKey: toRef(props, "apiKey"),
  model: toRef(props, "model"),
  streamImages: toRef(props, "streamImages"),
  streamPartialImages: toRef(props, "streamPartialImages"),
  companionUrl: toRef(props, "companionUrl"),
  companionSessionToken: toRef(props, "companionSessionToken"),
  companionPaired: toRef(props, "companionPaired"),
  updateConnectionMode: (v) => emit("update:connectionMode", v),
  updateApiProvider: (v) => emit("update:apiProvider", v),
  updateApiBaseUrl: (v) => emit("update:apiBaseUrl", v),
  updateApiBaseUrlMode: (v) => emit("update:apiBaseUrlMode", v),
  updateApiMode: (v) => emit("update:apiMode", v),
  updateApiKey: (v) => emit("update:apiKey", v),
  updateModel: (v) => emit("update:model", v),
  updateStreamImages: (v) => emit("update:streamImages", v),
  updateStreamPartialImages: (v) => emit("update:streamPartialImages", v),
  updateCompanionSessionToken: (v) => emit("update:companionSessionToken", v),
  autoRetryOnNetworkError: toRef(props, "autoRetryOnNetworkError"),
  promptExpandEnabled: toRef(props, "promptExpandEnabled"),
  chatApiKey: toRef(props, "chatApiKey"),
  chatApiBaseUrl: toRef(props, "chatApiBaseUrl"),
  chatModel: toRef(props, "chatModel"),
  chatSystemPrompt: toRef(props, "chatSystemPrompt"),
  updateAutoRetryOnNetworkError: (v) => emit("update:autoRetryOnNetworkError", v),
  updatePromptExpandEnabled: (v) => emit("update:promptExpandEnabled", v),
  updateChatApiKey: (v) => emit("update:chatApiKey", v),
  updateChatApiBaseUrl: (v) => emit("update:chatApiBaseUrl", v),
  updateChatModel: (v) => emit("update:chatModel", v),
  updateChatSystemPrompt: (v) => emit("update:chatSystemPrompt", v),
  promptMode: toRef(props, "promptMode"),
  promptWordbanks: toRef(props, "promptWordbanks"),
  ragEnabled: toRef(props, "ragEnabled"),
  ragTopK: toRef(props, "ragTopK"),
  updatePromptMode: (v) => emit("update:promptMode", v),
  updateRagEnabled: (v) => emit("update:ragEnabled", v),
  updateRagTopK: (v) => emit("update:ragTopK", v),
  saveWordbank: (s, t) => emit("savePromptWordbank", s, t),
  restoreDefaultWordbank: (s) => emit("restoreDefaultPromptWordbank", s),
  promptRewriteGuardEnabled: toRef(props, "promptRewriteGuardEnabled"),
  promptRewriteGuardText: toRef(props, "promptRewriteGuardText"),
  promptRewriteGuardHistory: toRef(props, "promptRewriteGuardHistory"),
  updatePromptRewriteGuardEnabled: (v) => emit("update:promptRewriteGuardEnabled", v),
  savePromptRewriteGuardText: (v) => emit("savePromptRewriteGuardText", v),
  restoreDefaultPromptRewriteGuardText: () => emit("restoreDefaultPromptRewriteGuardText"),
  restorePromptRewriteGuardHistoryItem: (id) => emit("restorePromptRewriteGuardHistoryItem", id),
  deletePromptRewriteGuardHistoryItem: (id) => emit("deletePromptRewriteGuardHistoryItem", id),
  favoritePrompts: toRef(props, "favoritePrompts"),
  addFavoritePrompt: (v) => emit("addFavoritePrompt", v),
  updateFavoritePrompt: (id, v) => emit("updateFavoritePrompt", id, v),
  deleteFavoritePrompt: (id) => emit("deleteFavoritePrompt", id),
  conversations: toRef(props, "conversations"),
  images: toRef(props, "images"),
  messages: toRef(props, "messages"),
  deleteConversations: (ids) => emit("deleteConversations", ids),
  deleteImages: (ids) => emit("deleteImages", ids),
  previewImage: (id) => emit("previewImage", id),
  exportBackup: () => emit("exportBackup"),
  importBackupRequest: requestBackupImport,
});

const activeTab = ref<SettingsTab>("general");
const pendingBackupFile = ref<File | null>(null);
const isRestoreConfirmOpen = ref(false);

const tabs: { key: SettingsTab; label: string }[] = [
  { key: "general", label: "通用" },
  { key: "tutorial", label: "教程" },
  { key: "api", label: "接口" },
  { key: "promptMode", label: "提示词模式" },
  { key: "favoritePrompts", label: "常用提示词" },
  { key: "prompt", label: "提示词保护" },
  { key: "backup", label: "数据备份" },
  { key: "batch", label: "批量操作" },
];

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return;
    if (props.initialTab) {
      activeTab.value = props.initialTab;
    }
  },
);

function requestBackupImport(file: File) {
  pendingBackupFile.value = file;
  isRestoreConfirmOpen.value = true;
}

function cancelConfirm() {
  isRestoreConfirmOpen.value = false;
  pendingBackupFile.value = null;
}

function confirmPendingAction() {
  if (pendingBackupFile.value) {
    emit("importBackup", pendingBackupFile.value);
  }

  isRestoreConfirmOpen.value = false;
  pendingBackupFile.value = null;
}

// 注意：BackupPanel 的 importBackupRequest 已通过 context 调用 requestBackupImport，
// 无需再从 emit 转发。此处保留 emit("importBackup") 用于确认后的最终导入。
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3"
      role="presentation"
      @mousedown.self="emit('close')"
    >
      <FocusTrap :active="isOpen" :initial-focus="() => false">
        <section
          aria-labelledby="settingsTitle"
          aria-modal="true"
          class="flex h-[min(88vh,44rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-xl"
          role="dialog"
        >
        <div
          class="flex items-start justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4"
        >
          <div>
            <h2 id="settingsTitle" class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              设置
            </h2>
          </div>
          <button
            class="cursor-pointer rounded-lg p-1 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="关闭设置"
            type="button"
            @click="emit('close')"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            class="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 md:w-44 md:flex-col md:border-r md:border-b-0"
            aria-label="设置分类"
          >
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
              "
              type="button"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div
            class="flex min-h-0 flex-1 flex-col p-5"
            :class="activeTab === 'favoritePrompts' ? 'overflow-hidden' : 'overflow-y-auto'"
          >
            <GeneralSettingsPanel v-if="activeTab === 'general'" />

            <TutorialSettingsPanel v-else-if="activeTab === 'tutorial'" />

            <ApiSettingsPanel v-else-if="activeTab === 'api'" />

            <PromptModeSettingsPanel v-else-if="activeTab === 'promptMode'" />

            <FavoritePromptsPanel v-else-if="activeTab === 'favoritePrompts'" />

            <div v-else-if="activeTab === 'prompt'" class="space-y-8">
              <PromptGuardSettingsPanel />
            </div>

            <BackupPanel v-else-if="activeTab === 'backup'" />

            <BatchOperationsPanel
              v-else
              :initial-batch-panel="initialBatchPanel"
              :is-open="isOpen"
            />
          </div>
        </div>

        <div class="flex justify-end border-t border-gray-200 dark:border-gray-700 px-5 py-4">
          <button
            class="cursor-pointer rounded-lg bg-black dark:bg-gray-100 px-5 py-2 text-sm font-medium text-white dark:text-gray-900 transition-colors hover:bg-gray-800 dark:hover:bg-gray-300"
            type="button"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>
        </section>
      </FocusTrap>
    </div>
  </Teleport>

  <ConfirmInputModal
    confirm-label="恢复备份"
    confirm-text="我确认恢复备份并覆盖当前数据"
    description="恢复备份会覆盖当前浏览器里的所有会话、消息和图片。API key 不会从备份中恢复。"
    :is-open="isRestoreConfirmOpen"
    title="恢复备份"
    @cancel="cancelConfirm"
    @confirm="confirmPendingAction"
  />
</template>
