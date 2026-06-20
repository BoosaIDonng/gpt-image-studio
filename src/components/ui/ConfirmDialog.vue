<script setup lang="ts">
import { FocusTrap } from "focus-trap-vue";

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "default";
};

defineProps<{
  dialog: ConfirmDialogState | null;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dialog"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4"
      role="presentation"
      @mousedown.self="emit('cancel')"
    >
      <FocusTrap :active="!!dialog" :initial-focus="() => false">
        <section
          aria-labelledby="confirmDialogTitle"
          aria-modal="true"
          class="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl"
          role="dialog"
        >
        <div class="mb-5">
          <h2
            id="confirmDialogTitle"
            class="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {{ dialog.title }}
          </h2>
          <p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {{ dialog.description }}
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
            type="button"
            @click="emit('cancel')"
          >
            取消
          </button>
          <button
            class="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            :class="
              dialog.tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                : 'bg-black dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300'
            "
            type="button"
            @click="emit('confirm')"
          >
            {{ dialog.confirmLabel }}
          </button>
        </div>
        </section>
      </FocusTrap>
    </div>
  </Teleport>
</template>
