<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
const isExpanded = ref(false);

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

watch(
  () => status.value.shouldExpandByDefault,
  (shouldExpand) => {
    if (shouldExpand) isExpanded.value = true;
  },
  { immediate: true },
);

function applyTemplate(template: CreativeTemplate) {
  composer.composerText = promptFromTemplate(template, hasReferences.value);
  composer.closeAllEditors();
}

function statusToneClass(tone: "ok" | "warning") {
  return tone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}
</script>

<template>
  <section class="border-b border-gray-200 bg-gray-50/70 px-4 py-3">
    <div class="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        class="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left"
        type="button"
        @click="isExpanded = !isExpanded"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-gray-900">创作中心</span>
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-medium"
              :class="statusToneClass(status.connectionTone)"
            >
              {{ status.connectionLabel }}
            </span>
            <span
              class="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              {{ status.activityLabel }}
            </span>
          </div>
          <p class="mt-1 truncate text-xs text-gray-500">
            {{ status.connectionDetail }}；{{ status.activityDetail }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="status.connectionTone === 'warning'"
            class="cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            type="button"
            @click.stop="emit('openApiSettings')"
          >
            去设置
          </button>
          <span class="text-xs font-medium text-gray-500">
            {{ isExpanded ? "收起" : "展开" }}
          </span>
        </div>
      </button>

      <div
        v-if="isExpanded"
        class="grid gap-3 border-t border-gray-100 p-4 lg:grid-cols-[1fr_1.6fr]"
      >
        <section class="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">项目状态</h2>
          <div class="mt-3 space-y-2">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="text-gray-600">连接</span>
              <span class="font-medium text-gray-900">{{ status.connectionLabel }}</span>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="text-gray-600">生成</span>
              <span class="font-medium text-gray-900">{{ status.activityLabel }}</span>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="text-gray-600">图库</span>
              <span class="font-medium text-gray-900">{{ images.imageAssets.length }} 张图片</span>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              class="cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              type="button"
              @click="emit('openApiSettings')"
            >
              测试/配置连接
            </button>
            <button
              class="cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              type="button"
              @click="emit('openLibrary')"
            >
              打开图库
            </button>
          </div>
        </section>

        <section class="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">模板中心</h2>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              v-for="template in creativeTemplates"
              :key="template.id"
              class="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
              type="button"
              @click="applyTemplate(template)"
            >
              <div class="text-sm font-semibold text-gray-900">{{ template.label }}</div>
              <div class="mt-0.5 text-xs leading-relaxed text-gray-500">
                {{ hasReferences ? "按引用图生成编辑提示" : template.description }}
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
