<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDesktopLayout } from "../../composables/useDesktopLayout";
import { useComposerStore, type ImageLibraryViewMode } from "../../stores/composerStore";
import { useConversationsStore } from "../../stores/conversationsStore";
import { useImagesStore } from "../../stores/imagesStore";
import type { ImageAsset } from "../../types/studio";
import ImageDetailsPanel from "../image-library/ImageDetailsPanel.vue";
import ImageGrid from "../image-library/ImageGrid.vue";
import { IMAGE_TAG_COLORS, imageTagDotColor } from "../image-library/imageTagColors";
import StorageUsagePanel from "../image-library/StorageUsagePanel.vue";
import StudioPanel from "./StudioPanel.vue";

const emit = defineEmits<{
  openBatchOperations: [];
  previewImage: [id: string];
  renameImage: [id: string];
}>();

const composer = useComposerStore();
const conversations = useConversationsStore();
const images = useImagesStore();
const isDesktop = useDesktopLayout();
const activeFilter = ref<"current" | "all">(composer.imageLibraryScope);
const activeColorFilter = ref<"all" | ImageAsset["tagColor"]>("all");
const selectedImageId = ref("");
const libraryImages = computed(() => images.imageAssets.filter((image) => !image.isTransientMask));

const VIEW_MODES: { value: ImageLibraryViewMode; label: string }[] = [
  { value: "grid", label: "网格视图" },
  { value: "list", label: "列表视图" },
];

const currentConversationImages = computed(() =>
  libraryImages.value.filter(
    (image) => image.conversationId === conversations.activeConversationId,
  ),
);
const scopeImages = computed(() =>
  activeFilter.value === "current" ? currentConversationImages.value : libraryImages.value,
);
const filteredImages = computed(() => {
  if (activeColorFilter.value === "all") return scopeImages.value;
  return scopeImages.value.filter((image) => image.tagColor === activeColorFilter.value);
});
const selectedImage = computed(() => {
  if (!selectedImageId.value) return null;
  return libraryImages.value.find((image) => image.id === selectedImageId.value) ?? null;
});
watch(
  () => composer.imageLibraryScope,
  (scope) => {
    activeFilter.value = scope;
  },
);

watch(
  () => [libraryImages.value, activeFilter.value, conversations.activeConversationId] as const,
  () => {
    if (!selectedImage.value) {
      selectedImageId.value = "";
      return;
    }

    if (!filteredImages.value.some((image) => image.id === selectedImage.value?.id)) {
      selectedImageId.value = filteredImages.value[0]?.id ?? "";
    }
  },
);

function onPanelEnter(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }

  htmlEl.animate(
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: 200,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "both",
    },
  ).onfinish = done;
}

function onPanelLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }

  htmlEl.animate(
    [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(8px)" },
    ],
    {
      duration: 160,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "both",
    },
  ).onfinish = done;
}

function selectImage(id: string) {
  selectedImageId.value = id;
}

function isAttached(id: string) {
  return images.attachedImages.includes(id);
}

function toggleColorFilter(nextColor: ImageAsset["tagColor"] | "all") {
  activeColorFilter.value = nextColor;
}

function setImageTagColor(id: string, color: ImageAsset["tagColor"] | undefined) {
  images.setImageTagColor(id, color);
}

/** On desktop the panel collapses; below 1280px it is a drawer that closes. */
function closeLibrary() {
  if (isDesktop.value) {
    composer.setLibraryCollapsed(true);
    return;
  }
  composer.setLibraryOpen(false);
}
</script>

<template>
  <StudioPanel
    id="library-panel"
    label="图片库"
    side="right"
    :collapsed="composer.isLibraryCollapsed"
    :open="composer.isLibraryOpen"
    :width="360"
    @close="closeLibrary"
    @reset-mobile="composer.setLibraryOpen(false)"
  >
    <div class="border-b border-border-subtle px-4 py-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-base font-semibold text-content">图片库</span>
          <span class="text-sm text-content-muted">{{ libraryImages.length }} 张图片</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <div
            class="flex items-center rounded-card bg-surface-muted p-0.5"
            role="group"
            aria-label="图片显示方式"
          >
            <button
              v-for="mode in VIEW_MODES"
              :key="mode.value"
              :aria-label="mode.label"
              :aria-pressed="composer.imageLibraryViewMode === mode.value"
              :class="[
                'cursor-pointer rounded-md p-1.5 transition-colors',
                composer.imageLibraryViewMode === mode.value
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-muted hover:text-content',
              ]"
              :title="mode.label"
              type="button"
              @click="composer.setImageLibraryViewMode(mode.value)"
            >
              <svg
                v-if="mode.value === 'grid'"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                aria-hidden="true"
              >
                <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
                <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
                <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" />
                <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
              </svg>
              <svg
                v-else
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M3 5h14" />
                <path d="M3 10h14" />
                <path d="M3 15h14" />
              </svg>
            </button>
          </div>
          <button
            class="cursor-pointer rounded-card border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-hover"
            type="button"
            @click="emit('openBatchOperations')"
          >
            批量下载
          </button>
          <button
            class="cursor-pointer rounded-card p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content"
            :aria-label="isDesktop ? '收起图片库' : '关闭图片库'"
            type="button"
            @click="closeLibrary"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>
      </div>
      <StorageUsagePanel v-if="images.storageUsage" :storage-usage="images.storageUsage" />

      <div class="mt-3 grid grid-cols-2 rounded-card bg-surface-muted p-1 text-sm">
        <button
          :class="[
            'cursor-pointer rounded-md px-2 py-1 transition-colors',
            activeFilter === 'current'
              ? 'bg-surface text-content shadow-sm'
              : 'text-content-muted hover:text-content',
          ]"
          type="button"
          @click="activeFilter = 'current'"
        >
          当前会话
        </button>
        <button
          :class="[
            'cursor-pointer rounded-md px-2 py-1 transition-colors',
            activeFilter === 'all'
              ? 'bg-surface text-content shadow-sm'
              : 'text-content-muted hover:text-content',
          ]"
          type="button"
          @click="activeFilter = 'all'"
        >
          全部图片
        </button>
      </div>
      <div class="mt-2 flex items-center gap-2 rounded-card bg-surface-muted px-2 py-2">
        <button
          aria-label="不过滤颜色"
          :class="[
            'h-3 w-3 cursor-pointer rounded-full border transition-transform hover:scale-105',
            activeColorFilter === 'all'
              ? 'border-border-subtle ring-2 ring-gray-400/60'
              : 'border-border-subtle',
          ]"
          style="background-color: #ffffff"
          type="button"
          @click="toggleColorFilter('all')"
        />
        <button
          v-for="color in IMAGE_TAG_COLORS"
          :key="color"
          :aria-label="`筛选${color}`"
          :class="[
            'h-3 w-3 cursor-pointer rounded-full border transition-transform hover:scale-105',
            activeColorFilter === color
              ? 'border-border-subtle ring-2 ring-gray-400/60'
              : 'border-border-subtle',
          ]"
          :style="{ backgroundColor: imageTagDotColor(color) }"
          type="button"
          @click="toggleColorFilter(color)"
        />
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ImageGrid
        :active-filter="activeFilter"
        :attached-image-ids="images.attachedImages"
        :images="filteredImages"
        :selected-image-id="selectedImage?.id ?? ''"
        :view-mode="composer.imageLibraryViewMode"
        @attach-image="images.attachImage"
        @preview-image="emit('previewImage', $event)"
        @select-image="selectImage"
      />

      <Transition :css="false" @enter="onPanelEnter" @leave="onPanelLeave">
        <ImageDetailsPanel
          v-if="selectedImage"
          :image="selectedImage"
          :is-attached="isAttached(selectedImage.id)"
          @clear-selection="selectedImageId = ''"
          @delete-image="images.deleteImage"
          @rename-image="emit('renameImage', $event)"
          @set-tag-color="setImageTagColor"
        />
      </Transition>
    </div>
  </StudioPanel>
</template>
