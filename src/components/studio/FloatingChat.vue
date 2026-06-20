<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
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

// ── 拖拽状态 ──
const STORAGE_KEY = "floating-chat-position";
const BUTTON_SIZE = 48; // h-12 w-12 = 48px
const PANEL_W = 380;
const PANEL_H = 520;
const EDGE_MARGIN = 24; // 距视口边缘最小距离 (6 * 4 = 24px)
const CLICK_THRESHOLD = 5;

const posRight = ref(EDGE_MARGIN);
const posBottom = ref(EDGE_MARGIN);
const isDragging = ref(false);
let startX = 0;
let startY = 0;
let startRight = 0;
let startBottom = 0;
let movedDistance = 0;

/** 面板展开方向：气泡在右侧时面板向左展开，在左侧时向右展开 */
const panelStyle = computed(() => {
  const style: Record<string, string> = {
    position: "fixed",
    zIndex: "40",
    width: `${PANEL_W}px`,
    height: `${PANEL_H}px`,
  };
  // 水平：如果气泡靠右（right > 视口宽度一半），面板在气泡左侧；否则在右侧
  const viewportW = window.innerWidth;
  const bubbleLeft = viewportW - posRight.value - BUTTON_SIZE;
  if (bubbleLeft > viewportW / 2) {
    // 气泡偏右 → 面板在气泡左边
    style.right = `${posRight.value}px`;
  } else {
    // 气泡偏左 → 面板在气泡右边
    style.left = `${viewportW - posRight.value}px`;
  }
  // 垂直：面板底部对齐气泡底部
  style.bottom = `${posBottom.value}px`;
  return style;
});

function restorePosition() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { right, bottom } = JSON.parse(saved);
      if (typeof right === "number" && typeof bottom === "number") {
        posRight.value = clampRight(right);
        posBottom.value = clampBottom(bottom);
      }
    }
  } catch { /* ignore */ }
}

function savePosition() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      right: posRight.value,
      bottom: posBottom.value,
    }));
  } catch { /* ignore */ }
}

function clampRight(value: number) {
  return Math.max(0, Math.min(window.innerWidth - BUTTON_SIZE, value));
}

function clampBottom(value: number) {
  return Math.max(0, Math.min(window.innerHeight - BUTTON_SIZE, value));
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return; // 仅左键
  isDragging.value = true;
  movedDistance = 0;
  startX = e.clientX;
  startY = e.clientY;
  startRight = posRight.value;
  startBottom = posBottom.value;
  (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  movedDistance = Math.max(movedDistance, Math.abs(dx), Math.abs(dy));
  posRight.value = clampRight(startRight - dx);
  posBottom.value = clampBottom(startBottom - dy);
}

function onPointerUp() {
  isDragging.value = false;
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
  savePosition();
}

function onBubbleClick() {
  // 仅在没有拖拽时打开面板
  if (movedDistance < CLICK_THRESHOLD) {
    chat.open();
  }
}

onMounted(restorePosition);

onUnmounted(() => {
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
});

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
  <!-- 气泡按钮（可拖动） -->
  <button
    v-if="!chat.isOpen"
    class="z-40 flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-gray-900 text-white shadow-lg"
    :class="isDragging ? 'cursor-grabbing' : 'cursor-grab hover:scale-105'"
    :style="{ position: 'fixed', right: posRight + 'px', bottom: posBottom + 'px', transition: isDragging ? 'none' : 'transform 0.15s' }"
    type="button"
    title="AI 助手（可拖动）"
    @pointerdown="onPointerDown"
    @click="onBubbleClick"
  >
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  </button>

  <!-- 展开面板（跟随气泡位置） -->
  <div
    v-if="chat.isOpen"
    class="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl"
    :style="panelStyle"
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
        :key="`${msg.role}-${i}-${msg.content?.slice(0, 16) ?? ''}`"
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
