/// <reference lib="webworker" />

/**
 * Off-main-thread image decoding: base64 → binary buffer + pixel dimensions.
 *
 * Previously `atob` loops (once per streamed partial frame) and
 * `readImageDimensions` (a full image decode per generated image) ran on the
 * main thread, causing long tasks during streaming generation.
 */

export type ImageDecodeRequest = {
  id: number;
  base64: string;
  mimeType: string;
};

export type ImageDecodeResponse = {
  id: number;
  /** Binary image data, transferred (zero-copy). */
  buffer?: ArrayBuffer;
  width?: number | null;
  height?: number | null;
  error?: string;
};

self.addEventListener("message", async (event: MessageEvent<ImageDecodeRequest>) => {
  const { id, base64, mimeType } = event.data;

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const buffer = bytes.buffer;

    let width: number | null = null;
    let height: number | null = null;
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } catch {
      // Dimensions stay null; the main thread falls back if it needs them.
    }

    const response: ImageDecodeResponse = { id, buffer, width, height };
    (self as DedicatedWorkerGlobalScope).postMessage(response, [buffer]);
  } catch (error) {
    const response: ImageDecodeResponse = {
      id,
      error: error instanceof Error ? error.message : "decode failed",
    };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
});

export {};
