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

  it("can open the image library with an explicit default scope", () => {
    const composer = useComposerStore();

    expect(composer.imageLibraryScope).toBe("current");

    composer.openImageLibrary("all");
    expect(composer.isLibraryOpen).toBe(true);
    expect(composer.imageLibraryScope).toBe("all");

    composer.setLibraryOpen(false);
    expect(composer.isLibraryOpen).toBe(false);
    expect(composer.imageLibraryScope).toBe("all");
  });
});
