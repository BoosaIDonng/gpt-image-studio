<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useNow } from "../../composables/useNow";
import type { ImageAsset, Message } from "../../types/studio";
import MessageItem from "./MessageItem.vue";

const props = defineProps<{
  attachedImageIds: string[];
  imageById: (id: string) => ImageAsset | undefined;
  messages: Message[];
}>();

const emit = defineEmits<{
  attachImage: [id: string];
  continueEdit: [id: string];
  copyText: [text: string];
  cancelMessageGeneration: [messageId: string];
  deleteMessage: [id: string];
  generateAnother: [message: Message];
  loadMessageConfig: [message: Message];
  previewImage: [id: string];
  renameImage: [id: string];
  refreshImage: [message: Message, imageId: string];
  retryMessage: [message: Message, prompt?: string];
}>();

const now = useNow();
const scrollContainer = ref<HTMLDivElement | null>(null);

async function scrollToBottom() {
  await nextTick();

  requestAnimationFrame(() => {
    const container = scrollContainer.value;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  });
}

/**
 * Assistant messages show the user prompt they answered. Build the mapping in a
 * single forward pass; previously every message scanned the whole list per render.
 */
const sourcePromptById = computed(() => {
  const prompts = new Map<string, string>();
  const latestUserPrompt = new Map<string, string>();

  for (const message of props.messages) {
    if (message.role === "user") {
      latestUserPrompt.set(message.conversationId, message.content);
      continue;
    }

    if (message.role === "assistant") {
      const prompt = latestUserPrompt.get(message.conversationId);
      if (prompt !== undefined) prompts.set(message.id, prompt);
    }
  }

  return prompts;
});

onMounted(scrollToBottom);

watch(
  () => props.messages.map((message) => message.id).join("|"),
  () => {
    void scrollToBottom();
  },
  { flush: "post" },
);
</script>

<template>
  <div ref="scrollContainer" class="flex-1 overflow-y-auto">
    <div class="mx-auto max-w-3xl px-4 py-6">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :attached-image-ids="attachedImageIds"
        :image-by-id="imageById"
        :message="message"
        :now-ms="now"
        :source-prompt="sourcePromptById.get(message.id) ?? ''"
        @attach-image="emit('attachImage', $event)"
        @continue-edit="emit('continueEdit', $event)"
        @copy-text="emit('copyText', $event)"
        @cancel-message-generation="emit('cancelMessageGeneration', $event)"
        @delete-message="emit('deleteMessage', $event)"
        @generate-another="emit('generateAnother', $event)"
        @load-message-config="emit('loadMessageConfig', $event)"
        @preview-image="emit('previewImage', $event)"
        @rename-image="emit('renameImage', $event)"
        @refresh-image="(message, imageId) => emit('refreshImage', message, imageId)"
        @retry-message="(message, prompt) => emit('retryMessage', message, prompt)"
      />
    </div>
  </div>
</template>
