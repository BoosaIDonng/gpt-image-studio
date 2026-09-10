import { defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import { useFeedbackStore } from "./feedbackStore";

/**
 * Global command stack behind Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z (redo).
 *
 * Commands describe a reversible user operation; `run` performs it and `undo`
 * reverts it, including the IndexedDB write. Only explicitly undoable
 * operations are registered here — destructive flows keep their own
 * confirmation dialogs, and generation/retry results are not auto-registered
 * because their previous state (a pending in-flight request) cannot be
 * meaningfully restored.
 */

const MAX_HISTORY = 50;

export type UndoableCommand = {
  label: string;
  run: () => Promise<void> | void;
  undo: () => Promise<void> | void;
};

export const useCommandStore = defineStore("commands", () => {
  const undoStack = shallowRef<UndoableCommand[]>([]);
  const redoStack = shallowRef<UndoableCommand[]>([]);
  let isBusy = false;

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  async function execute(command: UndoableCommand) {
    await command.run();
    undoStack.value = [...undoStack.value.slice(-(MAX_HISTORY - 1)), command];
    redoStack.value = [];
  }

  async function undo() {
    const command = undoStack.value[undoStack.value.length - 1];
    if (!command || isBusy) return;

    isBusy = true;
    try {
      await command.undo();
      undoStack.value = undoStack.value.slice(0, -1);
      redoStack.value = [...redoStack.value, command];
      useFeedbackStore().notifySuccess(`已撤销：${command.label}`);
    } finally {
      isBusy = false;
    }
  }

  async function redo() {
    const command = redoStack.value[redoStack.value.length - 1];
    if (!command || isBusy) return;

    isBusy = true;
    try {
      await command.run();
      redoStack.value = redoStack.value.slice(0, -1);
      undoStack.value = [...undoStack.value, command];
      useFeedbackStore().notifySuccess(`已重做：${command.label}`);
    } finally {
      isBusy = false;
    }
  }

  function clear() {
    undoStack.value = [];
    redoStack.value = [];
  }

  return { canRedo, canUndo, clear, execute, redo, undo };
});
