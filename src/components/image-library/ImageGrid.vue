<script setup lang="ts">
import { useNow } from "../../composables/useNow";
import type { ImageLibraryViewMode } from "../../stores/composerStore";
import type { ImageAsset } from "../../types/studio";
import ImageCard from "./ImageCard.vue";

withDefaults(
  defineProps<{
    activeFilter: "current" | "all";
    attachedImageIds: string[];
    images: ImageAsset[];
    selectedImageId: string;
    viewMode?: ImageLibraryViewMode;
  }>(),
  { viewMode: "list" },
);

const emit = defineEmits<{
  attachImage: [id: string];
  previewImage: [id: string];
  selectImage: [id: string];
}>();

const now = useNow();

function isAttached(imageId: string, attachedImageIds: string[]) {
  return attachedImageIds.includes(imageId);
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-3">
    <div
      v-if="!images.length"
      class="flex h-full min-h-55 items-center justify-center rounded-panel border border-dashed border-border-subtle px-6 text-center text-sm text-content-tertiary"
    >
      {{ activeFilter === "current" ? "当前会话还没有图片" : "图片库还是空的" }}
    </div>

    <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'">
      <ImageCard
        v-for="image in images"
        :key="image.id"
        :image="image"
        :is-attached="isAttached(image.id, attachedImageIds)"
        :is-selected="selectedImageId === image.id"
        :now-ms="now"
        :view-mode="viewMode"
        @attach-image="emit('attachImage', $event)"
        @preview-image="emit('previewImage', $event)"
        @select-image="emit('selectImage', $event)"
      />
    </div>
  </div>
</template>
