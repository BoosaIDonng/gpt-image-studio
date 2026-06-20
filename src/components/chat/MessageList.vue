<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { useNow } from "../../composables/useNow";
import { timestampFromCreatedAt } from "../../shared/dateTime";
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

function sourcePromptFor(message: Message) {
  if (message.role !== "assistant") return "";
  return (
    [...props.messages]
      .reverse()
      .find(
        (item) =>
          item.conversationId === message.conversationId &&
          item.role === "user" &&
          timestampFromCreatedAt(item) <= timestampFromCreatedAt(message),
      )?.content ?? ""
  );
}

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
        :source-prompt="sourcePromptFor(message)"
        @attach-image="emit('attachImage', $event)"
        @continue-edit="emit('continueEdit', $event)"
        @copy-text="emit('copyText', $event)"
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
