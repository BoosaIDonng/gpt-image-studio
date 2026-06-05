import type {
  FavoritePrompt,
  ImageAsset,
  Message,
  PromptWordbankSectionKey,
  PromptWordbanks,
} from "../types/studio";

export type RagDocumentSource = "wordbank" | "favorite" | "history";

export type RagDocument = {
  id: string;
  source: RagDocumentSource;
  title: string;
  text: string;
};

export type RagMatch = RagDocument & {
  rawScore: number;
  score: number;
  sourceWeight: number;
};

type CollectRagDocumentsInput = {
  wordbanks: PromptWordbanks;
  favoritePrompts: FavoritePrompt[];
  messages: Message[];
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

const WORD_BANK_SECTIONS: Array<{
  key: PromptWordbankSectionKey;
  label: string;
  terms: (wordbanks: PromptWordbanks) => string[];
}> = [
  {
    key: "pose.safe",
    label: "安全词库",
    terms: (wordbanks) => wordbanks.pose.safe,
  },
  {
    key: "pose.creative",
    label: "创意词库",
    terms: (wordbanks) => wordbanks.pose.creative,
  },
  {
    key: "pose.nsfw",
    label: "开放词库",
    terms: (wordbanks) => wordbanks.pose.nsfw,
  },
  {
    key: "adultInspiration",
    label: "开放灵感",
    terms: (wordbanks) => wordbanks.adultInspiration,
  },
];

export function collectRagDocuments(input: CollectRagDocumentsInput): RagDocument[] {
  const documents: RagDocument[] = [];
  const seen = new Set<string>();

  for (const section of WORD_BANK_SECTIONS) {
    section.terms(input.wordbanks).forEach((term, index) => {
      addDocument(documents, seen, {
        id: `wordbank:${section.key}:${index}`,
        source: "wordbank",
        title: section.label,
        text: term,
      });
    });
  }

  input.favoritePrompts.forEach((prompt) => {
    addDocument(documents, seen, {
      id: `favorite:${prompt.id}`,
      source: "favorite",
      title: prompt.title,
      text: prompt.text,
    });
  });

  input.messages
    .filter((message) => message.role === "user")
    .forEach((message) => {
      addDocument(documents, seen, {
        id: `message:${message.id}`,
        source: "history",
        title: "历史用户 Prompt",
        text: message.content,
      });
    });

  input.imageAssets.forEach((image) => {
    ([
      ["prompt", image.prompt],
      ["request", image.requestPrompt],
      ["revised", image.revisedPrompt],
    ] as Array<[string, string | undefined]>).forEach(([kind, text]) => {
      if (typeof text !== "string") return;
      addDocument(documents, seen, {
        id: `image:${image.id}:${kind}`,
        source: "history",
        title: `历史图片 Prompt: ${image.name}`,
        text,
      });
    });
  });

  return documents;
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
      rawScore: cosineSimilarity(queryVector, vectorize(document.text)),
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
