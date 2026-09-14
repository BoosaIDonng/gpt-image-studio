/**
 * Structured output protocol for the floating assistant.
 *
 * When the assistant rewrites or suggests a prompt it appends a fenced
 * ```studio JSON block; the UI turns it into one-click apply actions.
 * Parsing is defensive: anything malformed degrades to plain text.
 */

export type AssistantApplyAction = {
  action: "apply_prompt";
  prompt: string;
  size?: string;
  imageCount?: number;
  quality?: string;
  background?: string;
  outputFormat?: string;
};

/** Values the UI accepts for parameter fields (kept in sync with settingsStore). */
const KNOWN_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "auto",
]);
const QUALITY_VALUES = new Set(["auto", "high", "medium", "low"]);
const BACKGROUND_VALUES = new Set(["auto", "transparent", "opaque"]);
const OUTPUT_FORMAT_VALUES = new Set(["png", "jpeg", "webp"]);
const MAX_IMAGE_COUNT = 10;

export function parseAssistantApplyAction(reply: string): AssistantApplyAction | null {
  const block = extractStudioBlock(reply);
  if (!block) return null;

  const parsed = parseLooseJson(block);
  if (!parsed || parsed.action !== "apply_prompt") return null;
  if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) return null;

  return sanitizeApplyAction(parsed);
}

function extractStudioBlock(reply: string): string | null {
  const match = reply.match(/```studio\s*\n([\s\S]*?)```/i);
  if (match?.[1]) return match[1];

  // Fallback: a bare {...} object mentioning apply_prompt (models drop fences).
  const start = reply.lastIndexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const candidate = reply.slice(start, end + 1);
  return candidate.includes("apply_prompt") ? candidate : null;
}

function parseLooseJson(block: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(block.trim());
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Clamps and whitelists every field; invalid values are dropped, not rejected. */
function sanitizeApplyAction(parsed: Record<string, unknown>): AssistantApplyAction {
  const action: AssistantApplyAction = { action: "apply_prompt", prompt: String(parsed.prompt).trim() };

  const size = parsed.size;
  if (typeof size === "string") {
    if (KNOWN_SIZES.has(size) || /^\d{3,4}x\d{3,4}$/.test(size)) action.size = size;
  }

  if (typeof parsed.imageCount === "number" && Number.isFinite(parsed.imageCount)) {
    action.imageCount = Math.min(Math.max(Math.round(parsed.imageCount), 1), MAX_IMAGE_COUNT);
  }

  if (typeof parsed.quality === "string" && QUALITY_VALUES.has(parsed.quality)) {
    action.quality = parsed.quality;
  }
  if (typeof parsed.background === "string" && BACKGROUND_VALUES.has(parsed.background)) {
    action.background = parsed.background;
  }
  if (typeof parsed.outputFormat === "string" && OUTPUT_FORMAT_VALUES.has(parsed.outputFormat)) {
    action.outputFormat = parsed.outputFormat;
  }

  return action;
}

/** Removes the ```studio block from the displayed reply text. */
export function stripAssistantApplyBlock(reply: string): string {
  return reply.replace(/```studio\s*\n[\s\S]*?```/gi, "").trimEnd();
}
