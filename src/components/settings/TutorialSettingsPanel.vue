<script setup lang="ts">
import { computed } from "vue";
import { useSettingsModalContext } from "./settingsModalContext";
import { buildTutorialSteps } from "./tutorial";

const ctx = useSettingsModalContext();

const isConnected = computed(() =>
  ctx.connectionMode.value === "localCompanion"
    ? ctx.companionPaired.value
    : Boolean(ctx.apiKey.value.trim()),
);

const tutorialSteps = computed(() =>
  buildTutorialSteps({
    isConnected: isConnected.value,
    hasPrompted: ctx.messages.value.length > 0,
    hasCreated: ctx.images.value.length > 0,
  }),
);
</script>

<template>
  <section aria-labelledby="tutorialSettingsTitle" class="space-y-5">
    <div>
      <h3 id="tutorialSettingsTitle" class="text-base font-semibold text-content">教程</h3>
      <p class="mt-1 text-sm leading-relaxed text-content-muted">
        按顺序完成基础流程，后续可以在创作中心直接选择模板起稿。
      </p>
    </div>

    <ol class="grid gap-3 md:grid-cols-3">
      <li
        v-for="(step, index) in tutorialSteps"
        :key="step.label"
        class="rounded-card border border-border-subtle bg-surface p-4"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
            :class="
              step.done
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-border-subtle bg-surface-muted text-content-muted'
            "
          >
            {{ step.done ? "✓" : index + 1 }}
          </span>
          <div>
            <div class="text-sm font-semibold text-content">{{ step.label }}</div>
            <div class="mt-0.5 text-xs text-content-muted">
              {{ step.done ? "已完成" : "待完成" }}
            </div>
          </div>
        </div>
      </li>
    </ol>

    <div class="rounded-card border border-border-subtle bg-surface-muted p-4">
      <h4 class="text-sm font-semibold text-content">基础创作流程</h4>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="rounded-card border border-border-subtle bg-surface p-3">
          <div class="text-sm font-medium text-content">文字生成</div>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            选择模板或输入提示词，确认模型和尺寸后发送。
          </p>
        </div>
        <div class="rounded-card border border-border-subtle bg-surface p-3">
          <div class="text-sm font-medium text-content">引用图编辑</div>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            上传或从图库附加图片，再输入要保留和修改的内容。
          </p>
        </div>
        <div class="rounded-card border border-border-subtle bg-surface p-3">
          <div class="text-sm font-medium text-content">局部重绘</div>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            开启编辑模式，画出遮罩区域，只重绘选中的局部。
          </p>
        </div>
        <div class="rounded-card border border-border-subtle bg-surface p-3">
          <div class="text-sm font-medium text-content">结果管理</div>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            在图库预览、重命名、复用结果，保持项目素材可追踪。
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
