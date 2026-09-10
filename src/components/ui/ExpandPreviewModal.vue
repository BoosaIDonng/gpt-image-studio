<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

const props = defineProps<{
  originalPrompt: string;
  expandedPrompt: string;
}>();

const emit = defineEmits<{
  confirm: [action: "custom" | "original" | "cancel", text?: string];
}>();

const editableText = ref(props.expandedPrompt);
const copied = ref(false);
const copyTimer = ref<ReturnType<typeof setTimeout> | null>(null);

async function copyText() {
  try {
    await navigator.clipboard.writeText(editableText.value);
    copied.value = true;
    if (copyTimer.value) clearTimeout(copyTimer.value);
    copyTimer.value = setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {}
}

onBeforeUnmount(() => {
  if (copyTimer.value) clearTimeout(copyTimer.value);
});

function sendEdited() {
  const text = editableText.value.trim();
  if (text) emit("confirm", "custom", text);
}
</script>

<template>
  <div class="cupertino-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="cupertino-dialog w-full max-w-xl rounded-dialog shadow-xl">
      <div class="p-5 pb-4">
        <h3 class="text-sm font-semibold text-content">Prompt 扩写预览</h3>

        <div class="mt-3 space-y-3">
          <div>
            <p class="mb-1 text-xs font-medium text-content-muted">原始输入</p>
            <p
              class="rounded-card bg-surface-muted px-3 py-2 text-sm text-content whitespace-pre-wrap"
            >
              {{ originalPrompt }}
            </p>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <p class="text-xs font-medium text-content-muted">扩写结果（可编辑）</p>
              <button
                type="button"
                class="text-xs text-content-tertiary hover:text-content cursor-pointer"
                @click="copyText"
              >
                {{ copied ? "已复制" : "复制" }}
              </button>
            </div>
            <textarea
              v-model="editableText"
              rows="8"
              class="w-full rounded-card border border-border-subtle bg-blue-50 px-3 py-2 text-sm text-content outline-none focus:border-border-subtle resize-y"
            />
          </div>
        </div>
      </div>

      <div class="flex gap-2 border-t border-border-subtle px-5 py-3">
        <button
          type="button"
          class="rounded-card border border-border-subtle px-3 py-2 text-sm font-medium text-content-muted hover:bg-surface-hover cursor-pointer"
          @click="emit('confirm', 'cancel')"
        >
          取消
        </button>
        <button
          type="button"
          class="flex-1 rounded-card border border-border-subtle px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover cursor-pointer"
          @click="emit('confirm', 'original')"
        >
          使用原文
        </button>
        <button
          type="button"
          class="flex-1 rounded-card bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-pressed cursor-pointer"
          :disabled="!editableText.trim()"
          @click="sendEdited"
        >
          使用编辑后发送
        </button>
      </div>
    </div>
  </div>
</template>
