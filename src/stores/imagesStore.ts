import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import {
  deleteImageAsset,
  deleteImageBlob,
  loadImageBlob,
  saveImageAsset,
  saveImageBlob,
} from "../services/imageAssets";
import { readImageDimensions } from "../services/imageMetadata";
import { estimateStorageUsage, type StorageUsage } from "../services/storageUsage";
import { isoTimestamp } from "../shared/dateTime";
import { formatError } from "../shared/errors";
import { createId } from "../shared/id";
import { createObjectUrl, revokeObjectUrls } from "../shared/objectUrls";
import { toPlainImageAsset } from "./generationStoreUtils";
import { useCommandStore } from "./commandStore";
import { useFeedbackStore } from "./feedbackStore";
import type { ImageAsset, Message } from "../types/studio";
import type { Ref } from "vue";

type ImagesStoreContext = {
  activeConversationId: Ref<string>;
  messages: Ref<Message[]>;
  onStorageError: (error: unknown) => void;
};

export const useImagesStore = defineStore("images", () => {
  const attachedImages = shallowRef<string[]>([]);
  const imageAssets = shallowRef<ImageAsset[]>([]);
  const storageUsage = ref<StorageUsage | null>(null);
  let context: ImagesStoreContext | null = null;

  const imageIndex = computed(() => {
    const index = new Map<string, ImageAsset>();
    for (const image of imageAssets.value) index.set(image.id, image);
    return index;
  });

  const activeAttachments = computed(() =>
    attachedImages.value
      .map((id) => imageIndex.value.get(id))
      .filter((image): image is ImageAsset => Boolean(image)),
  );

  /**
   * Mean recorded generation duration across assets — used as the ETA basis
   * for non-streaming providers where nothing else hints at progress.
   */
  const averageGenerationDurationMs = computed(() => {
    const durations = imageAssets.value
      .map((image) => image.generationDurationMs)
      .filter((value): value is number => typeof value === "number" && value > 0)
      .slice(-40);
    if (!durations.length) return 0;
    return durations.reduce((sum, value) => sum + value, 0) / durations.length;
  });

  watch(
    imageAssets,
    (nextImages, previousImages) => {
      revokeRemovedPreviewUrls(previousImages, nextImages);
    },
    { flush: "post" },
  );

  function configureImagesStore(nextContext: ImagesStoreContext) {
    context = nextContext;
  }

  function revokePreviewUrls() {
    revokeObjectUrls(imageAssets.value.map((image) => image.previewUrl));
  }

  function imageById(id: string) {
    return imageIndex.value.get(id);
  }

  /** Replace an image without moving it to the front, so list order stays stable. */
  function replaceImage(image: ImageAsset) {
    imageAssets.value = imageAssets.value.map((item) => (item.id === image.id ? image : item));
  }

  function attachImage(id: string) {
    if (!attachedImages.value.includes(id)) {
      attachedImages.value = [...attachedImages.value, id];
    }
  }

  function removeAttachment(id: string) {
    attachedImages.value = attachedImages.value.filter((item) => item !== id);
  }

  async function deleteImage(id: string) {
    const image = imageById(id);
    if (!image) return;

    const input = getContext();
    const relatedMessages = input.messages.value.filter(
      (message) => message.referencedImageIds.includes(id) || message.resultImageIds.includes(id),
    );
    const isAttached = attachedImages.value.includes(id);

    const confirmMessage =
      relatedMessages.length || isAttached
        ? "这张图片正在被聊天记录或当前输入引用，删除后聊天记录中会保留无法显示的占位。确定删除吗？"
        : "确定从图片库中删除这张图片吗？";
    const feedback = useFeedbackStore();
    const confirmed = await feedback.requestConfirmation({
      title: "删除图片",
      description: confirmMessage,
      confirmLabel: "删除图片",
      tone: "danger",
    });
    if (!confirmed) return;

    const index = imageAssets.value.findIndex((item) => item.id === id);
    // Keep the blob in memory so undo can restore the record after deletion.
    const blob = image.blobKey
      ? await loadImageBlob(image.blobKey).catch(() => undefined)
      : undefined;
    const commands = useCommandStore();

    try {
      await commands.execute({
        label: "删除图片",
        run: async () => {
          attachedImages.value = attachedImages.value.filter((item) => item !== id);
          imageAssets.value = imageAssets.value.filter((item) => item.id !== id);
          await Promise.all([
            deleteImageAsset(id),
            image.blobKey ? deleteImageBlob(image.blobKey) : Promise.resolve(),
          ]);
          await refreshStorageUsage();
          feedback.notifySuccess("图片已删除。");
        },
        undo: async () => {
          const restored = { ...image, previewUrl: image.previewUrl };
          const list = [...imageAssets.value];
          list.splice(Math.min(Math.max(index, 0), list.length), 0, restored);
          imageAssets.value = list;
          await Promise.all([
            saveImageAsset(toPlainImageAsset(restored)),
            blob && image.blobKey ? saveImageBlob(image.blobKey, blob) : Promise.resolve(),
          ]);
          await refreshStorageUsage();
        },
      });
    } catch (error) {
      feedback.notifyError(`删除图片失败：${formatError(error)}`);
      input.onStorageError(error);
    }
  }

  async function deleteImages(ids: string[]) {
    const idSet = new Set(ids);
    if (!idSet.size) return;

    const input = getContext();
    const feedback = useFeedbackStore();
    const deletedImages = imageAssets.value.filter((image) => idSet.has(image.id));

    try {
      const captured = await Promise.all(
        deletedImages.map(async (image) => ({
          image,
          index: imageAssets.value.findIndex((item) => item.id === image.id),
          blob: image.blobKey
            ? await loadImageBlob(image.blobKey).catch(() => undefined)
            : undefined,
        })),
      );
      const previousAttached = [...attachedImages.value];
      const commands = useCommandStore();

      await commands.execute({
        label: `删除 ${deletedImages.length} 张图片`,
        run: async () => {
          attachedImages.value = attachedImages.value.filter((id) => !idSet.has(id));
          imageAssets.value = imageAssets.value.filter((image) => !idSet.has(image.id));
          await Promise.all(
            captured.flatMap(({ image }) => [
              deleteImageAsset(image.id),
              image.blobKey ? deleteImageBlob(image.blobKey) : Promise.resolve(),
            ]),
          );
          await refreshStorageUsage();
          feedback.notifySuccess(`已删除 ${deletedImages.length} 张图片。`);
        },
        undo: async () => {
          const list = [...imageAssets.value];
          for (const { image, index } of captured) {
            list.splice(Math.min(Math.max(index, 0), list.length), 0, { ...image });
          }
          imageAssets.value = list;
          attachedImages.value = previousAttached;
          await Promise.all(
            captured.flatMap(({ image, blob }) => [
              saveImageAsset(toPlainImageAsset(image)),
              blob && image.blobKey ? saveImageBlob(image.blobKey, blob) : Promise.resolve(),
            ]),
          );
          await refreshStorageUsage();
        },
      });
    } catch (error) {
      feedback.notifyError(`删除图片失败：${formatError(error)}`);
      input.onStorageError(error);
    }
  }

  async function renameImage(id: string, nextName: string) {
    const current = imageById(id);
    if (!current) return false;

    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === current.name) return false;

    const input = getContext();
    const commands = useCommandStore();
    const applyName = async (name: string) => {
      const image = imageById(id);
      if (!image) return;
      const updated: ImageAsset = { ...image, name, updatedAt: isoTimestamp() };
      replaceImage(updated);
      await saveImageAsset(toPlainImageAsset(updated)).catch(input.onStorageError);
    };

    await commands.execute({
      label: "重命名图片",
      run: () => applyName(trimmedName),
      undo: () => applyName(current.name),
    });
    return true;
  }

  async function setImageTagColor(id: string, nextColor?: ImageAsset["tagColor"]) {
    const current = imageById(id);
    if (!current) return false;
    if (current.tagColor === nextColor) return false;

    const input = getContext();
    const commands = useCommandStore();
    const applyColor = async (color?: ImageAsset["tagColor"]) => {
      const image = imageById(id);
      if (!image) return;
      const updated: ImageAsset = { ...image, tagColor: color, updatedAt: isoTimestamp() };
      replaceImage(updated);
      await saveImageAsset(toPlainImageAsset(updated)).catch(input.onStorageError);
    };

    await commands.execute({
      label: "设置图片标签",
      run: () => applyColor(nextColor),
      undo: () => applyColor(current.tagColor),
    });
    return true;
  }

  async function importImages(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const input = getContext();
    const feedback = useFeedbackStore();
    try {
      const importedAssets = await Promise.all(imageFiles.map((file) => importImageFile(file)));

      imageAssets.value = [...importedAssets, ...imageAssets.value];
      importedAssets.forEach((asset) => attachImage(asset.id));
      await refreshStorageUsage();
      feedback.notifySuccess(`已导入 ${importedAssets.length} 张图片并加入引用。`);
    } catch (error) {
      feedback.notifyError(`导入图片失败：${formatError(error)}`);
      input.onStorageError(error);
    }
  }

  async function importImageFile(file: File) {
    const input = getContext();
    const now = Date.now() + Math.floor(Math.random() * 1000);
    const createdAt = isoTimestamp(now);
    const dimensions = await readImageDimensions(file);
    const imageId = createId("img");
    const blobKey = createId("blob");
    const imageAsset: ImageAsset = {
      id: imageId,
      blobKey,
      name: file.name || `导入图片-${now}`,
      source: "imported",
      mimeType: file.type || "image/png",
      width: dimensions?.width,
      height: dimensions?.height,
      sizeBytes: file.size,
      conversationId: input.activeConversationId.value || undefined,
      prompt: "用户导入的参考图",
      createdAt,
      updatedAt: createdAt,
      previewUrl: createObjectUrl(file),
    };

    await Promise.all([
      saveImageBlob(blobKey, file),
      saveImageAsset(toPlainImageAsset(imageAsset)),
    ]).catch(input.onStorageError);

    return imageAsset;
  }

  async function createMaskAsset(sourceImage: ImageAsset, maskBlob: Blob) {
    const input = getContext();
    const now = Date.now();
    const createdAt = isoTimestamp(now);
    const imageId = createId("img");
    const maskAsset: ImageAsset = {
      id: imageId,
      blobKey: undefined,
      name: `${sourceImage.name}-编辑区域`,
      source: "generated",
      mimeType: "image/png",
      width: sourceImage.width,
      height: sourceImage.height,
      sizeBytes: maskBlob.size,
      conversationId: input.activeConversationId.value || undefined,
      prompt: "局部编辑遮罩",
      editSourceImageId: sourceImage.id,
      isEditMask: true,
      isTransientMask: true,
      transientBlob: maskBlob,
      createdAt,
      updatedAt: createdAt,
      previewUrl: createObjectUrl(maskBlob),
    };

    imageAssets.value = [maskAsset, ...imageAssets.value];
    return maskAsset;
  }

  function clearTransientMask(id: string) {
    const image = imageById(id);
    if (!image?.isTransientMask) return;
    attachedImages.value = attachedImages.value.filter((item) => item !== id);
    imageAssets.value = imageAssets.value.filter((item) => item.id !== id);
  }

  const previewLoadInFlight = new Set<string>();

  /**
   * Load an asset's preview Blob on demand (viewport-triggered via
   * `v-image-preview`). Startup no longer hydrates the whole library, so the
   * Blob-read count is O(viewport), not O(library).
   */
  async function ensureImagePreview(id: string) {
    const image = imageById(id);
    if (!image || image.previewUrl || !image.blobKey || previewLoadInFlight.has(id)) return;

    previewLoadInFlight.add(id);
    const input = getContext();
    try {
      const blob = await loadImageBlob(image.blobKey);
      if (!blob) return;

      let restored: ImageAsset = { ...image, previewUrl: createObjectUrl(blob) };
      if (!restored.width || !restored.height) {
        const dimensions = await readImageDimensions(blob);
        if (dimensions)
          restored = { ...restored, width: dimensions.width, height: dimensions.height };
      }
      replaceImage(restored);
      await saveImageAsset(toPlainImageAsset(restored)).catch(input.onStorageError);
    } finally {
      previewLoadInFlight.delete(id);
    }
  }

  async function refreshStorageUsage() {
    const input = getContext();
    storageUsage.value = await estimateStorageUsage().catch((error) => {
      input.onStorageError(error);
      return storageUsage.value;
    });
  }

  function getContext() {
    if (!context) {
      throw new Error("Images store is not configured.");
    }

    return context;
  }

  return {
    activeAttachments,
    attachedImages,
    averageGenerationDurationMs,
    imageAssets,
    storageUsage,
    attachImage,
    clearTransientMask,
    configureImagesStore,
    createMaskAsset,
    deleteImage,
    deleteImages,
    ensureImagePreview,
    imageById,
    importImages,
    refreshStorageUsage,
    removeAttachment,
    renameImage,
    revokePreviewUrls,
    setImageTagColor,
  };
});

function revokeRemovedPreviewUrls(
  previousImages: ImageAsset[] | undefined,
  nextImages: ImageAsset[],
) {
  if (!previousImages?.length) return;

  const nextPreviewUrls = new Set(
    nextImages.map((image) => image.previewUrl).filter((url): url is string => Boolean(url)),
  );
  revokeObjectUrls(
    previousImages
      .map((image) => image.previewUrl)
      .filter((url) => url && !nextPreviewUrls.has(url)),
  );
}
