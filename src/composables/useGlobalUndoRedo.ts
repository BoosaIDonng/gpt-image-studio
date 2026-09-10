import { onMounted, onUnmounted } from "vue";
import { useCommandStore } from "../stores/commandStore";

/**
 * Global Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z (redo) handling.
 *
 * Keyboard shortcuts are skipped while typing in inputs, textareas, selects
 * or contenteditable hosts so native text undo keeps working there.
 */
export function useGlobalUndoRedo() {
  const commandStore = useCommandStore();

  function isTextEntryTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return ["input", "textarea", "select"].includes(target.tagName.toLowerCase());
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() !== "z") return;
    if (isTextEntryTarget(event.target)) return;

    event.preventDefault();
    if (event.shiftKey) {
      void commandStore.redo();
    } else {
      void commandStore.undo();
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}
