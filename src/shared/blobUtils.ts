/**
 * Blob 编码工具：集中处理 base64 / data-URL 转换。
 * 之前在 imagesApi / grokImagesApi / geminiImagesApi / localCompanionImagesClient
 * 各处逐字复制，现统一到此处。
 */

const CHUNK_SIZE = 8192;

/** 将 Blob 转为不带前缀的 base64 字符串。 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
    // 分块用 String.fromCharCode.apply 一次转换 8KB，
    // 相比逐字符拼接减少 8192 倍的函数调用开销。
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(index, index + CHUNK_SIZE) as unknown as number[]));
  }
  return btoa(chunks.join(""));
}

/** 将 Blob 转为 `data:<mime>;base64,...` 形式的 data URL。 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}
