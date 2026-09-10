<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PROMPT_REWRITE_GUARD_PREFIX } from "../../services/imagesApi";
import Switch from "../ui/Switch.vue";
import { useSettingsModalContext } from "./settingsModalContext";

import type { PromptRewriteGuardHistoryItem } from "../../types/studio";

const ctx = useSettingsModalContext();
const {
  promptRewriteGuardEnabled: enabled,
  promptRewriteGuardText: text,
  promptRewriteGuardHistory: history,
  updatePromptRewriteGuardEnabled: updateEnabled,
  savePromptRewriteGuardText: saveText,
  restoreDefaultPromptRewriteGuardText: ctxRestoreDefault,
  restorePromptRewriteGuardHistoryItem: ctxRestoreHistory,
  deletePromptRewriteGuardHistoryItem: deleteHistory,
} = ctx;

const draftText = ref(text.value);
const copiedId = ref("");
const hasChanges = computed(() => draftText.value !== text.value);
const sortedHistory = computed(() =>
  [...history.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
);

watch(
  () => text.value,
  (text) => {
    draftText.value = text;
  },
);

function saveDraft() {
  saveText(draftText.value);
}

function restoreDefault() {
  draftText.value = PROMPT_REWRITE_GUARD_PREFIX;
  ctxRestoreDefault();
}

function restoreHistory(id: string) {
  const item = history.value.find((entry) => entry.id === id);
  if (item) draftText.value = item.text;
  ctxRestoreHistory(id);
}

async function copyHistory(item: PromptRewriteGuardHistoryItem) {
  try {
    await navigator.clipboard.writeText(item.text);
    copiedId.value = item.id;
    window.setTimeout(() => {
      if (copiedId.value === item.id) copiedId.value = "";
    }, 1400);
  } catch {
    copiedId.value = "";
  }
}

function formatHistoryTime(dateString: string) {
  const timestamp = Date.parse(dateString);
  if (!Number.isFinite(timestamp)) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function isDefaultHistoryItem(item: PromptRewriteGuardHistoryItem) {
  return item.id === "prompt-guard-default" && item.text === PROMPT_REWRITE_GUARD_PREFIX;
}
</script>

<template>
  <section aria-labelledby="promptGuardSettingsTitle">
    <h3 id="promptGuardSettingsTitle" class="text-base font-semibold text-content">提示词保护</h3>
    <p class="mt-1 text-sm leading-relaxed text-content-muted">
      当前设置只会影响发送给图片接口的请求文本，不会改写聊天记录里的原始提示词。
    </p>

    <div class="mt-4 space-y-4">
      <div
        class="flex items-start justify-between gap-4 rounded-card border border-border-subtle px-3 py-2.5"
      >
        <div>
          <div class="text-sm font-medium text-content">启用提示词防改写</div>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            开启后，请求会在用户提示词前追加下面的前置指令。
          </p>
        </div>
        <Switch
          label="启用提示词防改写"
          :model-value="enabled"
          @update:model-value="updateEnabled"
        />
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between gap-3">
          <label class="text-sm font-medium text-content" for="promptGuardText">
            当前前置指令
          </label>
          <button
            class="cursor-pointer rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            type="button"
            @click="restoreDefault"
          >
            恢复默认
          </button>
        </div>
        <textarea
          id="promptGuardText"
          v-model="draftText"
          class="h-20 w-full resize-y rounded-card border border-border-subtle bg-surface px-3 py-2 font-mono text-sm leading-relaxed text-content outline-none transition-colors focus:border-border-subtle"
          spellcheck="false"
        />
        <div class="mt-2 flex items-center justify-between gap-3">
          <p class="text-xs text-content-muted">文本为空时会自动使用默认英文指令。</p>
          <button
            class="cursor-pointer rounded-card bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            :disabled="!hasChanges"
            @click="saveDraft"
          >
            保存为当前版本
          </button>
        </div>
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <h4 class="text-sm font-medium text-content">历史版本</h4>
          <span class="text-xs text-content-tertiary">{{ history.length }} 条</span>
        </div>
        <div
          v-if="!sortedHistory.length"
          class="rounded-card border border-dashed border-border-subtle px-4 py-5 text-center text-sm text-content-tertiary"
        >
          还没有保存过历史版本
        </div>
        <div v-else class="space-y-2">
          <article
            v-for="item in sortedHistory"
            :key="item.id"
            class="rounded-card border border-border-subtle px-3 py-2.5"
          >
            <div class="mb-1.5 flex items-center justify-between gap-3">
              <span v-if="isDefaultHistoryItem(item)" class="text-xs text-content-tertiary">
                默认版本
              </span>
              <time v-else class="text-xs text-content-tertiary">
                {{ formatHistoryTime(item.createdAt) }}
              </time>
              <div class="flex items-center gap-1">
                <button
                  class="cursor-pointer rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
                  type="button"
                  @click="restoreHistory(item.id)"
                >
                  恢复
                </button>
                <button
                  class="cursor-pointer rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
                  type="button"
                  @click="copyHistory(item)"
                >
                  {{ copiedId === item.id ? "已复制" : "复制" }}
                </button>
                <button
                  class="cursor-pointer rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  type="button"
                  @click="deleteHistory(item.id)"
                >
                  删除
                </button>
              </div>
            </div>
            <p
              class="line-clamp-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-content"
            >
              {{ item.text }}
            </p>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
