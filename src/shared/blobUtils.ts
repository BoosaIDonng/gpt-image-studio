/**
 * Blob 编码工具：集中处理 base64 / data-URL 转换。
 * 之前在 imagesApi / grokImagesApi / geminiImagesApi / localCompanionImagesClient
 * 各处逐字复制，现统一到此处。
 */

/** 将 Blob 转为不带前缀的 base64 字符串。 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

/** 将 Blob 转为 `data:<mime>;base64,...` 形式的 data URL。 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}
