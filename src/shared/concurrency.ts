/**
 * Run async workers over a list with a bounded concurrency.
 *
 * Replaces the previous `Promise.all(jobs.map(...))` pattern that fired every
 * request at the upstream at once — which triggered 429 rate limits whose
 * exponential backoff made total wall time worse than serial execution.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const normalizedLimit = Math.max(1, Math.min(limit, items.length || 1));
  let nextIndex = 0;

  const runners = Array.from({ length: normalizedLimit }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });

  await Promise.all(runners);
}
