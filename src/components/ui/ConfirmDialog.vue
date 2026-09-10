<script setup lang="ts">
import { FocusTrap } from "focus-trap-vue";
import Button from "./Button.vue";

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
      class="cupertino-dialog-backdrop fixed inset-0 z-60 flex items-center justify-center px-4"
      role="presentation"
      @mousedown.self="emit('cancel')"
    >
      <FocusTrap :active="!!dialog" :initial-focus="() => false">
        <section
          aria-labelledby="confirmDialogTitle"
          aria-modal="true"
          class="cupertino-dialog w-full max-w-md rounded-card p-5 shadow-xl"
          role="dialog"
        >
          <div class="mb-5">
            <h2
              id="confirmDialogTitle"
              class="text-base font-semibold text-content dark:text-content"
            >
              {{ dialog.title }}
            </h2>
            <p class="mt-1 text-sm leading-relaxed text-content-muted dark:text-content-tertiary">
              {{ dialog.description }}
            </p>
          </div>

          <div class="flex justify-end gap-2">
            <Button variant="secondary" @click="emit('cancel')">取消</Button>
            <Button
              :variant="dialog.tone === 'danger' ? 'danger' : 'primary'"
              @click="emit('confirm')"
            >
              {{ dialog.confirmLabel }}
            </Button>
          </div>
        </section>
      </FocusTrap>
    </div>
  </Teleport>
</template>
