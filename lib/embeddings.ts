// Embeddings via Voyage AI — Anthropic has no embeddings endpoint; Voyage is
// Anthropic's recommended embeddings partner. Model + dimension here MUST
// match the `vector(1024)` column in schema.sql. If you change either,
// existing rows need re-embedding (pgvector rejects mismatched dimensions).
const VOYAGE_MODEL = "voyage-3-large";
const OUTPUT_DIMENSION = 1024;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

// Voyage caps batch size per request; stay well under it.
const BATCH_SIZE = 64;

type InputType = "document" | "query";

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
}

async function embedBatch(texts: string[], inputType: InputType): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set");
  }

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: OUTPUT_DIMENSION,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as VoyageResponse;
  // Voyage returns results in the same order as input, but sort by `index`
  // defensively rather than assuming that holds.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed document chunks for storage. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    out.push(...(await embedBatch(batch, "document")));
  }
  return out;
}

/** Embed a single search query. */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], "query");
  return embedding;
}
