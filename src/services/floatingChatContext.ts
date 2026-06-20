import type {
  ApiMode,
  ApiProvider,
  ConnectionMode,
  FavoritePrompt,
  GenerationParams,
  ImageAsset,
  Message,
  PromptWordbanks,
} from "../types/studio";
import { collectRagDocuments, retrieveRagContext } from "./rag";

type FloatingChatGenerationContext = GenerationParams & {
  apiProvider: ApiProvider;
  apiMode: ApiMode;
  connectionMode: ConnectionMode;
  model: string;
};

type FloatingChatRagContext = {
  enabled: boolean;
  topK: number;
  promptWordbanks: PromptWordbanks;
  imageAssets: ImageAsset[];
  favoritePrompts?: FavoritePrompt[];
  messages?: Message[];
  excludedIds: string[];
};

export type FloatingChatProjectContextInput = {
  composerText: string;
  activeConversationTitle?: string;
  recentMessages: Message[];
  activeAttachments: ImageAsset[];
  generation: FloatingChatGenerationContext;
  rag: FloatingChatRagContext;
};

export type FloatingChatProjectContextMessage = {
  role: "user";
  content: string;
};

const MAX_TEXT_LENGTH = 240;
const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_IMAGES = 4;
const MAX_RAG_MATCHES = 4;

export function buildFloatingChatProjectContext(
  input: FloatingChatProjectContextInput,
): FloatingChatProjectContextMessage {
  const lines = [
    "以下是 GPT Image Studio 当前项目上下文，用于回答下一条用户消息。不要原样复述上下文，除非用户要求。",
    "如果用户问“当前在做什么图”，这里的“图”指 AI 图片创作，不是数据图表。",
    "",
    "## 当前输入",
    safeText(input.composerText) || "空",
    "",
    "## 当前会话",
    safeText(input.activeConversationTitle) || "新的对话",
    "",
    "## 最近主聊天消息",
    ...messageLines(input.recentMessages),
    "",
    "## 当前引用图片",
    ...imageLines(input.activeAttachments),
    "",
    "## 当前生成参数",
    generationLine(input.generation),
    "",
    "## RAG",
    ...ragLines(input),
  ];

  return {
    role: "user",
    content: lines.join("\n").trim(),
  };
}

function messageLines(messages: Message[]) {
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  if (!recentMessages.length) return ["无"];

  return recentMessages.map(
    (message) => `- ${message.role}/${message.status}: ${safeText(message.content) || "空"}`,
  );
}

function imageLines(images: ImageAsset[]) {
  const visibleImages = images.slice(0, MAX_CONTEXT_IMAGES);
  if (!visibleImages.length) return ["无"];

  return visibleImages
    .flatMap((image, index) => [
      `- 图片 ${index + 1}: ${safeText(image.name) || image.id} / ${image.source} / ${image.width ?? "?"}x${image.height ?? "?"}`,
      image.prompt ? `  prompt: ${safeText(image.prompt)}` : "",
      image.requestPrompt ? `  requestPrompt: ${safeText(image.requestPrompt)}` : "",
      image.revisedPrompt ? `  revisedPrompt: ${safeText(image.revisedPrompt)}` : "",
    ])
    .filter(Boolean);
}

function generationLine(generation: FloatingChatGenerationContext) {
  const size =
    generation.size === "custom" ? `${generation.width}x${generation.height}` : generation.size;

  return [
    `供应商 ${generation.apiProvider}`,
    `模型 ${generation.model}`,
    `接口 ${generation.apiMode}`,
    `连接 ${generation.connectionMode}`,
    `尺寸 ${size}`,
    `分辨率 ${generation.resolution}`,
    `数量 ${generation.imageCount}`,
    `质量 ${generation.quality}`,
    `背景 ${generation.background}`,
    `格式 ${generation.outputFormat}`,
  ].join("；");
}

function ragLines(input: FloatingChatProjectContextInput) {
  if (!input.rag.enabled) return [`关闭；topK ${input.rag.topK}`];

  const query = input.composerText.trim();
  if (!query) return [`开启；topK ${input.rag.topK}；当前输入为空，未计算命中`];

  const result = retrieveRagContext({
    query,
    documents: collectRagDocuments({
      wordbanks: input.rag.promptWordbanks,
      imageAssets: input.rag.imageAssets,
      favoritePrompts: input.rag.favoritePrompts,
      messages: input.rag.messages,
    }),
    excludedIds: input.rag.excludedIds,
    topK: input.rag.topK,
  });
  const items = result.items.slice(0, MAX_RAG_MATCHES);

  if (!items.length) return [`开启；topK ${input.rag.topK}；无命中`];

  return [
    `开启；topK ${input.rag.topK}`,
    ...items.map(
      (item) => `- ${safeText(item.text)} (${item.title}, score ${item.score.toFixed(2)})`,
    ),
  ];
}

function safeText(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/blob:[^\s]+/g, "[redacted-blob-url]")
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[redacted-image-data]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}
