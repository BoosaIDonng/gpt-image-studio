import { NetworkError, isRetryableStatus, SERVER_DISCONNECTED_MESSAGE } from "../shared/apiErrors";

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;

export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: () => boolean,
  onRetry?: (retryAttempt: number) => void,
): Promise<T> {
  const maxAttempts = shouldRetry() ? MAX_RETRIES : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isNetworkError(error) || !shouldRetry() || attempt === maxAttempts - 1) {
        throw error;
      }
      const delay = computeBackoffDelay(attempt);
      onRetry?.(attempt + 1);
      console.info(`[networkRetry] attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
