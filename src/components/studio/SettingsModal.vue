<script setup lang="ts">
import { ref, watch } from "vue";
import { FocusTrap } from "focus-trap-vue";
import {
  provideSettingsModalContext,
  type SettingsPanelsContext,
} from "../settings/settingsModalContext";
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

// Panel data arrives as one typed context from the page orchestration boundary
// instead of dozens of forwarding props/events.
const props = defineProps<{
  isOpen: boolean;
  context: SettingsPanelsContext;
  initialBatchPanel?: BatchPanel;
  initialTab?: SettingsTab;
}>();

const emit = defineEmits<{
  close: [];
  importBackup: [file: File];
}>();

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

// The restore confirm step lives in this modal, so the request callback is
// completed here rather than supplied by the orchestration boundary.
provideSettingsModalContext({
  ...props.context,
  importBackupRequest: requestBackupImport,
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="cupertino-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center px-3"
      role="presentation"
      @mousedown.self="emit('close')"
    >
      <FocusTrap :active="isOpen" :initial-focus="() => false">
        <section
          aria-labelledby="settingsTitle"
          aria-modal="true"
          class="cupertino-sheet flex h-[min(88vh,44rem)] w-full max-w-4xl flex-col overflow-hidden rounded-card shadow-xl"
          role="dialog"
        >
          <div class="flex items-start justify-between border-b border-border-subtle px-5 py-4">
            <div>
              <h2 id="settingsTitle" class="text-lg font-semibold text-content">设置</h2>
            </div>
            <button
              class="cursor-pointer rounded-card p-1 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content"
              aria-label="关闭设置"
              type="button"
              @click="emit('close')"
            >
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>

          <div class="flex min-h-0 flex-1 flex-col md:flex-row">
            <nav
              class="cupertino-tabs flex shrink-0 gap-1 overflow-x-auto border-b border-border-subtle p-2 md:w-44 md:flex-col md:border-r md:border-b-0"
              aria-label="设置分类"
            >
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="shrink-0 cursor-pointer rounded-card px-3 py-2 text-left text-sm font-medium transition-colors"
                :class="
                  activeTab === tab.key
                    ? 'cupertino-tab-active bg-surface text-content shadow-sm'
                    : 'text-content-muted hover:bg-surface hover:text-content'
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

          <div class="flex justify-end border-t border-border-subtle px-5 py-4">
            <button
              class="cursor-pointer rounded-card bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-pressed"
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
