<script setup lang="ts">
import { ref } from "vue";
import { fetchChatModels } from "../../services/promptExpander";
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
    <h3 id="generalSettingsTitle" class="text-base font-semibold text-gray-900">通用</h3>

    <div class="mt-4 space-y-4">
      <div
        class="flex items-start justify-between gap-4 rounded-lg border border-gray-200 px-3 py-2.5"
      >
        <div>
          <div class="text-sm font-medium text-gray-700">网络失败自动重试</div>
          <p class="mt-1 text-xs leading-relaxed text-gray-500">
            开启后，当网络连接失败时会自动重试（指数退避，最多 10 次）。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="ctx.autoRetryOnNetworkError.value"
          :class="[
            'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
            ctx.autoRetryOnNetworkError.value ? 'bg-gray-900' : 'bg-gray-300',
          ]"
          @click="ctx.updateAutoRetryOnNetworkError(!ctx.autoRetryOnNetworkError.value)"
        >
          <span
            :class="[
              'inline-block h-4 w-4 rounded-full bg-white transition-transform',
              ctx.autoRetryOnNetworkError.value ? 'translate-x-4' : 'translate-x-0.5',
            ]"
          />
        </button>
      </div>

      <!-- Prompt expand -->
      <div class="rounded-lg border border-gray-200 p-4 space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-gray-700">Prompt 智能扩写</div>
            <p class="mt-1 text-xs leading-relaxed text-gray-500">
              发送前用 Chat 模型将输入扩写为详细英文 prompt。需单独配置 Chat API。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="ctx.promptExpandEnabled.value"
            :class="[
              'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              ctx.promptExpandEnabled.value ? 'bg-gray-900' : 'bg-gray-300',
            ]"
            @click="ctx.updatePromptExpandEnabled(!ctx.promptExpandEnabled.value)"
          >
            <span
              :class="[
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                ctx.promptExpandEnabled.value ? 'translate-x-4' : 'translate-x-0.5',
              ]"
            />
          </button>
        </div>

        <div v-if="ctx.promptExpandEnabled.value" class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600" for="chatApiKey"
              >Chat API Key</label
            >
            <input
              id="chatApiKey"
              :value="ctx.chatApiKey.value"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              type="password"
              autocomplete="off"
              placeholder="sk-..."
              @input="ctx.updateChatApiKey(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600" for="chatApiBaseUrl"
              >Chat API Base URL</label
            >
            <input
              id="chatApiBaseUrl"
              :value="ctx.chatApiBaseUrl.value"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
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
              <label class="text-xs font-medium text-gray-600" for="chatModel">Chat 模型</label>
              <button
                type="button"
                class="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 cursor-pointer"
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
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              @change="ctx.updateChatModel(($event.target as HTMLSelectElement).value)"
            >
              <option value="">请选择模型</option>
              <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
            </select>
            <input
              v-else
              id="chatModel"
              :value="ctx.chatModel.value"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              type="text"
              placeholder="deepseek-chat"
              @input="ctx.updateChatModel(($event.target as HTMLInputElement).value)"
            />
            <p v-if="fetchModelsError" class="mt-1 text-xs text-red-500">{{ fetchModelsError }}</p>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="text-xs font-medium text-gray-600" for="chatSystemPrompt"
                >System Prompt</label
              >
              <button
                type="button"
                class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                @click="ctx.updateChatSystemPrompt('')"
              >
                恢复默认
              </button>
            </div>
            <textarea
              id="chatSystemPrompt"
              :value="ctx.chatSystemPrompt.value"
              rows="5"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500 resize-y"
              placeholder="留空则使用默认 prompt（图片扩写助手）"
              @input="ctx.updateChatSystemPrompt(($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
