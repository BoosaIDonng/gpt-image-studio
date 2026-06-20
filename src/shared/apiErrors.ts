/**
 * API 错误文案常量与网络错误分类。
 *
 * 之前该长句在 imagesApi.ts（4 处）与 companion 路由（3 处）硬编码，
 * 且 networkRetry.ts 靠 error.message 子串匹配来决定是否重试——
 * 任何措辞改动都可能让重试逻辑静默失效。统一引用常量后，文案与匹配保持一致。
 */

/** 上游服务器主动断开连接（无响应）时抛出的提示文案。 */
export const SERVER_DISCONNECTED_MESSAGE =
  "服务器主动断开了连接，未返回任何响应。通常是提示词中存在不合规内容，触发了平台的内容审核策略，请调整提示词后重试。";

/**
 * 网络层错误：fetch 本身抛错（连接被拒、DNS 失败、TLS 中断等），
 * 或者拿到了一个值得重试的 HTTP 状态码（429 限流、5xx 服务端错误、502/503/504 网关）。
 *
 * 之前 Grok/Gemini 路径在断网时抛出的是原生 TypeError，message 缺少上下文；
 * 而 5xx/429 则走普通 Error，networkRetry 完全识别不出，导致永远不重试。
 * 统一用 NetworkError 后，networkRetry 只需 instanceof 判断即可。
 */
export class NetworkError extends Error {
  /** 触发该错误的 HTTP 状态码；fetch 层断网时为 undefined。 */
  readonly status?: number;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "NetworkError";
    this.status = options?.status;
  }
}

/**
 * 判断一个 HTTP 状态码是否"值得重试"：
 * 429 限流、408 超时、5xx 服务端/网关错误。
 * 4xx 中除 408/429 外（鉴权、参数等）不重试，重试也是同样结果。
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}
