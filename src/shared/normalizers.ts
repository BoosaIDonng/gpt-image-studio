/**
 * 跨模块共享的数据规范化函数。
 * 之前 normalizeRagTopK 在 settingsStore / settings / backups 三处逐字重复。
 */

/** 将 RAG topK 值规范化为 [1, 12] 范围内的整数，默认 4。 */
export function normalizeRagTopK(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 4;
  return Math.min(12, Math.max(1, Math.trunc(numeric)));
}
