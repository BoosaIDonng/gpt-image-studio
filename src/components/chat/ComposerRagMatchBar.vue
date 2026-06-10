<script setup lang="ts">
import { computed } from "vue";
import {
  buildRagMatchBarState,
  collectRagDocuments,
  retrieveRagContext,
  type RagMatch,
} from "../../services/rag";
import { useComposerStore } from "../../stores/composerStore";
import { useConversationsStore } from "../../stores/conversationsStore";
import { useImagesStore } from "../../stores/imagesStore";
import { useSettingsStore } from "../../stores/settingsStore";

const composer = useComposerStore();
const conversations = useConversationsStore();
const images = useImagesStore();
const settings = useSettingsStore();

const sourcePrompt = computed(() =>
  composer.composerText.trim() ||
    (images.activeAttachments.length ? "基于引用图片继续编辑。" : ""),
);

const ragDocuments = computed(() =>
  collectRagDocuments({
    wordbanks: settings.promptWordbanks,
    imageAssets: images.imageAssets,
    favoritePrompts: settings.favoritePrompts,
    messages: conversations.activeMessages,
  }),
);

const activeRagResult = computed(() => {
  if (!settings.ragEnabled || !sourcePrompt.value) return undefined;

  return retrieveRagContext({
    query: sourcePrompt.value,
    documents: ragDocuments.value,
    excludedIds: composer.ragExcludedMatchIds,
    topK: settings.ragTopK,
  });
});

const excludedRagMatches = computed(() => {
  if (!settings.ragEnabled || !sourcePrompt.value) return [];
  const excludedIds = new Set(composer.ragExcludedMatchIds);
  if (!excludedIds.size) return [];

  return retrieveRagContext({
    query: sourcePrompt.value,
    documents: ragDocuments.value,
    topK: 12,
    minScore: 0,
  }).items.filter((item) => excludedIds.has(item.id));
});

const matchBarState = computed(() =>
  buildRagMatchBarState({
    items: activeRagResult.value?.items ?? [],
    excludedItems: excludedRagMatches.value,
    maxVisibleItems: 3,
  }),
);

const summaryText = computed(() => {
  const state = matchBarState.value;
  const sourcePart = state.sourceImageCount
    ? ` · 来自 ${state.sourceImageCount} 张成功图`
    : "";
  return `RAG 参考 ${state.activeCount} 项${sourcePart}`;
});

function excludeMatch(item: RagMatch) {
  composer.excludeRagMatch(item.id);
}
</script>

<template>
  <div
    v-if="matchBarState.shouldShow"
    class="mb-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
  >
    <div class="flex flex-wrap items-center gap-2">
      <div class="shrink-0 text-[11px] font-medium text-gray-500">
        {{ summaryText }}
      </div>

      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <button
          v-for="item in matchBarState.visibleItems"
          :key="item.id"
          class="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900"
          type="button"
          :title="`排除 ${item.text}`"
          @click="excludeMatch(item)"
        >
          <span class="truncate">{{ item.text }}</span>
          <span class="text-gray-400" aria-hidden="true">×</span>
        </button>

        <span
          v-if="matchBarState.hiddenItemCount"
          class="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400"
        >
          +{{ matchBarState.hiddenItemCount }}
        </span>

        <button
          v-if="matchBarState.excludedCount"
          class="cursor-pointer rounded-full px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          type="button"
          @click="composer.clearRagExclusions()"
        >
          已排除 {{ matchBarState.excludedCount }} 项 · 恢复
        </button>
      </div>

      <button
        class="shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        type="button"
        @click="composer.openPromptPreview()"
      >
        详情
      </button>
    </div>
  </div>
</template>
