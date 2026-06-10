<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { buildFloatingChatProjectContext } from "../../services/floatingChatContext";
import { useFloatingChatStore } from "../../stores/floatingChatStore";
import { useComposerStore } from "../../stores/composerStore";
import { useConversationsStore } from "../../stores/conversationsStore";
import { useImagesStore } from "../../stores/imagesStore";
import { useSettingsStore } from "../../stores/settingsStore";

const chat = useFloatingChatStore();
const composer = useComposerStore();
const conversations = useConversationsStore();
const images = useImagesStore();
const settings = useSettingsStore();
const listRef = ref<HTMLDivElement | null>(null);

watch(
  () => chat.messages.map((m) => m.content).join("|"),
  () => {
    nextTick(() => {
      if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
    });
  },
);

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendWithProjectContext();
  }
}

function insertToComposer(content: string) {
  composer.composerText = content;
}

function sendWithProjectContext() {
  chat.send(buildProjectContext());
}

function buildProjectContext() {
  return buildFloatingChatProjectContext({
    composerText: composer.composerText,
    activeConversationTitle: conversations.activeConversation?.title,
    recentMessages: conversations.activeMessages,
    activeAttachments: images.activeAttachments,
    generation: {
      apiProvider: settings.apiProvider,
      apiMode: settings.apiMode,
      connectionMode: settings.connectionMode,
      model: settings.model,
      size: settings.activeSizePreset,
      resolution: settings.sizeResolution,
      width: settings.imageWidth,
      height: settings.imageHeight,
      imageCount: settings.imageCount,
      quality: settings.quality,
      background: settings.background,
      outputFormat: settings.outputFormat,
    },
    rag: {
      enabled: settings.ragEnabled,
      topK: settings.ragTopK,
      promptWordbanks: settings.promptWordbanks,
      imageAssets: images.imageAssets,
      favoritePrompts: settings.favoritePrompts,
      messages: conversations.activeMessages,
      excludedIds: composer.ragExcludedMatchIds,
    },
  });
}
</script>

<template>
  <!-- 气泡按钮 -->
  <button
    v-if="!chat.isOpen"
    class="fixed bottom-6 right-6 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform hover:scale-105"
    type="button"
    title="AI 助手"
    @click="chat.open"
  >
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  </button>

  <!-- 展开面板 -->
  <div
    v-if="chat.isOpen"
    class="fixed bottom-6 right-6 z-40 flex h-[520px] w-[380px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl"
  >
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">AI 助手</h3>
        <p class="text-xs text-gray-400">改写 prompt、提问、聊天</p>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="chat.messages.length"
          class="cursor-pointer rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          type="button"
          title="清空对话"
          @click="chat.clear"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <button
          class="cursor-pointer rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          type="button"
          title="关闭"
          @click="chat.close"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="listRef" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div v-if="!chat.messages.length" class="text-center text-xs text-gray-400 py-8">
        发一句试试。例如「帮我把这个 prompt 改写得更有电影感：一个女孩在咖啡馆」
      </div>
      <div
        v-for="(msg, i) in chat.messages"
        :key="i"
        :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'"
      >
        <div
          :class="[
            'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
            msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800',
          ]"
        >
          {{ msg.content || (chat.isStreaming && i === chat.messages.length - 1 ? '...' : '') }}
          <button
            v-if="msg.role === 'assistant' && msg.content && !(chat.isStreaming && i === chat.messages.length - 1)"
            class="mt-2 block text-xs text-blue-600 hover:underline cursor-pointer"
            type="button"
            @click="insertToComposer(msg.content)"
          >
            插入到输入框
          </button>
        </div>
      </div>
      <div v-if="chat.error" class="text-xs text-red-500 px-2">{{ chat.error }}</div>
    </div>

    <!-- 输入区 -->
    <div class="border-t border-gray-100 p-3">
      <div class="flex gap-2">
        <textarea
          v-model="chat.input"
          rows="2"
          class="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          :disabled="chat.isStreaming"
          @keydown="handleKeydown"
        />
        <button
          class="self-end cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
          :disabled="!chat.input.trim() || chat.isStreaming"
          @click="sendWithProjectContext"
        >
          {{ chat.isStreaming ? '...' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>
