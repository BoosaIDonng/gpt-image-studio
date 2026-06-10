import { describe, expect, it } from "vitest";
import type { FavoritePrompt, ImageAsset, Message, PromptWordbanks } from "../types/studio";
import {
  buildRagContextBlock,
  buildRagMatchBarState,
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
  it("collects wordbank terms and raw prompts from successful generated images", () => {
    const documents = collectRagDocuments({
      wordbanks,
      imageAssets: images,
    });

    expect(documents.map((document) => document.source)).toEqual(["wordbank", "image"]);
    expect(documents.map((document) => document.text)).toEqual([
      "cinematic rain street",
      "wide city skyline wide city skyline, cinematic rain street rainy city skyline with neon reflection",
    ]);
    expect(documents[0].sourceImageId).toBe("img-1");
    expect(documents[0].sourceImageIds).toEqual(["img-1"]);
    expect(documents[0].title).toBe("成功图片匹配词库: city");
    expect(documents[1].title).toBe("成功图片 Prompt: city");
    expect(documents.map((document) => document.text)).not.toContain(favorites[0].text);
    expect(documents.map((document) => document.text)).not.toContain(messages[0].content);
  });

  it("merges the same wordbank term across successful images for retrieval", () => {
    const documents = collectRagDocuments({
      wordbanks: {
        pose: {
          safe: ["soft window light"],
          creative: [],
          nsfw: [],
        },
        adultInspiration: [],
      },
      imageAssets: [
        {
          id: "img-red",
          name: "red room",
          source: "generated",
          prompt: "red room portrait with soft window light",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "img-blue",
          name: "blue room",
          source: "generated",
          prompt: "blue loft portrait with soft window light",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const result = retrieveRagContext({
      query: "soft window light",
      documents,
      topK: 3,
    });
    const wordbankDocuments = documents.filter(
      (document) => document.source === "wordbank",
    );

    expect(wordbankDocuments).toHaveLength(1);
    expect(wordbankDocuments[0].sourceImageIds).toEqual(["img-red", "img-blue"]);
    expect(result.items[0].text).toBe("soft window light");
  });

  it("retrieves the most similar local-vector matches", () => {
    const result = retrieveRagContext({
      query: "neon rainy street portrait",
      documents: collectRagDocuments({
        wordbanks,
        imageAssets: images,
      }),
      topK: 3,
    });

    expect(result.items[0].text).toContain("cinematic rain street");
    expect(result.context).toContain("RAG 参考内容");
    expect(result.context).toContain("cinematic rain street");
  });

  it("keeps wordbank terms separate from successful generated image prompts", () => {
    const documents = collectRagDocuments({
      wordbanks: {
        pose: {
          safe: ["sitting on chair"],
          creative: ["cinematic rain street"],
          nsfw: ["spread legs"],
        },
        adultInspiration: ["editorial mood"],
      },
      imageAssets: [
        {
          id: "success-image",
          name: "成功图片",
          source: "generated",
          prompt: "画一个女孩坐在椅子上",
          requestPrompt: "画一个女孩坐在椅子上",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const result = retrieveRagContext({
      query: "新图也坐在椅子上",
      documents,
      topK: 3,
    });

    expect(documents.map((document) => document.source)).toEqual(["wordbank", "image"]);
    expect(documents[0].text).toBe("sitting on chair");
    expect(result.context).toContain("sitting on chair");
    expect(result.context).not.toContain("cinematic rain street");
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
        imageAssets: images,
      }),
      excludedIds: ["image-wordbank:img-1:0"],
      topK: 5,
    });

    expect(result.items.map((item) => item.id)).not.toContain("image-wordbank:img-1:0");
    expect(result.context).not.toContain("cinematic rain street");
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

  it("builds compact match-bar state from active and excluded RAG matches", () => {
    const state = buildRagMatchBarState({
      items: [
        {
          id: "image-wordbank:img-1:0",
          source: "wordbank",
          title: "成功图片匹配词库: city",
          text: "cinematic rain street",
          sourceImageId: "img-1",
          sourceImageIds: ["img-1"],
          rawScore: 0.4,
          score: 0.5,
          sourceWeight: 1.25,
        },
        {
          id: "image-wordbank:img-2:0",
          source: "wordbank",
          title: "成功图片匹配词库: portrait",
          text: "sitting on chair",
          sourceImageId: "img-2",
          sourceImageIds: ["img-2"],
          rawScore: 0.3,
          score: 0.38,
          sourceWeight: 1.25,
        },
        {
          id: "image-wordbank:img-2:1",
          source: "wordbank",
          title: "成功图片匹配词库: portrait",
          text: "soft window light",
          sourceImageId: "img-2",
          sourceImageIds: ["img-2"],
          rawScore: 0.2,
          score: 0.25,
          sourceWeight: 1.25,
        },
        {
          id: "image-wordbank:img-3:0",
          source: "wordbank",
          title: "成功图片匹配词库: room",
          text: "dramatic rim light",
          sourceImageId: "img-3",
          sourceImageIds: ["img-3"],
          rawScore: 0.18,
          score: 0.23,
          sourceWeight: 1.25,
        },
      ],
      excludedItems: [
        {
          id: "image-wordbank:img-4:0",
          source: "wordbank",
          title: "成功图片匹配词库: old",
          text: "old excluded term",
          sourceImageId: "img-4",
          rawScore: 0.1,
          score: 0.13,
          sourceWeight: 1.25,
        },
      ],
      maxVisibleItems: 3,
    });

    expect(state.visibleItems.map((item) => item.text)).toEqual([
      "cinematic rain street",
      "sitting on chair",
      "soft window light",
    ]);
    expect(state.activeCount).toBe(4);
    expect(state.hiddenItemCount).toBe(1);
    expect(state.excludedCount).toBe(1);
    expect(state.sourceImageCount).toBe(3);
    expect(state.shouldShow).toBe(true);
  });

  it("keeps the match bar visible when only excluded matches remain", () => {
    const state = buildRagMatchBarState({
      items: [],
      excludedItems: [
        {
          id: "image-wordbank:img-1:0",
          source: "wordbank",
          title: "成功图片匹配词库: city",
          text: "cinematic rain street",
          sourceImageId: "img-1",
          rawScore: 0,
          score: 0,
          sourceWeight: 1.25,
        },
      ],
    });

    expect(state.visibleItems).toEqual([]);
    expect(state.activeCount).toBe(0);
    expect(state.excludedCount).toBe(1);
    expect(state.shouldShow).toBe(true);
  });

  it("collects favorites, recent successful user history, and successful image prompts", () => {
    const documents = collectRagDocuments({
      wordbanks,
      imageAssets: images,
      favoritePrompts: favorites,
      messages,
    });

    expect(documents.map((document) => document.source)).toEqual([
      "wordbank",
      "image",
      "favorite",
      "history",
    ]);
    expect(documents.map((document) => document.id)).toContain("image-prompt:img-1");
    expect(documents.map((document) => document.id)).toContain("favorite:fav-1");
    expect(documents.map((document) => document.id)).toContain("history:m-1");
    expect(documents.map((document) => document.text)).toContain(favorites[0].text);
    expect(documents.map((document) => document.text)).toContain(messages[0].content);
  });

  it("skips unsafe or non-user history documents", () => {
    const documents = collectRagDocuments({
      wordbanks,
      imageAssets: [],
      favoritePrompts: [],
      messages: [
        {
          ...messages[0],
          id: "history-secret",
          content: "sk-secret blob:http://preview data:image/png;base64,AAAA",
        },
        {
          ...messages[1],
          id: "assistant-message",
          role: "assistant",
          content: "assistant result should not become RAG history",
        },
        {
          ...messages[0],
          id: "failed-user-message",
          status: "error",
          content: "failed user prompt should not become RAG history",
        },
      ],
    });

    expect(documents).toEqual([]);
  });

  it("prioritizes wordbank matches over favorites and history when text scores are close", () => {
    const result = retrieveRagContext({
      query: "cinematic rain street",
      documents: [
        {
          id: "history:close",
          source: "history",
          title: "历史 Prompt",
          text: "cinematic rain street",
        },
        {
          id: "favorite:close",
          source: "favorite",
          title: "收藏 Prompt",
          text: "cinematic rain street",
        },
        {
          id: "wordbank:close",
          source: "wordbank",
          title: "成功图片匹配词库: city",
          text: "cinematic rain street",
        },
      ],
      topK: 3,
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "wordbank:close",
      "favorite:close",
      "history:close",
    ]);
  });

  it("retrieves mixed Chinese and English short-query matches", () => {
    const result = retrieveRagContext({
      query: "雨夜 neon",
      documents: [
        {
          id: "history:rain",
          source: "history",
          title: "历史 Prompt",
          text: "雨夜街头 neon reflection portrait",
        },
        {
          id: "favorite:forest",
          source: "favorite",
          title: "收藏 Prompt",
          text: "forest daylight portrait",
        },
      ],
      topK: 2,
    });

    expect(result.items[0]?.id).toBe("history:rain");
    expect(result.context).toContain("雨夜街头 neon reflection portrait");
  });

  it("scores complete short-query token coverage without penalizing extra document context", () => {
    const result = retrieveRagContext({
      query: "rain street",
      documents: [
        {
          id: "history:long",
          source: "history",
          title: "历史 Prompt",
          text: "rain street portrait with neon reflection and wet asphalt",
        },
      ],
      topK: 1,
    });

    expect(result.items[0]?.rawScore).toBe(1);
  });
});
