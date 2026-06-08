<script setup lang="ts">
import { computed } from "vue";
import { useComposerStore } from "../../stores/composerStore";
import { useImagesStore } from "../../stores/imagesStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { buildFinalRequestPrompt } from "../../services/promptRequest";
import { collectRagDocuments, retrieveRagContext } from "../../services/rag";
import ComposerEditorPanel from "./ComposerEditorPanel.vue";

const emit = defineEmits<{
  "update:editModeEnabled": [value: boolean];
}>();

const composer = useComposerStore();
const images = useImagesStore();
const settings = useSettingsStore();
const promptModeLabel = computed(() => {
  const labels = {
    default: "默认",
    safe: "安全",
    creative: "创意",
    adult: "开放",
  };
  return labels[settings.promptMode];
});
const providerLabel = computed(() => {
  if (settings.apiProvider === "grok") return "Grok xAI";
  if (settings.apiProvider === "gemini") return "Gemini";
  return "OpenAI";
});
const previewSourcePrompt = computed(() =>
  composer.composerText.trim() ||
    (images.activeAttachments.length ? "基于引用图片继续编辑。" : ""),
);
const ragDocuments = computed(() =>
  collectRagDocuments({
    wordbanks: settings.promptWordbanks,
    imageAssets: images.imageAssets,
  }),
);
const previewRagResult = computed(() => {
  if (!settings.ragEnabled || !previewSourcePrompt.value) return undefined;

  return retrieveRagContext({
    query: previewSourcePrompt.value,
    documents: ragDocuments.value,
    excludedIds: composer.ragExcludedMatchIds,
    topK: settings.ragTopK,
  });
});
const excludedRagMatches = computed(() => {
  if (!settings.ragEnabled || !previewSourcePrompt.value) return [];
  const excludedIds = new Set(composer.ragExcludedMatchIds);
  if (!excludedIds.size) return [];

  return retrieveRagContext({
    query: previewSourcePrompt.value,
    documents: ragDocuments.value,
    topK: 12,
    minScore: 0,
  }).items.filter((item) => excludedIds.has(item.id));
});
const previewPrompt = computed(() => {
  if (!previewSourcePrompt.value) return "";

  return buildFinalRequestPrompt({
    prompt: previewSourcePrompt.value,
    promptMode: settings.promptMode,
    promptWordbanks: settings.promptWordbanks,
    promptRewriteGuardEnabled: settings.promptRewriteGuardEnabled,
    promptRewriteGuardText: settings.promptRewriteGuardText,
    ragContext: previewRagResult.value?.context,
  });
});

function ragSourceLabel(source: string) {
  if (source === "wordbank") return "词库";
  if (source === "favorite") return "收藏";
  return "历史";
}

function ragScoreLabel(score: number) {
  return `${Math.round(score * 100)}%`;
}

function ragWeightedScoreLabel(score: number) {
  return score.toFixed(2);
}
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
    <span
      class="cursor-not-allowed rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400"
    >
      供应商: {{ providerLabel }}
    </span>
    <span
      class="cursor-not-allowed rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400"
    >
      模型: {{ settings.model }}
    </span>
    <span
      class="cursor-not-allowed rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400"
    >
      内容: {{ promptModeLabel }}
    </span>
    <button
      class="cursor-pointer rounded-full bg-gray-900 px-2 py-0.5 text-[11px] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
      type="button"
      :disabled="!previewPrompt"
      @click="composer.openPromptPreview()"
    >
      预览 Prompt
    </button>
    <button
      :class="[
        'cursor-pointer rounded-full px-2 py-0.5 text-[11px] transition-colors',
        composer.editModeEnabled
          ? 'bg-black text-white hover:bg-gray-800'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
      ]"
      type="button"
      @click="emit('update:editModeEnabled', !composer.editModeEnabled)"
    >
      区域编辑: {{ composer.editModeEnabled ? "开" : "关" }}
    </button>
    <span class="relative inline-flex">
      <button
        class="cursor-pointer rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-200"
        :class="composer.activeEditor === 'size' ? 'bg-gray-200 text-gray-800' : ''"
        type="button"
        @click="composer.toggleEditor('size')"
      >
        尺寸: {{ settings.sizeLabel }}
      </button>
      <ComposerEditorPanel
        v-if="composer.activeEditor === 'size'"
        :active-editor="composer.activeEditor"
      />
    </span>
    <span class="relative inline-flex">
      <button
        class="cursor-pointer rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-200"
        :class="composer.activeEditor === 'count' ? 'bg-gray-200 text-gray-800' : ''"
        type="button"
        @click="composer.toggleEditor('count')"
      >
        数量: {{ settings.imageCount }}
      </button>
      <ComposerEditorPanel
        v-if="composer.activeEditor === 'count'"
        :active-editor="composer.activeEditor"
      />
    </span>
    <span class="relative inline-flex">
      <button
        class="cursor-pointer rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-200"
        :class="composer.activeEditor === 'background' ? 'bg-gray-200 text-gray-800' : ''"
        type="button"
        @click="composer.toggleEditor('background')"
      >
        背景: {{ settings.backgroundLabel }}
      </button>
      <ComposerEditorPanel
        v-if="composer.activeEditor === 'background'"
        :active-editor="composer.activeEditor"
      />
    </span>
    <span class="relative inline-flex">
      <button
        class="cursor-pointer rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-200"
        :class="composer.activeEditor === 'format' ? 'bg-gray-200 text-gray-800' : ''"
        type="button"
        @click="composer.toggleEditor('format')"
      >
        格式: {{ settings.formatLabel }}
      </button>
      <ComposerEditorPanel
        v-if="composer.activeEditor === 'format'"
        :active-editor="composer.activeEditor"
      />
    </span>

    <Teleport to="body">
      <div
        v-if="composer.isPromptPreviewOpen"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 py-4 sm:items-center"
        @click="composer.closePromptPreview()"
      >
        <section
          class="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-preview-title"
          @click.stop
        >
          <header class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 id="prompt-preview-title" class="text-sm font-semibold text-gray-900">
              实际发送 Prompt
            </h2>
            <button
              class="cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              type="button"
              aria-label="关闭"
              @click="composer.closePromptPreview()"
            >
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </header>
          <div class="px-4 py-3">
            <div
              v-if="settings.ragEnabled && previewRagResult"
              class="mb-3 rounded-md border border-gray-200 bg-white"
            >
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
                <div>
                  <div class="text-xs font-semibold text-gray-800">RAG 命中</div>
                  <div class="mt-0.5 text-[11px] text-gray-500">
                    词库优先，其次收藏 Prompt，再次历史 Prompt
                  </div>
                </div>
                <button
                  v-if="composer.ragExcludedMatchIds.length"
                  class="cursor-pointer rounded-md px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  type="button"
                  @click="composer.clearRagExclusions()"
                >
                  恢复全部
                </button>
              </div>
              <div class="max-h-44 overflow-y-auto p-2">
                <div
                  v-if="!previewRagResult.items.length"
                  class="px-2 py-4 text-center text-xs text-gray-400"
                >
                  当前没有纳入最终 Prompt 的 RAG 命中
                </div>
                <div v-else class="space-y-1.5">
                  <div
                    v-for="item in previewRagResult.items"
                    :key="item.id"
                    class="flex min-w-0 items-start gap-2 rounded-md bg-gray-50 px-2 py-2"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white">
                          {{ ragSourceLabel(item.source) }}
                        </span>
                        <span class="text-[11px] text-gray-500">
                          {{ item.title }}
                        </span>
                        <span class="text-[11px] text-gray-400">
                          加权 {{ ragWeightedScoreLabel(item.score) }} / 原始 {{ ragScoreLabel(item.rawScore) }} / 权重 {{ item.sourceWeight.toFixed(2) }}
                        </span>
                      </div>
                      <div class="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-700">
                        {{ item.text }}
                      </div>
                    </div>
                    <button
                      class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
                      type="button"
                      @click="composer.excludeRagMatch(item.id)"
                    >
                      排除
                    </button>
                  </div>
                </div>

                <div
                  v-if="excludedRagMatches.length"
                  class="mt-2 border-t border-gray-200 pt-2"
                >
                  <div class="mb-1 px-1 text-[11px] font-medium text-gray-500">
                    已排除
                  </div>
                  <div class="space-y-1">
                    <div
                      v-for="item in excludedRagMatches"
                      :key="item.id"
                      class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5"
                    >
                      <span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {{ ragSourceLabel(item.source) }}
                      </span>
                      <span class="min-w-0 flex-1 truncate text-xs text-gray-500">
                        {{ item.text }}
                      </span>
                      <button
                        class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        type="button"
                        @click="composer.restoreRagMatch(item.id)"
                      >
                        恢复
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <textarea
              class="h-[50vh] w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 outline-none sm:h-96"
              readonly
              :value="previewPrompt"
            />
          </div>
          <footer class="flex justify-end border-t border-gray-200 px-4 py-3">
            <button
              class="cursor-pointer rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800"
              type="button"
              @click="composer.closePromptPreview()"
            >
              关闭
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
