import type { ImageDimensions } from "./imageMetadata";
import { readImageDimensions } from "./imageMetadata";
import type { ImageDecodeRequest, ImageDecodeResponse } from "../workers/imageDecode.worker";

/**
 * Main-thread client for the image-decode worker. Combines the two hot paths
 * that used to run on the main thread — base64 → Blob and pixel-dimension
 * decoding — into one worker round-trip. Falls back to main-thread decoding
 * when Worker is unavailable (tests, very old browsers).
 */

export type DecodedImage = {
  blob: Blob;
  dimensions: ImageDimensions | null;
};

let worker: Worker | null | undefined;
let nextRequestId = 0;
const pendingRequests = new Map<number, (response: ImageDecodeResponse) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === "undefined") {
    worker = null;
    return worker;
  }

  try {
    const instance = new Worker(new URL("../workers/imageDecode.worker.ts", import.meta.url), {
      type: "module",
    });
    instance.addEventListener("message", (event: MessageEvent<ImageDecodeResponse>) => {
      const resolve = pendingRequests.get(event.data.id);
      if (resolve) {
        pendingRequests.delete(event.data.id);
        resolve(event.data);
      }
    });
    instance.addEventListener("error", () => {
      worker = null;
    });
    worker = instance;
  } catch {
    worker = null;
  }

  return worker;
}

function decodeOnMainThread(base64: string, mimeType: string): Promise<DecodedImage> {
  const blob = base64ToBlobFallback(base64, mimeType);
  return readImageDimensions(blob).then((dimensions) => ({ blob, dimensions }));
}

export function decodeBase64Image(base64: string, mimeType: string): Promise<DecodedImage> {
  const instance = getWorker();
  if (!instance) return decodeOnMainThread(base64, mimeType);

  const id = nextRequestId++;
  return new Promise<DecodedImage>((resolve) => {
    pendingRequests.set(id, (response) => {
      if (response.error || !response.buffer) {
        decodeOnMainThread(base64, mimeType).then(resolve);
        return;
      }

      const blob = new Blob([response.buffer], { type: mimeType });
      const dimensions =
        response.width && response.height
          ? { width: response.width, height: response.height }
          : null;
      resolve({ blob, dimensions });
    });
    const request: ImageDecodeRequest = { id, base64, mimeType };
    instance.postMessage(request);
  });
}

function base64ToBlobFallback(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}
