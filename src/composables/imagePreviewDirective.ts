import type { Directive } from "vue";
import type { ImageAsset } from "../types/studio";
import { useImagesStore } from "../stores/imagesStore";

/**
 * `v-image-preview` — loads an image asset's preview Blob lazily, when the
 * host element scrolls into the viewport.
 *
 * Previously startup hydrated a preview Blob and object URL for every asset
 * in the library, making first paint cost O(library size). With this
 * directive the cost is O(viewport): cards render their existing "img"
 * placeholder until the asset becomes visible, then the store loads the Blob
 * once and the reactive asset update fills the <img> in place.
 *
 * Attach the directive to a stable container of the card (it must exist even
 * while `previewUrl` is undefined).
 */

const ROOT_MARGIN = "300px";

let sharedObserver: IntersectionObserver | null = null;

type ObservedElement = HTMLElement & {
  __imagePreviewId?: string;
  __imagePreviewVisible?: boolean;
};

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (sharedObserver) return sharedObserver;

  sharedObserver = new IntersectionObserver(
    (entries) => {
      const store = useImagesStore();
      for (const entry of entries) {
        const element = entry.target as ObservedElement;
        if (!entry.isIntersecting) continue;

        sharedObserver?.unobserve(element);
        element.__imagePreviewVisible = true;
        if (element.__imagePreviewId) {
          void store.ensureImagePreview(element.__imagePreviewId);
          element.__imagePreviewId = undefined;
        }
      }
    },
    { rootMargin: ROOT_MARGIN },
  );

  return sharedObserver;
}

function observeElement(element: ObservedElement, asset: ImageAsset | undefined) {
  if (!asset?.id) return;
  if (asset.previewUrl) return;
  if (!asset.blobKey) return;
  if (element.__imagePreviewVisible) return;

  const observer = getObserver();
  if (!observer) {
    // No IntersectionObserver (old browsers / test environment): load directly.
    void useImagesStore().ensureImagePreview(asset.id);
    return;
  }

  element.__imagePreviewId = asset.id;
  observer.observe(element);
}

export const vImagePreview: Directive<ObservedElement, ImageAsset | undefined> = {
  mounted(element, binding) {
    observeElement(element, binding.value);
  },
  updated(element, binding) {
    if (binding.value?.previewUrl) {
      if (element.__imagePreviewId) {
        sharedObserver?.unobserve(element);
        element.__imagePreviewId = undefined;
      }
      return;
    }
    if (binding.value?.id !== binding.oldValue?.id) {
      observeElement(element, binding.value);
    }
  },
  unmounted(element) {
    if (element.__imagePreviewId) {
      sharedObserver?.unobserve(element);
      element.__imagePreviewId = undefined;
    }
  },
};
