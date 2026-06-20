<script setup lang="ts">
import { onUnmounted, ref } from "vue";

defineProps<{
  apiKey: string;
  label: string;
}>();

const emit = defineEmits<{
  "update:apiKey": [value: string];
}>();

const apiKeyVisible = ref(false);
const apiKeyCopyStatus = ref<"idle" | "copied" | "failed">("idle");
let apiKeyCopyStatusTimer: ReturnType<typeof setTimeout> | undefined;

function resetApiKeyCopyStatusSoon() {
  if (apiKeyCopyStatusTimer) {
    clearTimeout(apiKeyCopyStatusTimer);
  }
  apiKeyCopyStatusTimer = setTimeout(() => {
    apiKeyCopyStatus.value = "idle";
  }, 1600);
}

function toggleApiKeyVisibility() {
  apiKeyVisible.value = !apiKeyVisible.value;
  apiKeyCopyStatus.value = "idle";
}

async function copyApiKey(apiKey: string) {
  if (!apiKeyVisible.value || !apiKey) return;

  try {
    await navigator.clipboard.writeText(apiKey);
    apiKeyCopyStatus.value = "copied";
  } catch {
    apiKeyCopyStatus.value = "failed";
  }

  resetApiKeyCopyStatusSoon();
}

onUnmounted(() => {
  if (apiKeyCopyStatusTimer) {
    clearTimeout(apiKeyCopyStatusTimer);
  }
});
</script>

<template>
  <div>
    <label class="mb-1 block text-sm font-medium text-gray-700" for="apiKey">
      {{ label }}
    </label>
    <div class="flex rounded-lg border border-gray-300 bg-white focus-within:border-gray-500">
      <input
        id="apiKey"
        :value="apiKey"
        class="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 text-sm text-gray-900 outline-none"
        autocomplete="off"
        placeholder="sk-..."
        :type="apiKeyVisible ? 'text' : 'password'"
        @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
      />
      <button
        class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-l border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
        type="button"
        :aria-label="apiKeyVisible ? '隐藏 API key' : '显示 API key'"
        :title="apiKeyVisible ? '隐藏 API key' : '显示 API key'"
        @click="toggleApiKeyVisibility"
      >
        <svg
          v-if="apiKeyVisible"
          aria-hidden="true"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path d="m3 3 18 18" />
          <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
          <path d="M9.88 4.24A10.38 10.38 0 0 1 12 4c7 0 10 8 10 8a15.51 15.51 0 0 1-2.45 3.67" />
          <path d="M6.61 6.61A15.8 15.8 0 0 0 2 12s3 8 10 8a10.4 10.4 0 0 0 5.39-1.61" />
        </svg>
      </button>
      <button
        v-if="apiKeyVisible"
        class="flex h-10 shrink-0 cursor-pointer items-center justify-center border-l border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
        type="button"
        :disabled="!apiKey"
        :aria-label="apiKeyCopyStatus === 'copied' ? 'API key 已复制' : '复制 API key'"
        :title="apiKeyCopyStatus === 'copied' ? '已复制' : '复制 API key'"
        @click="copyApiKey(apiKey)"
      >
        {{ apiKeyCopyStatus === "copied" ? "已复制" : "复制" }}
      </button>
    </div>
    <p v-if="apiKeyCopyStatus === 'failed'" class="mt-1.5 text-xs text-red-500">
      复制失败，请手动选择复制。
    </p>
  </div>
</template>
