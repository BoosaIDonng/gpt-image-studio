import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeBackoffDelay, isNetworkError, withNetworkRetry } from "./networkRetry";
import { NetworkError, SERVER_DISCONNECTED_MESSAGE } from "../shared/apiErrors";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 驱动 withNetworkRetry 的重试 sleep，直到回调解析。 */
async function flush() {
  // 多轮 microtask + timer 推进，确保 fn 内 await 与 sleep 都被刷新。
  for (let i = 0; i < 10; i += 1) {
    await vi.runOnlyPendingTimersAsync();
  }
}

describe("isNetworkError", () => {
  it("识别原生 TypeError（fetch 在浏览器层抛出）", () => {
    expect(isNetworkError(new TypeError("fetch failed"))).toBe(true);
  });

  it("识别无 status 的 NetworkError（直接断网）", () => {
    expect(isNetworkError(new NetworkError(SERVER_DISCONNECTED_MESSAGE))).toBe(true);
  });

  it("识别可重试状态码的 NetworkError", () => {
    expect(isNetworkError(new NetworkError("busy", { status: 429 }))).toBe(true);
    expect(isNetworkError(new NetworkError("down", { status: 503 }))).toBe(true);
    expect(isNetworkError(new NetworkError("gateway", { status: 502 }))).toBe(true);
    expect(isNetworkError(new NetworkError("timeout", { status: 408 }))).toBe(true);
  });

  it("不重试不可重试状态码的 NetworkError（4xx 鉴权/参数错误）", () => {
    expect(isNetworkError(new NetworkError("bad", { status: 400 }))).toBe(false);
    expect(isNetworkError(new NetworkError("unauth", { status: 401 }))).toBe(false);
    expect(isNetworkError(new NetworkError("forbidden", { status: 403 }))).toBe(false);
  });

  it("识别 companion 502 抛出的 SERVER_DISCONNECTED_MESSAGE 文案", () => {
    expect(isNetworkError(new Error(SERVER_DISCONNECTED_MESSAGE))).toBe(true);
  });

  it("忽略普通业务错误", () => {
    expect(isNetworkError(new Error("Grok 请求失败：HTTP 403：额度不足"))).toBe(false);
    expect(isNetworkError("not an error")).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("computeBackoffDelay", () => {
  it("基于 2s 指数退避", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const delay = computeBackoffDelay(attempt);
      const base = 2000 * Math.pow(2, attempt);
      // ±25% 抖动范围
      expect(delay).toBeGreaterThanOrEqual(Math.round(base * 0.75));
      expect(delay).toBeLessThanOrEqual(Math.round(base * 1.25));
    }
  });

  it("始终非负", () => {
    expect(computeBackoffDelay(0)).toBeGreaterThanOrEqual(0);
    expect(computeBackoffDelay(10)).toBeGreaterThanOrEqual(0);
  });
});

describe("withNetworkRetry", () => {
  it("shouldRetry 为 false 时不重试，直接抛出原始错误", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const onRetry = vi.fn();

    await expect(withNetworkRetry(fn, () => false, onRetry)).rejects.toThrow("fetch failed");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("成功时立即返回，不触发重试", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const onRetry = vi.fn();

    const result = await withNetworkRetry(fn, () => true, onRetry);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("遇到可重试错误会重试，成功后返回结果", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new NetworkError("busy", { status: 429 }))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    const promise = withNetworkRetry(fn, () => true, onRetry);
    await flush();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("重试达到上限后抛出最后一个可重试错误", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const onRetry = vi.fn();

    const promise = withNetworkRetry(fn, () => true, onRetry);
    // 先同步挂上 rejection 消费者，避免 flush 期间出现 unhandled rejection。
    const expectation = expect(promise).rejects.toThrow("fetch failed");
    await flush();
    await expectation;

    // MAX_RETRIES = 4
    expect(fn).toHaveBeenCalledTimes(4);
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it("不可重试的错误（HTTP 400）立即抛出，不消耗重试次数", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("请求失败：HTTP 400"));
    const onRetry = vi.fn();

    await expect(withNetworkRetry(fn, () => true, onRetry)).rejects.toThrow("请求失败：HTTP 400");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("companion 断网文案（非 NetworkError 实例）也能触发重试", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error(SERVER_DISCONNECTED_MESSAGE))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    const promise = withNetworkRetry(fn, () => true, onRetry);
    await flush();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
