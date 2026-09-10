<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { FocusTrap } from "focus-trap-vue";
import { useDesktopLayout } from "../../composables/useDesktopLayout";

const props = defineProps<{
  id: string;
  label: string;
  side: "left" | "right";
  open: boolean;
  collapsed: boolean;
  width: number;
}>();
const emit = defineEmits<{ close: []; resetMobile: [] }>();
const isDesktop = useDesktopLayout();
const visible = computed(() => (isDesktop.value ? !props.collapsed : props.open));
/** Below 1280px the panel behaves as a modal drawer; at/above it is an inline column. */
const drawerMode = computed(() => !isDesktop.value);
/** The scrim only exists for the modal drawer form. */
const scrimVisible = computed(() => visible.value && drawerMode.value);
const panel = ref<HTMLElement | null>(null);

/** The drawer needs a focus trap; the desktop column renders a plain flex child. */
const wrapper = computed(() => (drawerMode.value ? FocusTrap : "div"));
const wrapperProps = computed(() =>
  drawerMode.value
    ? { active: true, initialFocus: () => false, returnFocusOnDeactivate: false }
    : { class: "contents" },
);

watch(isDesktop, () => emit("resetMobile"));

/**
 * Escape must dismiss the drawer even when focus sits outside the panel
 * (for example on the header toggle that opened it), so listen on the window
 * instead of relying only on the panel's own keydown handler.
 */
function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}
watch(
  scrimVisible,
  (shown) => {
    if (shown) window.addEventListener("keydown", onWindowKeydown);
    else window.removeEventListener("keydown", onWindowKeydown);
  },
  { immediate: true },
);
onBeforeUnmount(() => window.removeEventListener("keydown", onWindowKeydown));

/** Focus the drawer once it is actually mounted, so the trap opens on the panel. */
watch(
  visible,
  (shown) => {
    if (!shown || !drawerMode.value) return;
    (panel.value ?? document.getElementById(props.id))?.focus();
  },
  { flush: "post" },
);

/**
 * Hand focus back to the header toggle when the drawer closes. The check uses a
 * DOM lookup because the panel ref may already be cleared by the time this runs.
 */
watch(visible, (shown) => {
  if (shown || isDesktop.value) return;
  const focusWasInPanel = !!document.getElementById(props.id)?.contains(document.activeElement);
  const focusWasElsewhere =
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body &&
    !focusWasInPanel;
  if (focusWasElsewhere) return;
  nextTick(() =>
    document.querySelector<HTMLButtonElement>(`[aria-controls="${props.id}"]`)?.focus(),
  );
});
</script>

<template>
  <div
    v-if="scrimVisible"
    class="fixed inset-0 z-30 bg-black/35"
    @mousedown.self="emit('close')"
    aria-hidden="true"
  />
  <!--
    focus-trap-vue requires exactly one child whose subtree has a tabbable node,
    so the trap is mounted together with the panel (`v-if="visible"`) and the
    scrim lives outside it. When visible is false nothing is rendered at all,
    which keeps hidden controls unfocusable.
  -->
  <component :is="wrapper" v-if="visible" v-bind="wrapperProps">
    <aside
      :id="id"
      ref="panel"
      :aria-label="label"
      :aria-modal="drawerMode ? true : undefined"
      :role="drawerMode ? 'dialog' : 'complementary'"
      :style="{ width: isDesktop ? `${width}px` : 'min(92vw, 360px)' }"
      :class="[
        'studio-panel flex min-h-0 shrink-0 flex-col',
        side === 'left' ? 'cupertino-sidebar' : 'cupertino-library border-l border-border-subtle',
        drawerMode
          ? ['fixed inset-y-0 z-40 shadow-xl', side === 'left' ? 'left-0' : 'right-0']
          : '',
      ]"
      tabindex="-1"
      @keydown.esc.stop.prevent="emit('close')"
    >
      <slot />
    </aside>
  </component>
</template>
