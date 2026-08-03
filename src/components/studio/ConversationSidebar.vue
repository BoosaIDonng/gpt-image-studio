<script setup lang="ts">
import { computed, ref } from "vue";
import { useComposerStore } from "../../stores/composerStore";
import { useConversationsStore } from "../../stores/conversationsStore";
import { useGenerationStore } from "../../stores/generationStore";
import { useDarkMode } from "../../composables/useDarkMode";

const { theme, toggleTheme } = useDarkMode();

const emit = defineEmits<{
  createConversation: [];
  deleteConversation: [id: string];
  renameConversation: [id: string];
  openSettings: [];
  selectConversation: [id: string];
}>();

const searchText = ref("");
const composer = useComposerStore();
const conversations = useConversationsStore();
const generation = useGenerationStore();
const filteredConversations = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  if (!query) return conversations.conversations;

  return conversations.conversations.filter((conversation) =>
    `${conversation.title} ${conversation.summary}`.toLowerCase().includes(query),
  );
});

function closeSidebar() {
  composer.setConversationSidebarOpen(false);
}
</script>

<template>
  <div
    v-if="composer.isConversationSidebarOpen"
    class="fixed inset-0 z-20 bg-black/35 2xl:hidden"
    role="presentation"
    @click="closeSidebar"
  ></div>
  <aside
    :class="[
      'cupertino-sidebar flex w-65 shrink-0 flex-col max-2xl:fixed max-2xl:inset-y-0 max-2xl:left-0 max-2xl:z-30 max-2xl:transition-transform max-2xl:duration-200',
      composer.isConversationSidebarOpen ? 'max-2xl:translate-x-0' : 'max-2xl:-translate-x-full',
    ]"
    aria-label="历史会话"
  >
    <div class="flex items-center justify-between px-3 pt-3 pb-1">
      <div class="flex min-w-0 items-center gap-2 px-2 py-2">
        <img class="h-8 w-8 shrink-0" src="/favicon.svg" alt="" aria-hidden="true" />
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            GPT Image Studio
          </div>
          <div class="truncate text-xs text-gray-500">BoosaIDonng</div>
        </div>
      </div>
      <button
        class="cursor-pointer rounded-lg p-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        :aria-label="`主题: ${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}`"
        :title="`主题: ${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}（点击切换）`"
        type="button"
        @click="toggleTheme"
      >
        <!-- 浅色模式：显示太阳图标 -->
        <svg
          v-if="theme === 'light'"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <!-- 深色模式：显示月亮图标 -->
        <svg
          v-else-if="theme === 'dark'"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <!-- 跟随系统：显示显示器图标 -->
        <svg
          v-else
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </button>
      <button
        class="cursor-pointer rounded-lg p-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        aria-label="打开设置"
        type="button"
        @click="emit('openSettings')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>

    <div class="px-3 pt-2 pb-1">
      <button
        class="flex w-full cursor-pointer items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-blue-600"
        type="button"
        @click="
          emit('createConversation');
          closeSidebar();
        "
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
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span>新建会话</span>
      </button>
    </div>

    <div class="px-3 py-2">
      <label class="sr-only" for="conversationSearch">查找会话</label>
      <div class="relative">
        <input
          id="conversationSearch"
          v-model="searchText"
          class="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-3 pr-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-blue-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          placeholder="查找会话..."
          type="text"
        />
        <button
          v-if="searchText"
          class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          aria-label="清空搜索"
          type="button"
          @click="searchText = ''"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z"
            />
          </svg>
        </button>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-2 py-1">
      <div v-if="!filteredConversations.length" class="px-3 py-8 text-center text-sm text-gray-500">
        没有找到会话
      </div>
      <div
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        :class="[
          'group mb-0.5 flex items-center gap-1 rounded-lg pr-1 transition-colors',
          conversation.id === conversations.activeConversationId
            ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
        ]"
      >
        <button
          class="min-w-0 flex-1 cursor-pointer truncate px-3 py-2 text-left text-sm"
          type="button"
          @click="
            emit('selectConversation', conversation.id);
            closeSidebar();
          "
        >
          {{ conversation.title }}
        </button>
        <span
          v-if="(generation.pendingJobCountByConversation[conversation.id] ?? 0) > 0"
          class="inline-flex h-5 min-w-5 shrink-0 items-center mr-2 justify-center rounded-full bg-amber-500/20 px-1 text-[11px] font-semibold text-amber-200 group-hover:hidden"
        >
          {{ generation.pendingJobCountByConversation[conversation.id] }}
        </span>
        <button
          class="shrink-0 cursor-pointer rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          type="button"
          aria-label="重命名会话"
          title="重命名会话"
          @click.stop="emit('renameConversation', conversation.id)"
        >
          重命名
        </button>
        <button
          class="shrink-0 cursor-pointer rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
          type="button"
          aria-label="删除会话"
          title="删除会话"
          @click.stop="emit('deleteConversation', conversation.id)"
        >
          删除
        </button>
      </div>
    </nav>

    <div class="flex items-center gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
      <img class="h-5 w-5 shrink-0" src="/favicon.svg" alt="" aria-hidden="true" />
      <div class="text-xs text-gray-500">GPT Image Studio - BoosaIDonng</div>
    </div>
  </aside>
</template>
