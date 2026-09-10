<script setup lang="ts">
import { computed } from "vue";
import { formatRelativeTime } from "../../shared/dateTime";
import { vImagePreview } from "../../composables/imagePreviewDirective";
import type { ImageLibraryViewMode } from "../../stores/composerStore";
import type { ImageAsset } from "../../types/studio";
import { imageDownloadName, sourceLabel } from "./imageLibraryFormatters";
import { imageTagCardBackground, imageTagDotColor } from "./imageTagColors";

const props = withDefaults(
  defineProps<{
    image: ImageAsset;
    isAttached: boolean;
    isSelected: boolean;
    nowMs: number;
    viewMode?: ImageLibraryViewMode;
  }>(),
  { viewMode: "list" },
);

const emit = defineEmits<{
  attachImage: [id: string];
  previewImage: [id: string];
  selectImage: [id: string];
}>();

const createdAtLabel = computed(() => formatRelativeTime(props.image.createdAt, props.nowMs));
const cardStyle = computed(() => {
  if (!props.image.tagColor) return undefined;
  return {
    backgroundColor: imageTagCardBackground(props.image.tagColor),
  };
});
const selectedAccentColor = computed(() => {
  if (!props.isSelected) return undefined;
  if (!props.image.tagColor) return "#6b7280";
  return imageTagDotColor(props.image.tagColor);
});
const selectedBorderStyle = computed(() => {
  if (!selectedAccentColor.value) return undefined;
  return {
    borderColor: selectedAccentColor.value,
  };
});
const titleStyle = computed(() => {
  if (!selectedAccentColor.value) return undefined;
  return {
    color: selectedAccentColor.value,
  };
});
</script>

<template>
  <!-- Grid view: vertical card so thumbnails can be scanned without cropping. -->
  <article
    v-if="viewMode === 'grid'"
    v-image-preview="image"
    :class="[
      'group flex cursor-pointer flex-col rounded-panel border p-1.5 transition-colors',
      isSelected ? '' : 'border-border-subtle hover:bg-surface-hover',
    ]"
    :style="[cardStyle, selectedBorderStyle]"
    @click="emit('selectImage', image.id)"
  >
    <div
      class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-card bg-surface-muted"
      @click.stop="image.previewUrl && emit('previewImage', image.id)"
    >
      <img
        v-if="image.previewUrl"
        class="h-full w-full object-contain"
        decoding="async"
        loading="lazy"
        :alt="image.name"
        :src="image.previewUrl"
      />
      <span v-else class="text-xs text-content-tertiary">img</span>
      <span
        v-if="isAttached"
        class="absolute left-1 top-1 rounded bg-accent px-1 py-0.5 text-[10px] font-medium text-white"
      >
        已引用
      </span>
      <button
        v-if="image.previewUrl"
        class="image-preview-overlay absolute inset-0 flex cursor-pointer items-center justify-center bg-black/45 text-[11px] font-medium text-white opacity-0 transition-opacity"
        type="button"
        @click.stop="emit('previewImage', image.id)"
      >
        点击查看
      </button>
    </div>
    <div class="mt-1.5 min-w-0">
      <div class="truncate text-xs font-medium text-content" :style="titleStyle">
        {{ image.name }}
      </div>
      <div class="truncate text-[11px] text-content-muted">{{ createdAtLabel }}</div>
    </div>
    <div class="mt-1 flex items-center justify-between gap-1">
      <a
        v-if="image.previewUrl"
        class="rounded-card px-1.5 py-0.5 text-[11px] text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
        :download="imageDownloadName(image)"
        :href="image.previewUrl"
        @click.stop
      >
        下载
      </a>
      <span v-else></span>
      <button
        :class="[
          'cursor-pointer rounded-card px-1.5 py-0.5 text-[11px] transition-colors',
          isAttached
            ? 'bg-surface-muted text-content-tertiary'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        ]"
        type="button"
        @click.stop="emit('attachImage', image.id)"
      >
        {{ isAttached ? "已引用" : "引用" }}
      </button>
    </div>
  </article>

  <!-- List view (default): compact row with metadata and inline actions. -->
  <article
    v-else
    v-image-preview="image"
    :class="[
      'flex cursor-pointer items-center gap-3 rounded-panel border p-2 transition-colors',
      isSelected ? '' : 'border-border-subtle hover:bg-surface-hover',
    ]"
    :style="[cardStyle, selectedBorderStyle]"
    @click="emit('selectImage', image.id)"
  >
    <div
      class="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-surface-muted text-xs text-content-tertiary"
      @click.stop="image.previewUrl && emit('previewImage', image.id)"
    >
      <img
        v-if="image.previewUrl"
        class="h-full w-full rounded-card object-contain"
        decoding="async"
        loading="lazy"
        :alt="image.name"
        :src="image.previewUrl"
      />
      <span v-else>img</span>
      <button
        v-if="image.previewUrl"
        class="image-preview-overlay absolute inset-0 flex cursor-pointer items-center justify-center rounded-card bg-black/45 text-[11px] font-medium text-white opacity-0 transition-opacity"
        type="button"
        @click.stop="emit('previewImage', image.id)"
      >
        点击查看
      </button>
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium text-content" :style="titleStyle">
        {{ image.name }}
      </div>
      <div class="truncate text-xs text-content-muted">
        {{ sourceLabel(image) }} · {{ createdAtLabel }}
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <a
        v-if="image.previewUrl"
        class="rounded-card px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
        :download="imageDownloadName(image)"
        :href="image.previewUrl"
        @click.stop
      >
        下载
      </a>
      <button
        :class="[
          'cursor-pointer rounded-card px-2 py-1 text-xs transition-colors',
          isAttached
            ? 'bg-surface-muted text-content-tertiary'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        ]"
        type="button"
        @click.stop="emit('attachImage', image.id)"
      >
        {{ isAttached ? "已引用" : "引用" }}
      </button>
    </div>
  </article>
</template>

<style scoped>
@media (hover: hover) and (pointer: fine) {
  .group:hover .image-preview-overlay {
    opacity: 1;
  }
}
</style>
