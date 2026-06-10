import type { FavoritePrompt, ImageAsset, Message, PromptWordbanks } from "../types/studio";
import { matchPromptWordbankTerms } from "./promptWordbankMatcher";

export type RagDocumentSource = "wordbank" | "image" | "favorite" | "history";

export type RagDocument = {
  id: string;
  source: RagDocumentSource;
  title: string;
  text: string;
  searchText?: string;
  sourceImageId?: string;
  sourceImageIds?: string[];
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
  favoritePrompts?: FavoritePrompt[];
  messages?: Message[];
  maxHistoryMessages?: number;
};

type RetrieveRagContextInput = {
  query: string;
  documents: RagDocument[];
  excludedIds?: string[];
  topK?: number;
  minScore?: number;
};

const SOURCE_WEIGHTS: Record<RagDocumentSource, number> = {
  wordbank: 1.35,
  favorite: 1.15,
  image: 1,
  history: 0.9,
};
const MAX_HISTORY_DOCUMENTS = 12;
const MAX_DOCUMENT_TEXT_LENGTH = 480;

export function collectRagDocuments(input: CollectRagDocumentsInput): RagDocument[] {
  const documents: RagDocument[] = [];
  const documentsByText = new Map<string, RagDocument>();

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
        addDocument(documents, documentsByText, {
          id: `image-wordbank:${image.id}:${index}`,
          source: "wordbank",
          title: `成功图片匹配词库: ${image.name}`,
          text: term,
          searchText,
          sourceImageId: image.id,
          sourceImageIds: [image.id],
        });
      });

      addDocument(documents, documentsByText, {
        id: `image-prompt:${image.id}`,
        source: "image",
        title: `成功图片 Prompt: ${image.name}`,
        text: cleanRagText(searchText),
        sourceImageId: image.id,
        sourceImageIds: [image.id],
      });
    });

  (input.favoritePrompts ?? []).forEach((favorite) => {
    addDocument(documents, documentsByText, {
      id: `favorite:${favorite.id}`,
      source: "favorite",
      title: favorite.title ? `收藏 Prompt: ${favorite.title}` : "收藏 Prompt",
      text: cleanRagText(favorite.text),
    });
  });

  recentHistoryMessages(input.messages ?? [], input.maxHistoryMessages).forEach(
    (message) => {
      addDocument(documents, documentsByText, {
        id: `history:${message.id}`,
        source: "history",
        title: "历史 Prompt",
        text: cleanRagText(message.content),
      });
    },
  );

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

function recentHistoryMessages(messages: Message[], maxHistoryMessages?: number) {
  const limit = normalizeHistoryLimit(maxHistoryMessages);
  return messages
    .filter((message) => message.role === "user" && message.status === "success")
    .slice(-limit);
}

function pushUnique(items: string[], item: string) {
  if (!items.includes(item)) items.push(item);
}

export function retrieveRagContext(input: RetrieveRagContextInput) {
  const topK = normalizeTopK(input.topK);
  const minScore = input.minScore ?? 0.12;
  const excludedIds = new Set(input.excludedIds ?? []);
  const excludedTexts = new Set(
    input.documents
      .filter((document) => excludedIds.has(document.id))
      .map((document) => normalizeText(document.text))
      .filter(Boolean),
  );

  const items = input.documents
    .filter((document) => !excludedIds.has(document.id))
    .filter((document) => !matchesExcludedText(document, excludedTexts))
    .map((document) => ({
      ...document,
      rawScore: scoreRagDocument(input.query, document),
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
      .flatMap((item) => item.sourceImageIds ?? item.sourceImageId ?? [])
      .filter(Boolean),
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
  documentsByText: Map<string, RagDocument>,
  document: RagDocument,
) {
  const text = normalizeText(document.text);
  if (!text) return;

  const existingDocument = documentsByText.get(text);
  if (existingDocument) {
    mergeRagDocument(existingDocument, document);
    return;
  }

  const nextDocument = {
    ...document,
    text,
  };
  documentsByText.set(text, nextDocument);
  documents.push(nextDocument);
}

function mergeRagDocument(target: RagDocument, document: RagDocument) {
  const nextSearchText = normalizeText(document.searchText);
  if (nextSearchText && target.searchText !== nextSearchText) {
    target.searchText = normalizeText(`${target.searchText ?? ""} ${nextSearchText}`);
  }

  const sourceImageIds = target.sourceImageIds ?? (
    target.sourceImageId ? [target.sourceImageId] : []
  );
  if (document.sourceImageId && !sourceImageIds.includes(document.sourceImageId)) {
    sourceImageIds.push(document.sourceImageId);
  }
  target.sourceImageIds = sourceImageIds;
}

function matchesExcludedText(
  document: RagDocument,
  excludedTexts: Set<string>,
) {
  if (!excludedTexts.size) return false;
  const documentText = normalizeText(document.text);
  if (!documentText) return false;
  return [...excludedTexts].some((text) => documentText.includes(text));
}

function vectorize(text: string) {
  const vector = new Map<string, number>();
  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }
  return vector;
}

function scoreRagDocument(query: string, document: RagDocument) {
  const queryText = normalizeText(query);
  const documentText = normalizeText(`${document.searchText ?? ""} ${document.text}`);
  if (!queryText || !documentText) return 0;

  const vectorScore = cosineSimilarity(vectorize(queryText), vectorize(documentText));
  const coverageScore = tokenCoverageScore(queryText, documentText);
  const exactScore = exactTextScore(queryText, documentText);
  return Math.max(vectorScore, coverageScore, exactScore);
}

function tokenCoverageScore(query: string, documentText: string) {
  const queryTokens = uniqueTokens(tokenize(query));
  if (!queryTokens.length) return 0;

  const documentTokens = new Set(tokenize(documentText));
  const matchedCount = queryTokens.filter((token) => documentTokens.has(token)).length;
  return matchedCount / queryTokens.length;
}

function exactTextScore(query: string, documentText: string) {
  const normalizedQuery = normalizeForExactMatch(query);
  const normalizedDocument = normalizeForExactMatch(documentText);
  if (!normalizedQuery || !normalizedDocument) return 0;
  if (normalizedDocument.includes(normalizedQuery)) return 1;
  if (normalizedQuery.includes(normalizedDocument)) return 0.9;
  return 0;
}

function uniqueTokens(tokens: string[]) {
  return [...new Set(tokens)];
}

function normalizeForExactMatch(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
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

function cleanRagText(text: unknown) {
  if (typeof text !== "string") return "";

  return text
    .replace(/sk-[A-Za-z0-9_-]+/g, " ")
    .replace(/blob:[^\s]+/g, " ")
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DOCUMENT_TEXT_LENGTH);
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

function normalizeHistoryLimit(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return MAX_HISTORY_DOCUMENTS;
  return Math.min(MAX_HISTORY_DOCUMENTS, Math.max(0, Math.trunc(numeric)));
}
