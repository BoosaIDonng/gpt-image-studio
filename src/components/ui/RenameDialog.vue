<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { FocusTrap } from "focus-trap-vue";
import Button from "./Button.vue";

const props = defineProps<{
  isOpen: boolean;
  title: string;
  description: string;
  initialValue: string;
  confirmLabel: string;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [value: string];
}>();

const inputValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const normalizedValue = computed(() => inputValue.value.trim());
const canConfirm = computed(() => Boolean(normalizedValue.value));

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return;
    inputValue.value = props.initialValue;
    nextTick(() => inputRef.value?.focus());
  },
);

function confirm() {
  if (!canConfirm.value) return;
  emit("confirm", normalizedValue.value);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="cupertino-dialog-backdrop fixed inset-0 z-60 flex items-center justify-center px-4"
      role="presentation"
      @mousedown.self="emit('cancel')"
    >
      <FocusTrap :active="isOpen">
        <section
          aria-labelledby="renameDialogTitle"
          aria-modal="true"
          class="cupertino-dialog w-full max-w-md rounded-card p-5 shadow-xl"
          role="dialog"
        >
          <div class="mb-4">
            <h2
              id="renameDialogTitle"
              class="text-base font-semibold text-content dark:text-content"
            >
              {{ title }}
            </h2>
            <p class="mt-1 text-sm leading-relaxed text-content-muted dark:text-content-tertiary">
              {{ description }}
            </p>
          </div>

          <input
            ref="inputRef"
            v-model="inputValue"
            class="w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-sm text-content outline-none transition-colors focus:border-accent"
            autocomplete="off"
            type="text"
            @keydown.enter="confirm"
          />

          <div class="mt-5 flex justify-end gap-2">
            <Button variant="secondary" @click="emit('cancel')">取消</Button>
            <Button variant="primary" :disabled="!canConfirm" @click="confirm">
              {{ confirmLabel }}
            </Button>
          </div>
        </section>
      </FocusTrap>
    </div>
  </Teleport>
</template>
