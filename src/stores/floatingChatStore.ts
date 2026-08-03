import { defineStore } from "pinia";
import { ref } from "vue";
import { streamChatReply, type ChatMessage } from "../services/floatingChatService";

export const useFloatingChatStore = defineStore("floatingChat", () => {
  const isOpen = ref(false);
  const isStreaming = ref(false);
  const messages = ref<ChatMessage[]>([]);
  const input = ref("");
  const error = ref("");
  const abortController = ref<AbortController | null>(null);

  function open() {
    isOpen.value = true;
  }
  function close() {
    isOpen.value = false;
  }
  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function clear() {
    abortController.value?.abort();
    abortController.value = null;
    messages.value = [];
    error.value = "";
  }

  async function send(projectContext?: ChatMessage) {
    const text = input.value.trim();
    if (!text || isStreaming.value) return;

    error.value = "";
    input.value = "";
    messages.value.push({ role: "user", content: text });
    messages.value.push({ role: "assistant", content: "" });
    const assistantIdx = messages.value.length - 1;
    isStreaming.value = true;
    const controller = new AbortController();
    abortController.value = controller;

    try {
      await streamChatReply(
        messages.value.slice(0, -1),
        (delta) => {
          const msg = messages.value[assistantIdx];
          if (msg) msg.content += delta;
        },
        projectContext,
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : "请求失败";
      messages.value.splice(assistantIdx, 1);
    } finally {
      isStreaming.value = false;
      abortController.value = null;
    }
  }

  return { isOpen, isStreaming, messages, input, error, open, close, toggle, clear, send };
});
