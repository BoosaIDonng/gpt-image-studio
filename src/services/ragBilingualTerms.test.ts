import { describe, expect, it } from "vitest";
import { bilingualExpansions, bilingualTermKeys } from "./ragBilingualTerms";
import { collectRagDocuments, retrieveRagContext } from "./rag";
import type { ImageAsset } from "../types/studio";

describe("bilingual term map", () => {
  it("maps Chinese art vocabulary to English equivalents", () => {
    expect(bilingualExpansions("电影感")).toContain("cinematic");
    expect(bilingualExpansions("特写")).toContain("close-up");
    expect(bilingualExpansions("赛博朋克")).toContain("cyberpunk");
    expect(bilingualExpansions("不存在的词")).toEqual([]);
  });

  it("keys are lowercase and unique-valued", () => {
    for (const key of bilingualTermKeys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

function image(prompt: string, id = "img-1"): ImageAsset {
  return {
    id,
    name: `asset-${id}`,
    source: "generated",
    width: 1024,
    height: 1024,
    prompt,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("rag bilingual retrieval", () => {
  it("matches a Chinese query against English documents via term bridging", () => {
    const documents = collectRagDocuments({
      wordbanks: { pose: { safe: [], creative: [], nsfw: [] }, adultInspiration: [] },
      imageAssets: [
        image("cinematic rain street portrait, neon reflection, moody atmosphere", "img-1"),
        image("a bowl of ramen on a wooden counter, warm light", "img-2"),
      ],
    });

    const result = retrieveRagContext({
      query: "雨夜电影感街头人像",
      documents,
      topK: 2,
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].id).toContain("img-1");
  });

  it("keeps Chinese documents reachable without English terms", () => {
    const documents = collectRagDocuments({
      wordbanks: { pose: { safe: [], creative: [], nsfw: [] }, adultInspiration: [] },
      imageAssets: [image("雨夜街头的人像,霓虹灯反射,电影感氛围", "img-1")],
    });

    const result = retrieveRagContext({
      query: "雨夜街头",
      documents,
      topK: 2,
    });

    expect(result.items.length).toBe(1);
  });
});
