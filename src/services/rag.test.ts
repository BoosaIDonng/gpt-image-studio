import { describe, expect, it } from "vitest";
import type { FavoritePrompt, ImageAsset, Message, PromptWordbanks } from "../types/studio";
import {
  buildRagContextBlock,
  collectRagDocuments,
  retrieveRagContext,
} from "./rag";

const wordbanks: PromptWordbanks = {
  pose: {
    safe: ["soft window light", "calm portrait"],
    creative: ["cinematic rain street", "dramatic rim light"],
    nsfw: ["bold silhouette"],
  },
  adultInspiration: ["mature editorial mood"],
};

const favorites: FavoritePrompt[] = [
  {
    id: "fav-1",
    title: "雨夜电影感",
    text: "cinematic rain street, neon reflection, dramatic rim light",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const messages: Message[] = [
  {
    id: "m-1",
    conversationId: "c-1",
    role: "user",
    content: "portrait with soft window light and calm color",
    referencedImageIds: [],
    resultImageIds: [],
    status: "success",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "m-2",
    conversationId: "c-1",
    role: "assistant",
    content: "done",
    referencedImageIds: [],
    resultImageIds: [],
    status: "success",
    createdAt: "2026-01-02T00:00:01.000Z",
  },
];

const images: ImageAsset[] = [
  {
    id: "img-1",
    name: "city",
    source: "generated",
    prompt: "wide city skyline",
    requestPrompt: "wide city skyline, cinematic rain street",
    revisedPrompt: "rainy city skyline with neon reflection",
    createdAt: "2026-01-03T00:00:00.000Z",
  },
];

describe("RAG", () => {
  it("collects documents from wordbanks, favorites, user messages, and image prompts", () => {
    const documents = collectRagDocuments({
      wordbanks,
      favoritePrompts: favorites,
      messages,
      imageAssets: images,
    });

    expect(documents.map((document) => document.source)).toEqual([
      "wordbank",
      "wordbank",
      "wordbank",
      "wordbank",
      "wordbank",
      "wordbank",
      "favorite",
      "history",
      "history",
      "history",
      "history",
    ]);
    expect(documents.map((document) => document.text)).toContain("cinematic rain street");
    expect(documents.map((document) => document.text)).toContain(favorites[0].text);
    expect(documents.map((document) => document.text)).toContain(messages[0].content);
    expect(documents.map((document) => document.text)).toContain(images[0].prompt);
    expect(documents.map((document) => document.text)).toContain(images[0].requestPrompt);
  });

  it("retrieves the most similar local-vector matches", () => {
    const result = retrieveRagContext({
      query: "neon rainy street portrait",
      documents: collectRagDocuments({
        wordbanks,
        favoritePrompts: favorites,
        messages,
        imageAssets: images,
      }),
      topK: 3,
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].text).toContain("cinematic rain street");
    expect(result.context).toContain("RAG 参考内容");
    expect(result.context).toContain("cinematic rain street");
  });

  it("prioritizes project wordbank matches over other sources when scores are close", () => {
    const result = retrieveRagContext({
      query: "cinematic rain street",
      documents: [
        {
          id: "history:exact",
          source: "history",
          title: "历史 Prompt",
          text: "cinematic rain street",
        },
        {
          id: "favorite:exact",
          source: "favorite",
          title: "收藏 Prompt",
          text: "cinematic rain street",
        },
        {
          id: "wordbank:exact",
          source: "wordbank",
          title: "项目词库",
          text: "cinematic rain street",
        },
      ],
      topK: 3,
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "wordbank:exact",
      "favorite:exact",
      "history:exact",
    ]);
    expect(result.items[0].sourceWeight).toBeGreaterThan(result.items[2].sourceWeight);
  });

  it("excludes selected matches from retrieved items and the final context block", () => {
    const result = retrieveRagContext({
      query: "cinematic rain street neon reflection",
      documents: collectRagDocuments({
        wordbanks,
        favoritePrompts: favorites,
        messages,
        imageAssets: images,
      }),
      excludedIds: ["favorite:fav-1"],
      topK: 5,
    });

    expect(result.items.map((item) => item.id)).not.toContain("favorite:fav-1");
    expect(result.context).not.toContain(favorites[0].text);
  });

  it("builds a compact RAG context block without duplicates", () => {
    const block = buildRagContextBlock([
      {
        id: "a",
        source: "favorite",
        title: "A",
        text: "cinematic rain street",
        rawScore: 0.9,
        score: 0.9,
        sourceWeight: 1.1,
      },
      {
        id: "b",
        source: "history",
        title: "B",
        text: "cinematic rain street",
        rawScore: 0.8,
        score: 0.8,
        sourceWeight: 1,
      },
    ]);

    expect(block.match(/cinematic rain street/g)).toHaveLength(1);
    expect(block).toContain("仅作为参考，不要覆盖用户原始提示词");
  });
});
