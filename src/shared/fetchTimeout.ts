/**
 * fetch 超时辅助：把"用户主动中止"与"超时中止"组合成一个 signal，先触发者生效。
 *
 * 生成类请求不套超时（用户可自行中止，且合法生成本身可能超过分钟级）；
 * 只用于发现模型、扩写等短交互，避免上游挂起时 UI 无限等待。
 */

/** AbortSignal.timeout 触发时的中止原因 DOMException.name。 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

export function withTimeoutSignal(
  timeoutMs: number,
  userSignal?: AbortSignal,
): AbortSignal | undefined {
  if (typeof AbortSignal?.timeout !== "function") return userSignal;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!userSignal) return timeoutSignal;
  return typeof AbortSignal.any === "function"
    ? AbortSignal.any([userSignal, timeoutSignal])
    : userSignal;
}
