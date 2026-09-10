import { NetworkError, isRetryableStatus, SERVER_DISCONNECTED_MESSAGE } from "../shared/apiErrors";

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;

export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: () => boolean,
  onRetry?: (retryAttempt: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  const maxAttempts = shouldRetry() ? MAX_RETRIES : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Only auto-retry when the failure is confirmed safe (the request was
      // rejected by the upstream, e.g. 429/5xx); connection interruptions are
      // surfaced to the caller instead of silently re-billing a generation.
      if (
        !isNetworkError(error) ||
        !isSafeToAutoRetry(error) ||
        !shouldRetry() ||
        attempt === maxAttempts - 1
      ) {
        throw error;
      }
      const delay = computeBackoffDelay(attempt);
      onRetry?.(attempt + 1);
      console.info(`[networkRetry] attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay, signal);
    }
  }

  throw new Error("unreachable");
}

/**
 * 指数退避 + 抖动（jitter）。
 * 基础延迟 2s，每次翻倍，并叠加 ±25% 的随机抖动，避免多个客户端同步重试打满上游。
 */
export function computeBackoffDelay(attempt: number): number {
  const base = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = base * (Math.random() * 0.5 - 0.25);
  return Math.max(0, Math.round(base + jitter));
}

/**
 * 判断一个错误是否属于"可重试的网络错误"：
 * - NetworkError 实例（Grok/Gemini 直接断网、或 429/5xx 重试状态码）；
 * - 原生 TypeError（fetch 在浏览器层抛出，未经过 client 包装）；
 * - message 含 SERVER_DISCONNECTED_MESSAGE（companion 502、OpenAI 路径抛出的断网文案）。
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return error.status === undefined || isRetryableStatus(error.status);
  }
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.message.includes(SERVER_DISCONNECTED_MESSAGE))
  );
}

/**
 * 判断是否可以**自动**重试而不产生重复计费。
 *
 * 只有"请求已到达上游且被拒绝/失败在响应阶段之前"的错误才是安全的：
 * 429/408/5xx 意味着服务器看到了请求并明确拒绝或报错，重试不会重复生成。
 * 连接中断类错误（TypeError、断连文案、无状态码的 NetworkError）无法区分
 * "还没发出"和"上游已经在生成"，自动重试可能**再生成一张**（多付一次钱，
 * 且出图不同）——这类错误不再自动重试，由调用方标记"结果未知"交给用户决定。
 */
export function isSafeToAutoRetry(error: unknown): boolean {
  return (
    error instanceof NetworkError && error.status !== undefined && isRetryableStatus(error.status)
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
