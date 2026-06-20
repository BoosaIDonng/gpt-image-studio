import type { Conversation, ImageAsset, Message } from "../types/studio";
import { getAllFromStore, STORE_NAMES } from "./db";

type ImageBlobRecord = {
  key: string;
  blob: Blob;
};

export type StorageUsage = {
  imageBytes: number;
  metadataBytes: number;
  projectBytes: number;
  browserUsageBytes?: number;
  quotaBytes?: number;
};

export async function estimateStorageUsage(): Promise<StorageUsage> {
  const [
    conversations,
    messages,
    imageAssets,
    settings,
    conversationDrafts,
    browserEstimate,
  ] = await Promise.all([
    getAllFromStore<Conversation>(STORE_NAMES.conversations),
    getAllFromStore<Message>(STORE_NAMES.messages),
    getAllFromStore<ImageAsset>(STORE_NAMES.imageAssets),
    getAllFromStore<unknown>(STORE_NAMES.settings),
    getAllFromStore<unknown>(STORE_NAMES.conversationDrafts),
    estimateBrowserStorage(),
  ]);

  // 性能关键点：以前这里会 getAllFromStore(imageBlobs) 把所有图片 Blob 全部
  // 读进内存只为了累加 .blob.size——图片库一大就会在每次生图/删除/导入后
  // 把数百 MB 数据拉进内存。每个 ImageAsset 创建时已记录 sizeBytes，直接累加
  // 这些元数据即可得到同样的字节数，完全不需要触碰 Blob 存储。
  // 仅当个别历史资产缺少 sizeBytes 时，才回退到读取对应 Blob 兜底。
  const imageBytes = await sumImageBytes(imageAssets);
  const serializedMetadataBytes = byteSizeOfJson({
    conversations,
    messages,
    imageAssets,
    settings,
    conversationDrafts,
  });
  const browserUsageBytes = browserEstimate.usage;
  const metadataBytes = Math.max(
    serializedMetadataBytes,
    browserUsageBytes ? browserUsageBytes - imageBytes : 0,
  );

  return {
    imageBytes,
    metadataBytes,
    projectBytes: imageBytes + metadataBytes,
    browserUsageBytes,
    quotaBytes: browserEstimate.quota,
  };
}

/**
 * 累加所有图片占用的字节数。
 * 优先用 ImageAsset.sizeBytes（元数据，零 Blob 读取）；
 * 缺失 sizeBytes 的历史资产才按需读取其 Blob 兜底。
 */
async function sumImageBytes(imageAssets: ImageAsset[]): Promise<number> {
  let total = 0;
  const missingBlobKeys: string[] = [];

  for (const asset of imageAssets) {
    if (typeof asset.sizeBytes === "number" && asset.sizeBytes > 0) {
      total += asset.sizeBytes;
    } else if (asset.blobKey) {
      missingBlobKeys.push(asset.blobKey);
    }
  }

  if (missingBlobKeys.length) {
    const blobs = await getAllFromStore<ImageBlobRecord>(STORE_NAMES.imageBlobs);
    const blobByKey = new Map(blobs.map((record) => [record.key, record.blob]));
    for (const key of missingBlobKeys) {
      total += blobByKey.get(key)?.size ?? 0;
    }
  }

  return total;
}

async function estimateBrowserStorage() {
  if (!navigator.storage?.estimate) {
    return {};
  }

  try {
    return await navigator.storage.estimate();
  } catch {
    return {};
  }
}

function byteSizeOfJson(value: unknown) {
  return new Blob([JSON.stringify(value)]).size;
}
