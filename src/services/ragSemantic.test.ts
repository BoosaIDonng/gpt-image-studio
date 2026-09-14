import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectRagDocuments, retrieveRagContextEnhanced } from "./rag";
import { resetSemanticSearcher } from "./ragSemantic";
import type { ImageAsset } from "../types/studio";

const mocks = vi.hoisted(() => ({
  extractor: vi.fn(),
}));

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(async () => mocks.extractor),
}));

/**
 * The mocked extractor maps text content to vectors: "cinematic" texts point
 * along +X, everything else along +Y. The query text decides which direction
 * the query vector takes.
 */
function fakeEmbedding(text: string): number[] {
  return text.includes("cinematic") || text.includes("query-cinematic") ? [1, 0] : [0, 1];
}

function image(prompt: string, id: string): ImageAsset {
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

describe("rag semantic retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSemanticSearcher();
    mocks.extractor.mockImplementation(async (texts: string[]) => {
      const vectors = texts.map(fakeEmbedding);
      return {
        dims: [texts.length, vectors[0].length],
        data: new Float32Array(vectors.flat()),
      };
    });
  });

  it("fuses semantic scores so a paraphrase-only document surfaces", async () => {
    const documents = collectRagDocuments({
      wordbanks: { pose: { safe: [], creative: [], nsfw: [] }, adultInspiration: [] },
      imageAssets: [
        // Lexically unrelated to the query (zero token overlap) but semantically close.
        image("cinematic dramatic portrait with moody lighting", "img-cine"),
        image("a bowl of ramen on a wooden counter", "img-ramen"),
      ],
    });

    const result = await retrieveRagContextEnhanced({
      query: "query-cinematic 电影感画面",
      documents,
      topK: 2,
      semanticEnabled: true,
    });

    expect(result.items[0]?.id).toBe("image-prompt:img-cine");
  });

  it("falls back to lexical-only retrieval when the model cannot load", async () => {
    resetSemanticSearcher();
    vi.doMock("@huggingface/transformers", () => ({
      pipeline: vi.fn(async () => {
        throw new Error("no webgpu");
      }),
    }));
    vi.resetModules();
    const { retrieveRagContextEnhanced: freshRetrieve } = await import("./rag");

    const documents = collectRagDocuments({
      wordbanks: { pose: { safe: [], creative: [], nsfw: [] }, adultInspiration: [] },
      imageAssets: [image("cinematic rain street portrait", "img-1")],
    });

    const result = await freshRetrieve({
      query: "cinematic rain",
      documents,
      topK: 2,
      semanticEnabled: true,
    });

    // Lexical matching still works; no crash from the failed model load.
    expect(result.items.length).toBe(1);
  });

  it("skips the semantic pass entirely when the toggle is off", async () => {
    const documents = collectRagDocuments({
      wordbanks: { pose: { safe: [], creative: [], nsfw: [] }, adultInspiration: [] },
      imageAssets: [image("cinematic rain street portrait", "img-1")],
    });

    await retrieveRagContextEnhanced({
      query: "cinematic rain",
      documents,
      topK: 2,
      semanticEnabled: false,
    });

    expect(mocks.extractor).not.toHaveBeenCalled();
  });
});
