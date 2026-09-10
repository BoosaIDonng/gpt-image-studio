import { loadSettings, saveSettings } from "./settings";
import type { AppSettings } from "../types/studio";

/**
 * Persistent per-term hit weights for the prompt wordbank ("个人词库").
 *
 * Successfully generated images already reveal which wordbank terms made it
 * into the prompt; previously that signal lived only in in-memory RAG
 * documents. Recording it here lets retrieval boost terms that historically
 * led to successful generations.
 */

export const MAX_TRACKED_TERMS = 500;
export const MAX_TERM_WEIGHT = 99;

export function normalizeWordbankTermWeights(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};

  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([term, weight]) => [term, Math.min(MAX_TERM_WEIGHT, Math.floor(weight))] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TRACKED_TERMS);

  return Object.fromEntries(entries);
}

/** Increment persisted hit weights for the given terms (fire-and-forget safe). */
export async function recordWordbankTermHits(terms: string[]): Promise<void> {
  const uniqueTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  if (!uniqueTerms.length) return;

  const settings = await loadSettings();
  if (!settings) return;

  const weights = normalizeWordbankTermWeights(settings.wordbankTermWeights);
  for (const term of uniqueTerms) {
    weights[term] = Math.min(MAX_TERM_WEIGHT, (weights[term] ?? 0) + 1);
  }

  const nextSettings: AppSettings = { ...settings, wordbankTermWeights: weights };
  await saveSettings(nextSettings);
}

/** Multiplier applied to a wordbank RAG document based on its hit history. */
export function wordbankTermBoost(term: string, weights?: Record<string, number>): number {
  if (!weights) return 1;
  const weight = weights[term] ?? 0;
  if (weight <= 0) return 1;
  // Logarithmic dampening: repeated hits keep helping, but with diminishing
  // returns and a hard ceiling so one hot term cannot dominate ranking.
  return 1 + Math.min(0.5, Math.log1p(weight) * 0.15);
}
