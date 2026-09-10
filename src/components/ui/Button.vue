<script setup lang="ts">
import { computed } from "vue";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  { variant: "secondary", size: "md", type: "button", disabled: false },
);

const classes = computed(() => [
  "ui-button inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
  props.size === "sm"
    ? "min-h-8 rounded-card px-2.5 py-1 text-xs"
    : "min-h-10 rounded-card px-3 py-2 text-sm",
  {
    "bg-accent text-white hover:bg-accent-pressed": props.variant === "primary",
    "border border-border-subtle bg-surface text-content hover:bg-surface-hover":
      props.variant === "secondary",
    "bg-red-600 text-white hover:bg-red-700": props.variant === "danger",
    "text-content-muted hover:bg-surface-hover hover:text-content": props.variant === "ghost",
  },
]);
</script>

<template>
  <button :class="classes" :disabled="disabled" :type="type">
    <slot />
  </button>
</template>
