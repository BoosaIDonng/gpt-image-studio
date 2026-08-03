<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useComposerStore } from "../../stores/composerStore";
import { useConversationsStore } from "../../stores/conversationsStore";
import { useImagesStore } from "../../stores/imagesStore";
import type { ImageAsset } from "../../types/studio";
import ImageDetailsPanel from "../image-library/ImageDetailsPanel.vue";
import ImageGrid from "../image-library/ImageGrid.vue";
import { IMAGE_TAG_COLORS, imageTagDotColor } from "../image-library/imageTagColors";
import StorageUsagePanel from "../image-library/StorageUsagePanel.vue";

const emit = defineEmits<{
  openBatchOperations: [];
  previewImage: [id: string];
  renameImage: [id: string];
}>();

const composer = useComposerStore();
const conversations = useConversationsStore();
const images = useImagesStore();
const activeFilter = ref<"current" | "all">(composer.imageLibraryScope);
const activeColorFilter = ref<"all" | ImageAsset["tagColor"]>("all");
const selectedImageId = ref("");
const libraryImages = computed(() => images.imageAssets.filter((image) => !image.isTransientMask));

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
</script>

<template>
  <div
    v-if="composer.isLibraryOpen"
    class="fixed inset-0 z-10 bg-black/25 2xl:hidden"
    role="presentation"
    @click="composer.setLibraryOpen(false)"
  ></div>
  <aside
    :class="[
      'cupertino-library flex w-[320px] shrink-0 flex-col border-l border-gray-200 dark:border-gray-700 max-2xl:fixed max-2xl:inset-y-0 max-2xl:right-0 max-2xl:z-20 max-2xl:transition-transform max-2xl:duration-200 max-2xl:ease-out',
      composer.isLibraryOpen ? 'max-2xl:translate-x-0' : 'max-2xl:translate-x-full',
    ]"
    aria-label="图片库"
  >
    <div class="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base font-semibold text-gray-800 dark:text-gray-100">图片库</span>
          <span class="text-sm text-gray-500 dark:text-gray-400"
            >{{ libraryImages.length }} 张图片</span
          >
        </div>
        <div class="flex items-center gap-1">
          <button
            class="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
            type="button"
            @click="emit('openBatchOperations')"
          >
            批量下载
          </button>
          <button
            class="cursor-pointer rounded-lg p-1.5 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 2xl:hidden"
            aria-label="关闭图片库"
            type="button"
            @click="composer.setLibraryOpen(false)"
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

      <div class="mt-3 grid grid-cols-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 text-sm">
        <button
          :class="[
            'cursor-pointer rounded-md px-2 py-1 transition-colors',
            activeFilter === 'current'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
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
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
          ]"
          type="button"
          @click="activeFilter = 'all'"
        >
          全部图片
        </button>
      </div>
      <div class="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
        <button
          aria-label="不过滤颜色"
          :class="[
            'h-3 w-3 cursor-pointer rounded-full border transition-transform hover:scale-105',
            activeColorFilter === 'all'
              ? 'border-gray-700 dark:border-gray-300 ring-2 ring-gray-400/60 dark:ring-gray-500/60'
              : 'border-gray-300 dark:border-gray-600',
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
              ? 'border-gray-700 dark:border-gray-300 ring-2 ring-gray-400/60 dark:ring-gray-500/60'
              : 'border-gray-300 dark:border-gray-600',
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
  </aside>
</template>
