const DEFAULT_SYNTAX_ERROR_MESSAGE = "图片接口返回了无法解析的响应。";

export function formatError(error: unknown, syntaxErrorMessage = DEFAULT_SYNTAX_ERROR_MESSAGE) {
  if (error instanceof SyntaxError) {
    return syntaxErrorMessage;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = extractErrorCause(error);
  // NetworkError 等会通过 cause 串起原始错误（如底层 TypeError）。
  // 主文案已经够用户看，cause 只在控制台诊断时有价值，这里追加便于排查。
  return cause ? `${message}\n[cause] ${cause}` : message;
}

/** 提取 error.cause 链中的第一条 Error.message，避免把多层包装的根因丢失。 */
function extractErrorCause(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    const cause = (current as { cause?: unknown })?.cause;
    if (cause instanceof Error && cause.message) {
      return cause.message;
    }
    if (!(cause instanceof Error)) break;
    current = cause;
  }
  return undefined;
}

export function isApiConfigurationError(error: unknown) {
  const message = formatError(error).toLowerCase();

  return [
    "invalid_api_key",
    "incorrect api key",
    "invalid api key",
    "http 401",
    "请先在设置里填写",
    "请先获取并选择图片模型",
    "仅支持 images api",
    "尚未与本地 companion 配对",
  ].some((pattern) => message.includes(pattern));
}
