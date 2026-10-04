import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadImageUrlAsBase64 } from "./imageUrlDownload";

afterEach(() => vi.restoreAllMocks());

describe("downloadImageUrlAsBase64", () => {
  it("sets a timeout and reports a clear error when the image URL stalls", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new DOMException("The operation timed out", "TimeoutError"));

    await expect(downloadImageUrlAsBase64("https://images.example.test/image.png")).rejects.toThrow(
      "下载图片链接超时（60 秒）",
    );
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
