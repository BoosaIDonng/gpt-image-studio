<script setup lang="ts">
import type { ImageAsset } from "../../../types/studio";

defineProps<{
  imageById: (id: string) => ImageAsset | undefined;
  imageIds: string[];
}>();

const emit = defineEmits<{
  attachImage: [id: string];
}>();
</script>

<template>
  <div v-if="imageIds.length" class="mt-3 flex flex-wrap gap-2">
    <button
      v-for="imageId in imageIds"
      :key="imageId"
      :class="[
        'inline-flex items-center gap-2 rounded-card border px-3 py-1.5 text-sm transition-colors',
        imageById(imageId)
          ? 'cursor-pointer border-border-subtle bg-surface text-content hover:bg-surface-hover'
          : 'cursor-not-allowed border-dashed border-border-subtle bg-surface-muted text-content-tertiary',
      ]"
      type="button"
      :disabled="!imageById(imageId)"
      @click="imageById(imageId) && emit('attachImage', imageId)"
    >
      {{ imageById(imageId)?.name || "图片已删除，无法显示" }}
    </button>
  </div>
</template>
