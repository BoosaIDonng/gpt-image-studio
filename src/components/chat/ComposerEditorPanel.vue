<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "../../stores/settingsStore";
import type { EditorKey } from "../../types/studio";

defineProps<{
  activeEditor: EditorKey | null;
}>();

const settings = useSettingsStore();
const isRatioMode = computed(() =>
  settings.sizeRatioOptions.some((option) => option.value === settings.activeSizePreset),
);

function selectRatioMode() {
  if (isRatioMode.value) return;
  settings.applySizePreset("1:1");
}
</script>

<template>
  <div
    v-if="activeEditor"
    class="absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-panel border border-border-subtle bg-surface p-2 shadow-lg"
    @click.stop
  >
    <div v-if="activeEditor === 'size'" class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <button
            :class="[
              'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
              settings.activeSizePreset === 'auto'
                ? 'border-border-subtle bg-surface-muted text-content'
                : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
            ]"
            type="button"
            @click="settings.applySizePreset('auto')"
          >
            自动
          </button>
          <button
            :class="[
              'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
              isRatioMode
                ? 'border-border-subtle bg-surface-muted text-content'
                : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
            ]"
            type="button"
            @click="selectRatioMode"
          >
            比例
          </button>
          <button
            v-if="!settings.grokCustomSizeDisabled"
            :class="[
              'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
              settings.activeSizePreset === 'custom'
                ? 'border-border-subtle bg-surface-muted text-content'
                : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
            ]"
            type="button"
            @click="settings.applySizePreset('custom')"
          >
            自定义
          </button>
        </div>
        <div v-if="isRatioMode" class="flex items-center gap-1">
          <button
            v-for="resolution in settings.sizeResolutionOptions"
            :key="resolution.value"
            :class="[
              'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
              settings.sizeResolution === resolution.value
                ? 'border-border-subtle bg-surface-muted text-content'
                : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
            ]"
            type="button"
            @click="settings.applySizeResolution(resolution.value)"
          >
            {{ resolution.label }}
          </button>
        </div>
      </div>

      <div v-if="isRatioMode" class="grid w-64 grid-cols-4 gap-1.5">
        <button
          v-for="ratio in settings.sizeRatioOptions"
          :key="ratio.value"
          :class="[
            'cursor-pointer rounded border px-1.5 py-1 text-xs transition-colors',
            settings.activeSizePreset === ratio.value
              ? 'border-border-subtle bg-surface-muted text-content'
              : 'border-border-subtle text-content-muted hover:bg-surface-hover',
          ]"
          type="button"
          @click="settings.applySizePreset(ratio.value)"
        >
          {{ ratio.label }}
        </button>
      </div>

      <div v-if="settings.activeSizePreset === 'custom'" class="flex items-center gap-2">
        <input
          :value="settings.imageWidth"
          class="w-20 rounded-card border border-border-subtle bg-surface px-2 py-1 text-xs text-content outline-none focus:border-border-subtle"
          type="number"
          min="16"
          max="3840"
          step="16"
          placeholder="宽"
          @input="settings.imageWidth = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="text-xs text-content-tertiary">×</span>
        <input
          :value="settings.imageHeight"
          class="w-20 rounded-card border border-border-subtle bg-surface px-2 py-1 text-xs text-content outline-none focus:border-border-subtle"
          type="number"
          min="16"
          max="3840"
          step="16"
          placeholder="高"
          @input="settings.imageHeight = Number(($event.target as HTMLInputElement).value)"
        />
      </div>
      <p v-if="settings.customSizeError" class="basis-full pt-1 text-xs text-red-500">
        {{ settings.customSizeError }}
      </p>
    </div>

    <div v-if="activeEditor === 'count'" class="w-72 space-y-2">
      <div class="flex items-center gap-1.5">
        <button
          :class="[
            'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
            settings.imageCountMode === 'preset'
              ? 'border-border-subtle bg-surface-muted text-content'
              : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
          ]"
          type="button"
          @click="settings.applyImageCountMode('preset')"
        >
          选择
        </button>
        <button
          :class="[
            'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
            settings.imageCountMode === 'custom'
              ? 'border-border-subtle bg-surface-muted text-content'
              : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
          ]"
          type="button"
          @click="settings.applyImageCountMode('custom')"
        >
          自定义
        </button>
      </div>

      <div v-if="settings.imageCountMode === 'preset'" class="grid grid-cols-4 gap-1.5">
        <button
          v-for="count in settings.imageCountPresets"
          :key="count"
          :class="[
            'cursor-pointer rounded border px-1.5 py-1 text-xs transition-colors',
            settings.imageCount === count
              ? 'border-border-subtle bg-surface-muted text-content'
              : 'border-border-subtle text-content-muted hover:bg-surface-hover',
          ]"
          type="button"
          @click="settings.applyImageCount(count, 'preset')"
        >
          {{ count }}
        </button>
      </div>

      <div v-if="settings.imageCountMode === 'custom'" class="flex items-center gap-2">
        <input
          :value="settings.imageCount"
          class="w-24 rounded-card border border-border-subtle bg-surface px-2 py-1 text-xs text-content outline-none focus:border-border-subtle"
          type="number"
          :min="settings.minImageCount"
          step="1"
          placeholder="数量"
          @input="settings.applyImageCount(($event.target as HTMLInputElement).value, 'custom')"
        />
        <span class="text-xs text-content-tertiary">张</span>
      </div>

      <p class="text-xs leading-relaxed text-content-tertiary">
        理论无上限，但请量力而行；一次太多可能影响本机和API供应商的服务器。
      </p>
    </div>

    <div v-if="activeEditor === 'background'" class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="opt in settings.backgroundOptions"
        :key="opt.value"
        :disabled="opt.value === 'transparent' && settings.transparentDisabled"
        :class="[
          'rounded border px-1.5 py-0.5 text-xs transition-colors',
          opt.value === 'transparent' && settings.transparentDisabled
            ? 'cursor-not-allowed border-border-subtle text-content-tertiary'
            : settings.background === opt.value
              ? 'cursor-pointer border-border-subtle bg-surface-muted text-content'
              : 'cursor-pointer border-border-subtle text-content-tertiary hover:bg-surface-hover',
        ]"
        type="button"
        @click="settings.background = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="activeEditor === 'quality'" class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="opt in settings.qualityOptions"
        :key="opt.value"
        :class="[
          'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
          settings.quality === opt.value
            ? 'border-border-subtle bg-surface-muted text-content'
            : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
        ]"
        type="button"
        @click="settings.quality = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="activeEditor === 'format'" class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="opt in settings.formatOptions"
        :key="opt.value"
        :class="[
          'cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors',
          settings.outputFormat === opt.value
            ? 'border-border-subtle bg-surface-muted text-content'
            : 'border-border-subtle text-content-tertiary hover:bg-surface-hover',
        ]"
        type="button"
        @click="settings.outputFormat = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
