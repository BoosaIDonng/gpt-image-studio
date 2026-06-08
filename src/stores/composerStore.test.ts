import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useComposerStore } from "./composerStore";

describe("composer store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("opens and closes the prompt preview modal", () => {
    const composer = useComposerStore();

    expect(composer.isPromptPreviewOpen).toBe(false);

    composer.openPromptPreview();
    expect(composer.isPromptPreviewOpen).toBe(true);

    composer.closePromptPreview();
    expect(composer.isPromptPreviewOpen).toBe(false);
  });
});
