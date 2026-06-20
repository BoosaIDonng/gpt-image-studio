import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFeedbackStore } from "./feedbackStore";
import { useImagesStore } from "./imagesStore";
import type { ImageAsset } from "../types/studio";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  deleteImageAsset: vi.fn().mockResolvedValue(undefined),
  deleteImageBlob: vi.fn().mockResolvedValue(undefined),
  loadImageBlob: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue(undefined),
  saveImageBlob: vi.fn().mockResolvedValue(undefined),
  readImageDimensions: vi.fn().mockResolvedValue(null),
  estimateStorageUsage: vi.fn().mockResolvedValue({ used: 0, quota: 0 }),
  createId: vi.fn((prefix: string) => `${prefix}-test-id`),
  isoTimestamp: vi.fn(() => "2026-06-20T00:00:00.000Z"),
  createObjectUrl: vi.fn(() => "blob:mock-url"),
  revokeObjectUrls: vi.fn(),
  toPlainImageAsset: vi.fn((asset: ImageAsset) => ({ ...asset })),
}));

vi.mock("../services/imageAssets", () => ({
  deleteImageAsset: mocks.deleteImageAsset,
  deleteImageBlob: mocks.deleteImageBlob,
  loadImageBlob: mocks.loadImageBlob,
  saveImageAsset: mocks.saveImageAsset,
  saveImageBlob: mocks.saveImageBlob,
}));

vi.mock("../services/imageMetadata", () => ({
  readImageDimensions: mocks.readImageDimensions,
}));

vi.mock("../services/storageUsage", () => ({
  estimateStorageUsage: mocks.estimateStorageUsage,
}));

vi.mock("../shared/dateTime", () => ({
  isoTimestamp: mocks.isoTimestamp,
}));

vi.mock("../shared/id", () => ({
  createId: mocks.createId,
}));

vi.mock("../shared/objectUrls", () => ({
  createObjectUrl: mocks.createObjectUrl,
  revokeObjectUrls: mocks.revokeObjectUrls,
}));

vi.mock("./generationStoreUtils", () => ({
  toPlainImageAsset: mocks.toPlainImageAsset,
}));

function makeImage(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: "img-1",
    name: "测试图片.png",
    source: "generated",
    mimeType: "image/png",
    prompt: "test prompt",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("imagesStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  function setupStore() {
    const store = useImagesStore();
    const onStorageError = vi.fn();
    store.configureImagesStore({
      activeConversationId: ref("conv-1"),
      messages: ref([]),
      onStorageError,
    });
    return { store, onStorageError };
  }

  describe("configureImagesStore", () => {
    it("未配置时调用方法抛出错误", async () => {
      const store = useImagesStore();
      store.imageAssets = [makeImage({ id: "img-1" })];
      await expect(store.renameImage("img-1", "新名称")).rejects.toThrow(
        "Images store is not configured.",
      );
    });
  });

  describe("attachImage / removeAttachment", () => {
    it("添加 ID 到 attachedImages", () => {
      const { store } = setupStore();
      store.attachImage("img-1");
      expect(store.attachedImages).toEqual(["img-1"]);
    });

    it("重复添加不会产生重复", () => {
      const { store } = setupStore();
      store.attachImage("img-1");
      store.attachImage("img-1");
      expect(store.attachedImages).toEqual(["img-1"]);
    });

    it("从 attachedImages 移除", () => {
      const { store } = setupStore();
      store.attachImage("img-1");
      store.attachImage("img-2");
      store.removeAttachment("img-1");
      expect(store.attachedImages).toEqual(["img-2"]);
    });
  });

  describe("imageById", () => {
    it("查找存在的图片", () => {
      const { store } = setupStore();
      const img = makeImage({ id: "img-1" });
      store.imageAssets = [img];
      expect(store.imageById("img-1")).toBe(img);
    });

    it("不存在返回 undefined", () => {
      const { store } = setupStore();
      expect(store.imageById("nonexistent")).toBeUndefined();
    });
  });

  describe("renameImage", () => {
    it("成功重命名并持久化", async () => {
      const { store } = setupStore();
      store.imageAssets = [makeImage({ id: "img-1", name: "旧名称" })];

      const result = await store.renameImage("img-1", "新名称");

      expect(result).toBe(true);
      expect(store.imageById("img-1")?.name).toBe("新名称");
      expect(mocks.saveImageAsset).toHaveBeenCalledTimes(1);
    });

    it("空名称返回 false", async () => {
      const { store } = setupStore();
      store.imageAssets = [makeImage({ id: "img-1" })];

      const result = await store.renameImage("img-1", "   ");

      expect(result).toBe(false);
      expect(mocks.saveImageAsset).not.toHaveBeenCalled();
    });

    it("不存在的 ID 返回 false", async () => {
      const { store } = setupStore();

      const result = await store.renameImage("nonexistent", "名称");

      expect(result).toBe(false);
    });
  });

  describe("setImageTagColor", () => {
    it("成功设置并持久化", async () => {
      const { store } = setupStore();
      store.imageAssets = [makeImage({ id: "img-1" })];

      const result = await store.setImageTagColor("img-1", "red");

      expect(result).toBe(true);
      expect(store.imageById("img-1")?.tagColor).toBe("red");
      expect(mocks.saveImageAsset).toHaveBeenCalledTimes(1);
    });

    it("不存在的 ID 返回 false", async () => {
      const { store } = setupStore();

      const result = await store.setImageTagColor("nonexistent", "blue");

      expect(result).toBe(false);
    });
  });

  describe("deleteImage", () => {
    it("确认后删除图片", async () => {
      const { store } = setupStore();
      store.imageAssets = [makeImage({ id: "img-1", blobKey: "blob-1" })];

      const feedback = useFeedbackStore();
      vi.spyOn(feedback, "requestConfirmation").mockResolvedValue(true);
      vi.spyOn(feedback, "notifySuccess").mockImplementation(() => undefined);

      await store.deleteImage("img-1");

      expect(store.imageAssets).toEqual([]);
      expect(mocks.deleteImageAsset).toHaveBeenCalledWith("img-1");
      expect(mocks.deleteImageBlob).toHaveBeenCalledWith("blob-1");
    });

    it("取消确认不删除", async () => {
      const { store } = setupStore();
      store.imageAssets = [makeImage({ id: "img-1" })];

      const feedback = useFeedbackStore();
      vi.spyOn(feedback, "requestConfirmation").mockResolvedValue(false);

      await store.deleteImage("img-1");

      expect(store.imageAssets).toHaveLength(1);
      expect(mocks.deleteImageAsset).not.toHaveBeenCalled();
    });
  });

  describe("deleteImages", () => {
    it("批量删除多张图片", async () => {
      const { store } = setupStore();
      store.imageAssets = [
        makeImage({ id: "img-1", blobKey: "b1" }),
        makeImage({ id: "img-2", blobKey: "b2" }),
        makeImage({ id: "img-3", blobKey: "b3" }),
      ];

      const feedback = useFeedbackStore();
      vi.spyOn(feedback, "notifySuccess").mockImplementation(() => undefined);

      await store.deleteImages(["img-1", "img-3"]);

      expect(store.imageAssets.map((i) => i.id)).toEqual(["img-2"]);
      expect(mocks.deleteImageAsset).toHaveBeenCalledTimes(2);
    });
  });

  describe("createMaskAsset / clearTransientMask", () => {
    it("创建临时 mask 并可清除", () => {
      const { store } = setupStore();
      const sourceImage = makeImage({ id: "source-1", name: "原图.png" });
      store.imageAssets = [sourceImage];

      const maskBlob = new Blob(["mask"], { type: "image/png" });
      store.createMaskAsset(sourceImage, maskBlob);

      expect(store.imageAssets).toHaveLength(2);
      expect(store.imageAssets[0].isTransientMask).toBe(true);
      expect(store.imageAssets[0].editSourceImageId).toBe("source-1");

      const maskId = store.imageAssets[0].id;
      store.clearTransientMask(maskId);

      expect(store.imageAssets).toHaveLength(1);
      expect(store.imageAssets[0].id).toBe("source-1");
    });
  });
});
