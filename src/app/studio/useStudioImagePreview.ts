import { computed, ref, type Ref } from "vue";
import type { ImageAsset } from "../../types/studio";

export function useStudioImagePreview(ctx: {
  imageById: (id: string) => ImageAsset | undefined;
  activeAttachments: Ref<Array<{ id: string }>>;
  activeEditSourceImageId: Ref<string>;
  activeEditMaskImageId: Ref<string>;
}) {
  const previewImageId = ref("");

  const previewImage = computed(() => ctx.imageById(previewImageId.value));

  const previewMaskUrl = computed(() => {
    if (previewImageId.value !== ctx.activeEditSourceImageId.value) return undefined;
    const maskAsset = ctx.imageById(ctx.activeEditMaskImageId.value);
    return maskAsset?.previewUrl;
  });

  const attachedImageIds = computed(() => ctx.activeAttachments.value.map((image) => image.id));

  function previewImageById(id: string) {
    previewImageId.value = id;
  }

  function closePreview() {
    previewImageId.value = "";
  }

  return {
    previewImageId,
    previewImage,
    previewMaskUrl,
    attachedImageIds,
    previewImageById,
    closePreview,
  };
}
