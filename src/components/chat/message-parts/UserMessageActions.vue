<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { finalPromptFromMessage } from "../../../services/messagePrompt";
import type { Message } from "../../../types/studio";
import Tooltip from "../../ui/Tooltip.vue";

const props = defineProps<{
  message: Message;
}>();

const emit = defineEmits<{
  copyText: [text: string];
  deleteMessage: [id: string];
  loadMessageConfig: [message: Message];
}>();

const isMenuOpen = ref(false);
const actionRoot = ref<HTMLElement | null>(null);
const finalRequestPrompt = computed(() => finalPromptFromMessage(props.message));

watch(isMenuOpen, (isOpen) => {
  if (isOpen) {
    document.addEventListener("pointerdown", closeMenuFromOutside);
    return;
  }

  document.removeEventListener("pointerdown", closeMenuFromOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeMenuFromOutside);
});

function closeMenu() {
  isMenuOpen.value = false;
}

function closeMenuFromOutside(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Node && actionRoot.value?.contains(target)) return;
  closeMenu();
}

function copyOriginalPrompt() {
  emit("copyText", props.message.content);
  closeMenu();
}

function copyFinalRequestPrompt() {
  emit("copyText", finalRequestPrompt.value);
  closeMenu();
}

function loadMessageConfig() {
  emit("loadMessageConfig", props.message);
  closeMenu();
}

function deleteMessage() {
  emit("deleteMessage", props.message.id);
  closeMenu();
}
</script>

<template>
  <div
    ref="actionRoot"
    class="absolute right-5 top-full z-20 mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100"
    @keydown.escape="closeMenu"
  >
    <Tooltip text="复制原始 prompt" preferred-placement="top">
      <button
        class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900"
        aria-label="复制原始 prompt"
        type="button"
        @click="copyOriginalPrompt"
      >
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </Tooltip>

    <div class="relative">
      <Tooltip text="消息管理" preferred-placement="top">
        <button
          class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-haspopup="menu"
          :aria-expanded="isMenuOpen"
          aria-label="消息管理"
          type="button"
          @click="isMenuOpen = !isMenuOpen"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </Tooltip>

      <div
        v-if="isMenuOpen"
        class="absolute right-0 top-8 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl"
        role="menu"
      >
        <button
          class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50"
          role="menuitem"
          type="button"
          @click="copyOriginalPrompt"
        >
          <svg
            class="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>复制原始 prompt</span>
        </button>
        <button
          class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50"
          role="menuitem"
          type="button"
          @click="copyFinalRequestPrompt"
        >
          <svg
            class="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8" />
            <path d="M8 12h8" />
            <path d="M8 16h5" />
          </svg>
          <span>复制最终请求 prompt</span>
        </button>
        <button
          class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50"
          role="menuitem"
          type="button"
          @click="loadMessageConfig"
        >
          <svg
            class="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h9" />
            <path d="M17 6h3" />
            <circle cx="15" cy="6" r="2" />
            <path d="M4 12h3" />
            <path d="M11 12h9" />
            <circle cx="9" cy="12" r="2" />
            <path d="M4 18h11" />
            <path d="M19 18h1" />
            <circle cx="17" cy="18" r="2" />
          </svg>
          <span>加载到输入面板</span>
        </button>
        <div class="my-1 border-t border-gray-100"></div>
        <button
          class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-red-600 transition-colors hover:bg-red-50"
          role="menuitem"
          type="button"
          @click="deleteMessage"
        >
          <svg
            class="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>删除单条消息</span>
        </button>
      </div>
    </div>
  </div>
</template>
