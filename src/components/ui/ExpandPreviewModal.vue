<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  originalPrompt: string;
  expandedPrompt: string;
}>();

const emit = defineEmits<{
  confirm: [action: "custom" | "original" | "cancel", text?: string];
}>();

const editableText = ref(props.expandedPrompt);
const copied = ref(false);

async function copyText() {
  try {
    await navigator.clipboard.writeText(editableText.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {}
}

function sendEdited() {
  const text = editableText.value.trim();
  if (text) emit("confirm", "custom", text);
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-xl rounded-2xl bg-white shadow-xl">
      <div class="p-5 pb-4">
        <h3 class="text-sm font-semibold text-gray-900">Prompt 扩写预览</h3>

        <div class="mt-3 space-y-3">
          <div>
            <p class="mb-1 text-xs font-medium text-gray-500">原始输入</p>
            <p class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{{ originalPrompt }}</p>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <p class="text-xs font-medium text-gray-500">扩写结果（可编辑）</p>
              <button
                type="button"
                class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                @click="copyText"
              >
                {{ copied ? "已复制" : "复制" }}
              </button>
            </div>
            <textarea
              v-model="editableText"
              rows="8"
              class="w-full rounded-lg border border-gray-300 bg-blue-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-500 resize-y"
            />
          </div>
        </div>
      </div>

      <div class="flex gap-2 border-t border-gray-100 px-5 py-3">
        <button
          type="button"
          class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 cursor-pointer"
          @click="emit('confirm', 'cancel')"
        >
          取消
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
          @click="emit('confirm', 'original')"
        >
          使用原文
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 cursor-pointer"
          :disabled="!editableText.trim()"
          @click="sendEdited"
        >
          使用编辑后发送
        </button>
      </div>
    </div>
  </div>
</template>
