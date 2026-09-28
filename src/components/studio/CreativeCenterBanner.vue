<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useComposerStore } from "../../stores/composerStore";
import { useGenerationStore } from "../../stores/generationStore";
import { useImagesStore } from "../../stores/imagesStore";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  buildCreativeCenterStatus,
  creativeTemplates,
  promptFromTemplate,
  type CreativeTemplate,
} from "./creativeCenter";

const props = defineProps<{
  failedMessageCount: number;
  messageCount: number;
}>();

const emit = defineEmits<{
  openApiSettings: [];
  openLibrary: [];
}>();

const composer = useComposerStore();
const generation = useGenerationStore();
const images = useImagesStore();
const settings = useSettingsStore();

const status = computed(() =>
  buildCreativeCenterStatus({
    connectionMode: settings.connectionMode,
    apiKey: settings.apiKey,
    companionPaired: settings.companionPaired,
    pendingJobCount: generation.pendingJobCount,
    failedMessageCount: props.failedMessageCount,
    imageCount: images.imageAssets.length,
    messageCount: props.messageCount,
  }),
);

const hasReferences = computed(() => images.attachedImages.length > 0);

function applyTemplate(template: CreativeTemplate) {
  composer.composerText = promptFromTemplate(template, hasReferences.value);
  composer.closeAllEditors();
}

function statusToneClass(tone: "ok" | "warning") {
  return tone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300";
}

// 模板行横向溢出时在右缘显示渐隐提示；滚动到末尾后隐藏。
const templateRowRef = ref<HTMLElement | null>(null);
const templateRowScrollable = ref(false);
let templateRowResizeObserver: ResizeObserver | null = null;

function updateTemplateRowScrollState() {
  const el = templateRowRef.value;
  templateRowScrollable.value = !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
}

onMounted(() => {
  updateTemplateRowScrollState();
  templateRowRef.value?.addEventListener("scroll", updateTemplateRowScrollState, { passive: true });
  if (typeof ResizeObserver !== "undefined" && templateRowRef.value) {
    templateRowResizeObserver = new ResizeObserver(updateTemplateRowScrollState);
    templateRowResizeObserver.observe(templateRowRef.value);
  }
});

onBeforeUnmount(() => {
  templateRowResizeObserver?.disconnect();
  templateRowResizeObserver = null;
});
</script>

<template>
  <section class="border-b border-border-subtle bg-transparent px-4 py-3">
    <div class="mx-auto flex max-w-3xl flex-col gap-3">
      <div class="flex min-w-0 items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-sm font-semibold text-content">创作</span>
          <span
            class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass(status.connectionTone)"
          >
            {{ status.connectionLabel }}
          </span>
          <span class="truncate text-xs text-content-muted">{{ status.activityLabel }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            v-if="status.connectionTone === 'warning'"
            class="cursor-pointer rounded-card px-2.5 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-hover"
            type="button"
            @click="emit('openApiSettings')"
          >
            设置接口
          </button>
          <button
            class="cursor-pointer rounded-card px-2.5 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-hover"
            type="button"
            @click="emit('openLibrary')"
          >
            图片库
          </button>
        </div>
      </div>

      <div class="relative">
        <div
          ref="templateRowRef"
          class="flex gap-2 overflow-x-auto pb-1"
          @scroll="updateTemplateRowScrollState"
        >
          <button
            v-for="template in creativeTemplates"
            :key="template.id"
            class="min-w-35 shrink-0 cursor-pointer rounded-card border border-border-subtle bg-surface px-3 py-2 text-left transition-colors hover:border-border-subtle hover:bg-surface-hover"
            type="button"
            @click="applyTemplate(template)"
          >
            <div class="text-sm font-semibold text-content">{{ template.label }}</div>
            <div class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-content-muted">
              {{ hasReferences ? "按引用图生成编辑提示" : template.description }}
            </div>
          </button>
        </div>
        <div
          v-if="templateRowScrollable"
          class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--cupertino-background)] to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  </section>
</template>
