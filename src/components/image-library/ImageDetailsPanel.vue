<script setup lang="ts">
import { computed } from "vue";
import { useNow } from "../../composables/useNow";
import { vImagePreview } from "../../composables/imagePreviewDirective";
import { formatRelativeTime } from "../../shared/dateTime";
import type { ImageAsset } from "../../types/studio";
import Tooltip from "../ui/Tooltip.vue";
import {
  fileSize,
  imageDownloadName,
  imageFormat,
  imageSize,
  sourceLabel,
} from "./imageLibraryFormatters";
import { IMAGE_TAG_COLORS, imageTagDotColor } from "./imageTagColors";

const props = defineProps<{
  image: ImageAsset;
  isAttached: boolean;
}>();

const emit = defineEmits<{
  clearSelection: [];
  deleteImage: [id: string];
  renameImage: [id: string];
  setTagColor: [id: string, color: ImageAsset["tagColor"] | undefined];
}>();

const now = useNow();
const createdAtLabel = computed(() => formatRelativeTime(props.image.createdAt, now.value));

function toggleTagColor(nextColor: ImageAsset["tagColor"]) {
  if (props.image.tagColor === nextColor) {
    emit("setTagColor", props.image.id, undefined);
    return;
  }
  emit("setTagColor", props.image.id, nextColor);
}
</script>

<template>
  <div v-image-preview="image" class="border-t border-border-subtle dark:border-border-subtle px-4 py-3">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold text-content dark:text-content">
          {{ image.name }}
        </div>
        <div class="mt-0.5 text-xs text-content-muted dark:text-content-tertiary">
          {{ sourceLabel(image) }} · {{ createdAtLabel }}
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <a
          v-if="image.previewUrl"
          class="rounded-card px-2 py-1 text-xs text-content dark:text-content-tertiary transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover"
          :download="imageDownloadName(image)"
          :href="image.previewUrl"
        >
          下载
        </a>
        <button
          class="cursor-pointer rounded-card px-2 py-1 text-xs text-content dark:text-content-tertiary transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover"
          type="button"
          @click="emit('renameImage', image.id)"
        >
          重命名
        </button>
        <button
          class="cursor-pointer rounded-card px-2 py-1 text-xs text-red-500 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
          type="button"
          @click="emit('deleteImage', image.id)"
        >
          删除
        </button>
        <button
          class="cursor-pointer rounded-card p-1 text-content-tertiary dark:text-content-muted transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover hover:text-content dark:hover:text-content-tertiary"
          type="button"
          @click="emit('clearSelection')"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="mb-3 flex items-center gap-2">
      <span class="text-xs text-content-tertiary dark:text-content-muted">分类颜色</span>
      <button
        v-for="color in IMAGE_TAG_COLORS"
        :key="color"
        :aria-label="`标记为${color}`"
        :class="[
          'h-3 w-3 cursor-pointer rounded-full border transition-transform hover:scale-105',
          image.tagColor === color
            ? 'border-border-subtle dark:border-border-subtle ring-2 ring-gray-400/60 dark:ring-gray-500/60'
            : 'border-border-subtle dark:border-border-subtle',
        ]"
        :style="{ backgroundColor: imageTagDotColor(color) }"
        type="button"
        @click="toggleTagColor(color)"
      />
    </div>

    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div>
        <dt class="text-content-tertiary dark:text-content-muted">格式</dt>
        <dd class="mt-0.5 text-content dark:text-content-tertiary">
          {{ imageFormat(image) }}
        </dd>
      </div>
      <div>
        <dt class="text-content-tertiary dark:text-content-muted">尺寸</dt>
        <dd class="mt-0.5 text-content dark:text-content-tertiary">{{ imageSize(image) }}</dd>
      </div>
      <div>
        <dt class="text-content-tertiary dark:text-content-muted">文件</dt>
        <dd class="mt-0.5 text-content dark:text-content-tertiary">{{ fileSize(image) }}</dd>
      </div>
      <div>
        <dt class="text-content-tertiary dark:text-content-muted">状态</dt>
        <dd class="mt-0.5 text-content dark:text-content-tertiary">
          {{ isAttached ? "已加入引用" : "未引用" }}
        </dd>
      </div>
    </dl>

    <div class="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-3">
      <div class="min-w-0">
        <div class="text-xs text-content-tertiary dark:text-content-muted">原始 Prompt</div>
        <Tooltip
          :text="image.prompt"
          :delay="500"
          :hide-delay="300"
          hoverable
          multiline
          preferred-placement="top"
        >
          <p
            class="mt-1 line-clamp-2 text-left text-xs leading-relaxed text-content dark:text-content-tertiary"
          >
            {{ image.prompt }}
          </p>
        </Tooltip>
      </div>
      <div class="min-w-0">
        <div class="text-xs text-content-tertiary dark:text-content-muted">实际发送 Prompt</div>
        <Tooltip
          v-if="image.requestPrompt"
          :text="image.requestPrompt"
          :delay="500"
          :hide-delay="300"
          hoverable
          multiline
          preferred-placement="top"
        >
          <p
            class="mt-1 line-clamp-2 text-left text-xs leading-relaxed text-content dark:text-content-tertiary"
          >
            {{ image.requestPrompt }}
          </p>
        </Tooltip>
        <p
          v-else
          class="mt-1 text-xs leading-relaxed text-content-tertiary dark:text-content-muted"
        >
          未记录
        </p>
      </div>
      <div class="min-w-0">
        <div class="text-xs text-content-tertiary dark:text-content-muted">API 改写 Prompt</div>
        <Tooltip
          v-if="image.revisedPrompt"
          :text="image.revisedPrompt"
          :delay="500"
          :hide-delay="300"
          hoverable
          multiline
          preferred-placement="top"
        >
          <p
            class="mt-1 line-clamp-2 text-left text-xs leading-relaxed text-content dark:text-content-tertiary"
          >
            {{ image.revisedPrompt }}
          </p>
        </Tooltip>
        <p
          v-else
          class="mt-1 text-xs leading-relaxed text-content-tertiary dark:text-content-muted"
        >
          未返回
        </p>
      </div>
    </div>
  </div>
</template>
