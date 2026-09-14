/**
 * Optional browser-side semantic retrieval for RAG (transformers.js).
 *
 * Embeds RAG documents and the query with a small multilingual model so
 * paraphrase and cross-language matches surface even when token overlap is
 * zero. Everything is lazy: the model (~100 MB, cached by transformers.js in
 * browser storage) downloads on first use and the pipeline is built once.
 *
 * Failure policy: every entry point degrades to "no semantic scores" instead
 * of throwing — lexical retrieval must keep working when webgpu/wasm or the
 * model download is unavailable.
 */

export type SemanticInput = {
  query: string;
  documents: Array<{ id: string; text: string }>;
};

export type SemanticMatch = {
  documentId: string;
  /** Cosine similarity in [-1, 1] between the query and document embeddings. */
  score: number;
};

export type SemanticSearcher = {
  search: (input: SemanticInput) => Promise<SemanticMatch[]>;
};

const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
/** e5 expects the "query: "/"passage: " prefixes for best retrieval quality. */
const QUERY_PREFIX = "query: ";
const PASSAGE_PREFIX = "passage: ";
/** Documents shorter than this carry little semantic signal worth embedding. */
const MIN_TEXT_LENGTH = 4;

let pipelinePromise: Promise<SemanticSearcher | null> | null = null;

/** Lazy singleton; resolves to null when the environment cannot run the model. */
export function getSemanticSearcher(): Promise<SemanticSearcher | null> {
  pipelinePromise ??= loadPipeline().catch(() => null);
  return pipelinePromise;
}

/** Test hook: drop the cached pipeline so a mock can be injected. */
export function resetSemanticSearcher() {
  pipelinePromise = null;
}

async function loadPipeline(): Promise<SemanticSearcher | null> {
  const transformers = await import("@huggingface/transformers");
  const extractor = await transformers.pipeline("feature-extraction", EMBEDDING_MODEL, {
    dtype: "q8",
  });

  async function embed(texts: string[]): Promise<Float32Array[]> {
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const dimensions = output.dims[output.dims.length - 1];
    const data = output.data as Float32Array;
    const vectors: Float32Array[] = [];
    for (let index = 0; index < texts.length; index += 1) {
      vectors.push(data.slice(index * dimensions, (index + 1) * dimensions));
    }
    return vectors;
  }

  const passageCache = new Map<string, Float32Array>();

  return {
    async search({ query, documents }) {
      if (!query.trim() || !documents.length) return [];

      const embeddable = documents.filter(
        (document) => document.text.trim().length >= MIN_TEXT_LENGTH,
      );
      if (!embeddable.length) return [];

      const missing = embeddable.filter((document) => !passageCache.has(document.text));
      if (missing.length) {
        const vectors = await embed(missing.map((document) => PASSAGE_PREFIX + document.text));
        missing.forEach((document, index) => {
          passageCache.set(document.text, vectors[index]);
        });
      }

      const [queryVector] = await embed([QUERY_PREFIX + query.trim()]);
      return embeddable
        .map((document) => {
          const passageVector = passageCache.get(document.text);
          if (!passageVector) return null;
          return { documentId: document.id, score: cosineSimilarity(queryVector, passageVector) };
        })
        .filter((match): match is SemanticMatch => match !== null);
    },
  };
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = left[index];
    const r = right[index];
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
