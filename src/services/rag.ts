import type { ImageAsset, PromptWordbanks } from "../types/studio";
import { matchPromptWordbankTerms } from "./promptWordbankMatcher";

export type RagDocumentSource = "wordbank" | "favorite" | "history";

export type RagDocument = {
  id: string;
  source: RagDocumentSource;
  title: string;
  text: string;
  searchText?: string;
  sourceImageId?: string;
};

export type RagMatch = RagDocument & {
  rawScore: number;
  score: number;
  sourceWeight: number;
};

export type RagMatchBarState = {
  visibleItems: RagMatch[];
  activeCount: number;
  hiddenItemCount: number;
  excludedCount: number;
  sourceImageCount: number;
  shouldShow: boolean;
};

type CollectRagDocumentsInput = {
  wordbanks: PromptWordbanks;
  imageAssets: ImageAsset[];
};

type RetrieveRagContextInput = {
  query: string;
  documents: RagDocument[];
  excludedIds?: string[];
  topK?: number;
  minScore?: number;
};

const SOURCE_WEIGHTS: Record<RagDocumentSource, number> = {
  wordbank: 1.25,
  favorite: 1.1,
  history: 1,
};

export function collectRagDocuments(input: CollectRagDocumentsInput): RagDocument[] {
  const documents: RagDocument[] = [];
  const seen = new Set<string>();

  input.imageAssets
    .filter(isSuccessfulGeneratedImage)
    .forEach((image) => {
      const promptTexts = successfulImagePromptTexts(image);
      const searchText = promptTexts.join(" ");
      matchedWordbankTermsFromImage(
        promptTexts,
        image.id,
        input.wordbanks,
      ).forEach((term, index) => {
        addDocument(documents, seen, {
          id: `image-wordbank:${image.id}:${index}`,
          source: "wordbank",
          title: `成功图片匹配词库: ${image.name}`,
          text: term,
          searchText,
          sourceImageId: image.id,
        });
      });
    });

  return documents;
}

function isSuccessfulGeneratedImage(image: ImageAsset) {
  return image.source === "generated" && !image.isEditMask && !image.isTransientMask;
}

function matchedWordbankTermsFromImage(
  promptTexts: string[],
  imageId: string,
  wordbanks: PromptWordbanks,
) {
  const terms: string[] = [];

  for (const prompt of promptTexts) {
    matchPromptWordbankTerms({
      prompt,
      mode: "adult",
      wordbanks,
      seed: `${imageId}:${prompt}`,
    }).matchedTerms.forEach((term) => pushUnique(terms, term));
  }

  return terms;
}

function successfulImagePromptTexts(image: ImageAsset) {
  return [image.prompt, image.requestPrompt, image.revisedPrompt]
    .map(normalizeText)
    .filter(Boolean);
}

function pushUnique(items: string[], item: string) {
  if (!items.includes(item)) items.push(item);
}

export function retrieveRagContext(input: RetrieveRagContextInput) {
  const topK = normalizeTopK(input.topK);
  const minScore = input.minScore ?? 0.12;
  const queryVector = vectorize(input.query);
  const excludedIds = new Set(input.excludedIds ?? []);

  const items = input.documents
    .filter((document) => !excludedIds.has(document.id))
    .map((document) => ({
      ...document,
      rawScore: cosineSimilarity(
        queryVector,
        vectorize(document.searchText ?? document.text),
      ),
      sourceWeight: SOURCE_WEIGHTS[document.source],
    }))
    .map((item) => ({
      ...item,
      score: item.rawScore * item.sourceWeight,
    }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) =>
      b.score - a.score ||
      b.sourceWeight - a.sourceWeight ||
      a.id.localeCompare(b.id),
    )
    .slice(0, topK);

  return {
    items,
    context: buildRagContextBlock(items),
  };
}

export function buildRagContextBlock(items: RagMatch[]) {
  const seen = new Set<string>();
  const lines = items
    .map((item) => normalizeText(item.text))
    .filter((text) => {
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, 8);

  if (!lines.length) return "";

  return [
    "RAG 参考内容：",
    "以下内容仅作为参考，不要覆盖用户原始提示词；如果冲突，以用户原始提示词为准。",
    ...lines.map((line, index) => `${index + 1}. ${line}`),
  ].join("\n");
}

export function buildRagMatchBarState(input: {
  items: RagMatch[];
  excludedItems?: RagMatch[];
  maxVisibleItems?: number;
}): RagMatchBarState {
  const visibleLimit = normalizeVisibleItemCount(input.maxVisibleItems);
  const visibleItems = input.items.slice(0, visibleLimit);
  const sourceImageIds = new Set(
    input.items
      .map((item) => item.sourceImageId)
      .filter((id): id is string => Boolean(id)),
  );
  const excludedCount = input.excludedItems?.length ?? 0;

  return {
    visibleItems,
    activeCount: input.items.length,
    hiddenItemCount: Math.max(0, input.items.length - visibleItems.length),
    excludedCount,
    sourceImageCount: sourceImageIds.size,
    shouldShow: input.items.length > 0 || excludedCount > 0,
  };
}

function addDocument(
  documents: RagDocument[],
  seen: Set<string>,
  document: RagDocument,
) {
  const text = normalizeText(document.text);
  if (!text || seen.has(text)) return;
  seen.add(text);
  documents.push({
    ...document,
    text,
  });
}

function vectorize(text: string) {
  const vector = new Map<string, number>();
  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }
  return vector;
}

function tokenize(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!normalized) return [];

  const tokens = normalized
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1);

  const cjkChars = [...normalized].filter((char) => /\p{Script=Han}/u.test(char));
  return [...tokens, ...cjkChars];
}

function normalizeToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("y") && token.length > 4) return token.slice(0, -1);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

function cosineSimilarity(
  left: Map<string, number>,
  right: Map<string, number>,
) {
  if (!left.size || !right.size) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  left.forEach((value, token) => {
    dot += value * (right.get(token) ?? 0);
    leftNorm += value * value;
  });
  right.forEach((value) => {
    rightNorm += value * value;
  });

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function normalizeText(text: unknown) {
  return typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
}

function normalizeTopK(topK: unknown) {
  const numeric = typeof topK === "number" ? topK : Number(topK);
  if (!Number.isFinite(numeric)) return 4;
  return Math.min(12, Math.max(1, Math.trunc(numeric)));
}

function normalizeVisibleItemCount(count: unknown) {
  const numeric = typeof count === "number" ? count : Number(count);
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(12, Math.max(1, Math.trunc(numeric)));
}
