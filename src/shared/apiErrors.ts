/**
 * API 错误文案常量。
 *
 * 之前该长句在 imagesApi.ts（4 处）与 companion 路由（3 处）硬编码，
 * 且 networkRetry.ts 靠 error.message 子串匹配来决定是否重试——
 * 任何措辞改动都可能让重试逻辑静默失效。统一引用常量后，文案与匹配保持一致。
 */

/** 上游服务器主动断开连接（无响应）时抛出的提示文案。 */
export const SERVER_DISCONNECTED_MESSAGE =
  "服务器主动断开了连接，未返回任何响应。通常是提示词中存在不合规内容，触发了平台的内容审核策略，请调整提示词后重试。";
