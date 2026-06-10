<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { analyzeModerationRejection } from "../../../services/moderationAdvice";
import { rewritePromptWithAssistant } from "../../../services/promptSafetyRewrite";
import type { Message } from "../../../types/studio";
import Tooltip from "../../ui/Tooltip.vue";
import { messageErrorText } from "./messageImageFormat";

const props = defineProps<{
  message: Message;
  sourcePrompt?: string;
}>();

const emit = defineEmits<{
  copyText: [text: string];
  retryMessage: [message: Message, prompt?: string];
}>();

const errorText = computed(() => messageErrorText(props.message));
const aiRewriteError = ref("");
const aiRewritePrompt = ref("");
const isAiRewriteLoading = ref(false);
const moderationAdvice = computed(() =>
  analyzeModerationRejection(errorText.value, props.sourcePrompt ?? ""),
);
const hasDiagnostics = computed(
  () =>
    moderationAdvice.value.isModerationRejection &&
    (moderationAdvice.value.riskMatches.length > 0 ||
      Boolean(moderationAdvice.value.saferPrompt)),
);
const canAiRewrite = computed(() => Boolean(props.sourcePrompt?.trim()));

watch(
  () => [props.message.id, props.sourcePrompt, errorText.value],
  () => {
    aiRewriteError.value = "";
    aiRewritePrompt.value = "";
    isAiRewriteLoading.value = false;
  },
);

function copyRiskReplacements() {
  const text = moderationAdvice.value.riskMatches
    .map((match) => `${match.term} -> ${match.replacement}`)
    .join("\n");
  if (!text) return;
  emit("copyText", text);
}

function copySaferPrompt() {
  if (!moderationAdvice.value.saferPrompt) return;
  emit("copyText", moderationAdvice.value.saferPrompt);
}

function retrySaferPrompt() {
  if (!moderationAdvice.value.saferPrompt) return;
  emit("retryMessage", props.message, moderationAdvice.value.saferPrompt);
}

async function requestAiRewrite() {
  if (!props.sourcePrompt || isAiRewriteLoading.value) return;

  aiRewriteError.value = "";
  isAiRewriteLoading.value = true;
  try {
    aiRewritePrompt.value = await rewritePromptWithAssistant({
      prompt: props.sourcePrompt,
      errorMessage: errorText.value,
      fallbackPrompt: moderationAdvice.value.saferPrompt,
      riskMatches: moderationAdvice.value.riskMatches,
    });
  } catch (error) {
    aiRewriteError.value =
      error instanceof Error ? error.message : "AI 改写失败，请稍后重试。";
  } finally {
    isAiRewriteLoading.value = false;
  }
}

function copyAiRewritePrompt() {
  if (!aiRewritePrompt.value) return;
  emit("copyText", aiRewritePrompt.value);
}

function retryAiRewritePrompt() {
  if (!aiRewritePrompt.value) return;
  emit("retryMessage", props.message, aiRewritePrompt.value);
}
</script>

<template>
  <figure
    class="overflow-hidden rounded-xl border border-red-100 bg-white"
    aria-label="图片生成失败"
  >
    <div
      class="flex h-48 flex-col items-center justify-center gap-3 bg-red-50/60 px-6 text-center"
    >
      <div
        class="flex h-11 w-11 items-center justify-center rounded-full border border-red-100 bg-white text-red-500 shadow-sm"
      >
        <svg
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div>
        <div class="text-sm font-medium text-red-700">生成中断</div>
        <Tooltip
          :text="errorText"
          preferred-placement="top"
          multiline
          :delay="1000"
          :hide-delay="500"
        >
          <div class="mt-1 line-clamp-2 text-xs leading-relaxed text-red-500">
            {{ errorText }}
          </div>
        </Tooltip>
      </div>
    </div>
    <figcaption class="px-3 py-2">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-medium">未生成图片</div>
          <Tooltip
            :text="errorText"
            preferred-placement="top"
            multiline
            :delay="1000"
            :hide-delay="500"
          >
            <div class="truncate text-xs text-gray-500">
              生成失败：{{ errorText }}
            </div>
          </Tooltip>
        </div>
        <button
          class="shrink-0 cursor-pointer rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          type="button"
          @click="emit('retryMessage', props.message)"
        >
          原样重试
        </button>
      </div>

      <div
        v-if="hasDiagnostics || canAiRewrite"
        class="mt-3 space-y-3 border-t border-red-50 pt-3"
      >
        <section v-if="moderationAdvice.riskMatches.length">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <h3 class="text-xs font-semibold text-gray-800">命中风险词</h3>
            <span class="text-[11px] text-gray-400">来自本条 prompt</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="match in moderationAdvice.riskMatches"
              :key="`${match.term}-${match.replacement}`"
              class="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700"
            >
              {{ match.term }}
            </span>
          </div>
        </section>

        <section v-if="moderationAdvice.riskMatches.length">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <h3 class="text-xs font-semibold text-gray-800">替代词建议</h3>
            <button
              class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-50"
              type="button"
              @click="copyRiskReplacements"
            >
              复制替代词
            </button>
          </div>
          <div class="grid gap-1.5 sm:grid-cols-2">
            <div
              v-for="match in moderationAdvice.riskMatches"
              :key="`${match.term}->${match.replacement}`"
              class="min-w-0 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px]"
            >
              <div class="truncate font-mono text-red-600">{{ match.term }}</div>
              <div class="text-gray-400">替换为</div>
              <div class="truncate font-mono text-emerald-700">
                {{ match.replacement }}
              </div>
            </div>
          </div>
        </section>

        <section v-if="moderationAdvice.saferPrompt">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <h3 class="text-xs font-semibold text-gray-800">保守版 prompt</h3>
            <button
              class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-50"
              type="button"
              @click="copySaferPrompt"
            >
              复制
            </button>
          </div>
          <div
            class="max-h-28 overflow-y-auto rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-xs leading-relaxed text-gray-700"
          >
            {{ moderationAdvice.saferPrompt }}
          </div>
          <div class="mt-2 flex flex-wrap justify-end gap-2">
            <button
              class="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              type="button"
              @click="copySaferPrompt"
            >
              复制保守版 prompt
            </button>
            <button
              class="cursor-pointer rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
              type="button"
              @click="retrySaferPrompt"
            >
              使用保守版重试
            </button>
          </div>
        </section>

        <section>
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <h3 class="text-xs font-semibold text-gray-800">AI 助手改写</h3>
            <button
              class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="isAiRewriteLoading || !canAiRewrite"
              @click="requestAiRewrite"
            >
              {{ isAiRewriteLoading ? "改写中..." : "AI 改写 prompt" }}
            </button>
          </div>

          <div
            v-if="aiRewriteError"
            class="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-xs leading-relaxed text-red-600"
          >
            {{ aiRewriteError }}
          </div>

          <div
            v-if="aiRewritePrompt"
            class="rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-2 text-xs leading-relaxed text-gray-700"
          >
            {{ aiRewritePrompt }}
          </div>

          <div
            v-if="aiRewritePrompt"
            class="mt-2 flex flex-wrap justify-end gap-2"
          >
            <button
              class="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              type="button"
              @click="copyAiRewritePrompt"
            >
              复制 AI 改写 prompt
            </button>
            <button
              class="cursor-pointer rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-800"
              type="button"
              @click="retryAiRewritePrompt"
            >
              使用 AI 改写版重试
            </button>
          </div>
        </section>
      </div>
    </figcaption>
  </figure>
</template>
