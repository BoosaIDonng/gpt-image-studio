<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { formatRelativeTime } from "../../shared/dateTime";
import { useGenerationStore } from "../../stores/generationStore";
import { useImagesStore } from "../../stores/imagesStore";
import {
  describeGenerationDeviation,
  validateGeneratedImage,
  validateGenerationCount,
} from "../../services/generationValidation";
import type { ImageAsset, Message } from "../../types/studio";
import ErrorGenerationCard from "./message-parts/ErrorGenerationCard.vue";
import PendingGenerationCard from "./message-parts/PendingGenerationCard.vue";
import ReferencedImageList from "./message-parts/ReferencedImageList.vue";
import ResultImageCard from "./message-parts/ResultImageCard.vue";
import UserMessageActions from "./message-parts/UserMessageActions.vue";

const props = defineProps<{
  attachedImageIds: string[];
  imageById: (id: string) => ImageAsset | undefined;
  message: Message;
  nowMs: number;
  sourcePrompt?: string;
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

const attachedImageIds = computed(() => new Set(props.attachedImageIds));
const generation = useGenerationStore();
const imagesStore = useImagesStore();
const createdAtLabel = computed(() => formatRelativeTime(props.message.createdAt, props.nowMs));
const pendingPreviewUrl = computed(() => generation.getPartialPreviewUrl(props.message.id));

/** ETA for non-streaming providers, based on the user's own past durations. */
const pendingEtaLabel = computed(() => {
  const averageMs = imagesStore.averageGenerationDurationMs;
  if (!averageMs) return "";
  const startedAtMs = new Date(
    props.message.generationStartedAt ?? props.message.createdAt,
  ).getTime();
  const elapsedMs = Number.isFinite(startedAtMs)
    ? Math.max(0, pendingNowMs.value - startedAtMs)
    : 0;
  const remainingSeconds = Math.round((averageMs - elapsedMs) / 1000);
  if (remainingSeconds < 5) return "";
  return remainingSeconds >= 60
    ? `${Math.round(remainingSeconds / 60)} 分钟`
    : `约 ${remainingSeconds} 秒`;
});

/** Visible deviations (size/count/transparent/prompt rewritten) for one result. */
function deviationTextsForImage(imageId: string): string[] {
  const image = props.imageById(imageId);
  if (!image) return [];

  const texts = validateGeneratedImage({
    params: props.message.generationParams,
    image,
  }).map((deviation) => describeGenerationDeviation(deviation));

  // Count mismatch is message-level; show it once, on the first result card.
  const isFirstResult = props.message.resultImageIds[0] === imageId;
  if (isFirstResult) {
    const countDeviations = validateGenerationCount({
      requested: props.message.generationParams?.imageCount,
      actual: props.message.resultImageIds.length,
      hasError: Boolean(props.message.errorMessage),
    }).map((deviation) => describeGenerationDeviation(deviation));
    texts.push(...countDeviations);
  }

  return texts;
}

function revisedPromptForImage(imageId: string) {
  const image = props.imageById(imageId);
  return image?.revisedPrompt?.trim() || "";
}
const hasImagePanel = computed(
  () =>
    props.message.resultImageIds.length ||
    props.message.status === "pending" ||
    props.message.status === "error",
);
const pendingNowMs = ref(Date.now());
let pendingTimer: number | null = null;

watch(
  () => props.message.status,
  (status) => {
    if (status === "pending") {
      pendingNowMs.value = Date.now();
      if (!pendingTimer) {
        pendingTimer = window.setInterval(() => {
          pendingNowMs.value = Date.now();
        }, 100);
      }
      return;
    }

    stopPendingTimer();
  },
  { immediate: true },
);

onUnmounted(stopPendingTimer);

function isImageAttached(id: string) {
  return attachedImageIds.value.has(id);
}

function pendingDurationLabel() {
  const startedAtMs = new Date(
    props.message.generationStartedAt ?? props.message.createdAt,
  ).getTime();
  const elapsedMs = Number.isFinite(startedAtMs)
    ? Math.max(0, pendingNowMs.value - startedAtMs)
    : 0;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${hours}:${padTime(minutes)}:${padTime(seconds)}`;
  }

  const centiseconds = Math.floor((elapsedMs % 1000) / 10);
  return `${padTime(minutes)}:${padTime(seconds)}:${padTime(centiseconds)}`;
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function stopPendingTimer() {
  if (!pendingTimer) return;
  window.clearInterval(pendingTimer);
  pendingTimer = null;
}
</script>

<template>
  <div :class="['group/message relative', message.role === 'user' ? 'mb-9' : 'mb-6']">
    <UserMessageActions
      v-if="message.role === 'user'"
      :message="message"
      @copy-text="emit('copyText', $event)"
      @delete-message="emit('deleteMessage', $event)"
      @load-message-config="emit('loadMessageConfig', $event)"
    />

    <article
      :class="['rounded-dialog px-5 py-4', message.role === 'user' ? 'bg-surface-muted' : '']"
    >
      <div class="mb-1.5 flex items-center gap-2 text-xs text-content-muted">
        <span class="font-semibold text-content">
          {{ message.role === "user" ? "你" : "Image Studio" }}
        </span>
        <span>{{ createdAtLabel }}</span>
      </div>

      <p class="text-[15px] leading-relaxed text-content">
        {{ message.content }}
      </p>

      <ReferencedImageList
        :image-by-id="imageById"
        :image-ids="message.referencedImageIds"
        @attach-image="emit('attachImage', $event)"
      />

      <div v-if="hasImagePanel" class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ResultImageCard
          v-for="imageId in message.resultImageIds"
          :key="imageId"
          :image="imageById(imageId)"
          :image-id="imageId"
          :is-attached="isImageAttached(imageId)"
          :message="message"
          :deviation-texts="deviationTextsForImage(imageId)"
          :revised-prompt="revisedPromptForImage(imageId)"
          @attach-image="emit('attachImage', $event)"
          @continue-edit="emit('continueEdit', $event)"
          @generate-another="emit('generateAnother', $event)"
          @preview-image="emit('previewImage', $event)"
          @rename-image="emit('renameImage', $event)"
          @refresh-image="(message, imageId) => emit('refreshImage', message, imageId)"
          @retry-revised="(message, prompt) => emit('retryMessage', message, prompt)"
        />

        <PendingGenerationCard
          v-if="message.status === 'pending'"
          :duration-label="pendingDurationLabel()"
          :eta-label="pendingEtaLabel"
          :preview-url="pendingPreviewUrl"
          :retry-attempt="message.networkRetryAttempt"
          @cancel="emit('cancelMessageGeneration', message.id)"
        />

        <ErrorGenerationCard
          v-if="message.status === 'error'"
          :message="message"
          :source-prompt="sourcePrompt"
          @copy-text="emit('copyText', $event)"
          @retry-message="(message, prompt) => emit('retryMessage', message, prompt)"
        />
      </div>
    </article>
  </div>
</template>
