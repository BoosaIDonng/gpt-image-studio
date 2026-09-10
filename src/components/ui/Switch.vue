<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<template>
  <button
    :aria-checked="modelValue"
    :aria-label="label"
    :class="[
      'ui-switch relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
      modelValue ? 'bg-accent' : 'bg-surface-hover',
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
    ]"
    :disabled="disabled"
    role="switch"
    type="button"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      :class="[
        'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none',
        modelValue ? 'translate-x-5.5' : 'translate-x-0.5',
      ]"
      aria-hidden="true"
    />
  </button>
</template>
