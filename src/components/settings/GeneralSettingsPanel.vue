<script setup lang="ts">
import { ref } from "vue";
import { fetchChatModels } from "../../services/promptExpander";
import Switch from "../ui/Switch.vue";
import { useSettingsModalContext } from "./settingsModalContext";

const ctx = useSettingsModalContext();

const availableModels = ref<string[]>([]);
const fetchingModels = ref(false);
const fetchModelsError = ref("");

async function handleFetchModels() {
  fetchModelsError.value = "";
  fetchingModels.value = true;
  try {
    availableModels.value = await fetchChatModels(ctx.chatApiKey.value, ctx.chatApiBaseUrl.value);
    if (availableModels.value.length && !ctx.chatModel.value) {
      ctx.updateChatModel(availableModels.value[0]);
    }
  } catch (e) {
    fetchModelsError.value = e instanceof Error ? e.message : "获取失败";
  } finally {
    fetchingModels.value = false;
  }
}
</script>

<template>
  <section aria-labelledby="generalSettingsTitle">
    <h3 id="generalSettingsTitle" class="text-base font-semibold text-content">通用</h3>

    <div class="mt-4 space-y-4">
      <div
        class="flex items-start justify-between gap-4 rounded-card border border-border-subtle px-3 py-2.5"
      >
        <div>
          <div class="text-sm font-medium text-content">网络失败自动重试</div>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            开启后，当网络连接失败时会自动重试（指数退避，最多 10 次）。
          </p>
        </div>
        <Switch
          label="网络失败自动重试"
          :model-value="ctx.autoRetryOnNetworkError.value"
          @update:model-value="ctx.updateAutoRetryOnNetworkError"
        />
      </div>

      <!-- Prompt expand -->
      <div class="rounded-card border border-border-subtle p-4 space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-content">Prompt 智能扩写</div>
            <p class="mt-1 text-xs leading-relaxed text-content-muted">
              发送前用 Chat 模型将输入扩写为详细英文 prompt。需单独配置 Chat API。
            </p>
          </div>
          <Switch
            label="Prompt 智能扩写"
            :model-value="ctx.promptExpandEnabled.value"
            @update:model-value="ctx.updatePromptExpandEnabled"
          />
        </div>

        <div v-if="ctx.promptExpandEnabled.value" class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-content" for="chatApiKey"
              >Chat API Key</label
            >
            <input
              id="chatApiKey"
              :value="ctx.chatApiKey.value"
              class="w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
              type="password"
              autocomplete="off"
              placeholder="sk-..."
              @input="ctx.updateChatApiKey(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-content" for="chatApiBaseUrl"
              >Chat API Base URL</label
            >
            <input
              id="chatApiBaseUrl"
              :value="ctx.chatApiBaseUrl.value"
              class="w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
              type="url"
              placeholder="https://api.deepseek.com"
              @input="ctx.updateChatApiBaseUrl(($event.target as HTMLInputElement).value)"
              @blur="
                ctx.updateChatApiBaseUrl(
                  ($event.target as HTMLInputElement).value.trim().replace(/\/+$/, ''),
                )
              "
            />
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="text-xs font-medium text-content" for="chatModel">Chat 模型</label>
              <button
                type="button"
                class="text-xs text-content-muted hover:text-content disabled:opacity-40 cursor-pointer"
                :disabled="fetchingModels || !ctx.chatApiKey.value || !ctx.chatApiBaseUrl.value"
                @click="handleFetchModels"
              >
                {{ fetchingModels ? "获取中…" : "获取模型列表" }}
              </button>
            </div>
            <!-- dropdown when models fetched, else text input -->
            <select
              v-if="availableModels.length"
              id="chatModel"
              :value="ctx.chatModel.value"
              class="w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
              @change="ctx.updateChatModel(($event.target as HTMLSelectElement).value)"
            >
              <option value="">请选择模型</option>
              <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
            </select>
            <input
              v-else
              id="chatModel"
              :value="ctx.chatModel.value"
              class="w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
              type="text"
              placeholder="deepseek-chat"
              @input="ctx.updateChatModel(($event.target as HTMLInputElement).value)"
            />
            <p v-if="fetchModelsError" class="mt-1 text-xs text-red-500">{{ fetchModelsError }}</p>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="text-xs font-medium text-content" for="chatSystemPrompt"
                >System Prompt</label
              >
              <button
                type="button"
                class="text-xs text-content-tertiary hover:text-content cursor-pointer"
                @click="ctx.updateChatSystemPrompt('')"
              >
                恢复默认
              </button>
            </div>
            <textarea
              id="chatSystemPrompt"
              :value="ctx.chatSystemPrompt.value"
              rows="5"
              class="w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent resize-y"
              placeholder="留空则使用默认 prompt（图片扩写助手）"
              @input="ctx.updateChatSystemPrompt(($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
