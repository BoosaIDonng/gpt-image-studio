import { onMounted, onUnmounted, ref } from "vue";

/**
 * Single source of truth for the desktop breakpoint. Mirrored by Tailwind's `xl`
 * utilities, the shell's inline panels and the floating-chat bottom margin.
 */
export const DESKTOP_MIN_WIDTH = 1280;

/** Keep JS drawer behavior aligned with the shell's `xl` breakpoint. */
export function useDesktopLayout() {
  const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
  const isDesktop = ref(query.matches);
  const update = () => {
    isDesktop.value = query.matches;
  };
  onMounted(() => query.addEventListener("change", update));
  onUnmounted(() => query.removeEventListener("change", update));
  return isDesktop;
}
