<script setup lang="ts">
import { computed } from "vue";
import { useNow } from "../../composables/useNow";
import { formatRelativeTime } from "../../shared/dateTime";
import type { Conversation } from "../../types/studio";

type SortDirection = "asc" | "desc";
type ConversationSortKey = "name" | "time";

const props = defineProps<{
  conversationSortDirection: SortDirection;
  conversationSortKey: ConversationSortKey;
  conversationSortOptions: { key: ConversationSortKey; label: string }[];
  conversations: Conversation[];
  filteredConversations: Conversation[];
  searchText: string;
  selectedConversationIds: Set<string>;
  selectedConversations: Conversation[];
}>();

const emit = defineEmits<{
  clearSelection: [];
  deleteSelected: [];
  selectAll: [];
  setSort: [key: ConversationSortKey];
  toggleSelection: [id: string];
}>();

const now = useNow();
const updatedAtLabels = computed(
  () =>
    new Map(
      props.filteredConversations.map((conversation) => [
        conversation.id,
        formatRelativeTime(conversation.updatedAt, now.value),
      ]),
    ),
);
</script>

<template>
  <section class="mt-5 flex min-h-0 flex-1 flex-col" aria-labelledby="batchConversationsTitle">
    <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div>
        <h4 id="batchConversationsTitle" class="text-sm font-semibold text-content">对话</h4>
        <p class="mt-0.5 text-xs text-content-muted">
          找到 {{ filteredConversations.length }} 个，共 {{ conversations.length }} 个，已选
          {{ selectedConversations.length }} 个
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-1 text-xs">
        <span class="text-content-tertiary">排序</span>
        <button
          v-for="option in conversationSortOptions"
          :key="option.key"
          class="inline-flex cursor-pointer items-center gap-1 rounded-card px-2 py-1 transition-colors"
          :class="
            conversationSortKey === option.key
              ? 'bg-surface-muted font-medium text-content'
              : 'text-content-muted hover:bg-surface-hover hover:text-content'
          "
          type="button"
          @click="emit('setSort', option.key)"
        >
          {{ option.label }}
          <svg
            v-if="conversationSortKey === option.key"
            class="h-3 w-3 transition-transform"
            :class="{ 'rotate-180': conversationSortDirection === 'desc' }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </div>
      <div class="flex shrink-0 gap-1 text-xs">
        <button
          class="cursor-pointer rounded-card px-2 py-1 text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
          type="button"
          @click="emit('selectAll')"
        >
          全选
        </button>
        <button
          class="cursor-pointer rounded-card px-2 py-1 text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
          type="button"
          @click="emit('clearSelection')"
        >
          清空
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <article
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        :class="[
          'mb-2 flex cursor-pointer items-center gap-3 rounded-panel border p-3 transition-colors',
          selectedConversationIds.has(conversation.id)
            ? 'border-border-subtle bg-surface-muted shadow-sm'
            : 'border-border-subtle hover:bg-surface-hover',
        ]"
        @click="emit('toggleSelection', conversation.id)"
      >
        <div
          :class="[
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-muted text-sm font-semibold text-content-muted',
            selectedConversationIds.has(conversation.id)
              ? 'ring-2 ring-gray-900 ring-offset-1'
              : '',
          ]"
        >
          {{ conversation.title.slice(0, 1) || "会" }}
          <span
            v-if="selectedConversationIds.has(conversation.id)"
            class="pointer-events-none absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white shadow"
            aria-hidden="true"
          >
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.42 0L3.29 9.224a1 1 0 1 1 1.42-1.408l4.04 4.074 6.54-6.594a1 1 0 0 1 1.414-.006z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-content">
            {{ conversation.title }}
          </p>
          <p class="truncate text-xs text-content-muted">
            {{ conversation.summary }} · {{ updatedAtLabels.get(conversation.id) }}
          </p>
        </div>
      </article>
      <div
        v-if="!filteredConversations.length"
        class="rounded-panel border border-dashed border-border-subtle px-6 py-10 text-center"
      >
        <p v-if="searchText" class="text-sm font-medium text-content">没有找到匹配的对话</p>
        <p v-else class="text-sm font-medium text-content">还没有可批量处理的对话</p>
        <p class="mt-1 text-xs leading-relaxed text-content-tertiary">
          {{
            searchText
              ? "换一个消息关键词试试。"
              : "新建会话或发送第一条图片生成请求后，这里会显示可批量删除的对话列表。"
          }}
        </p>
      </div>
    </div>

    <div class="mt-3 shrink-0">
      <button
        class="rounded-card bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors enabled:cursor-pointer enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
        :disabled="!selectedConversations.length"
        type="button"
        @click="emit('deleteSelected')"
      >
        删除选中对话 ({{ selectedConversations.length }})
      </button>
    </div>
  </section>
</template>
