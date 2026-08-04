// Character-based chunker. No token library — ~4 characters per token is a
// standard-enough approximation for chunk sizing, and Voyage's tokenizer
// isn't public anyway, so exact token counts aren't achievable without an
// extra API round-trip. Splits on paragraph boundaries where possible so
// chunks don't cut mid-sentence; falls back to a hard split for paragraphs
// longer than the chunk size (e.g. dense tables dumped as one block).

const CHARS_PER_CHUNK = 4000; // ~1000 tokens
const OVERLAP_CHARS = 600; // ~150 tokens

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
  };

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;

    if (candidate.length <= CHARS_PER_CHUNK) {
      current = candidate;
      continue;
    }

    // Adding this paragraph would overflow the current chunk.
    if (current) {
      flush();
      // Carry the tail of the previous chunk forward as overlap.
      const tail = current.slice(-OVERLAP_CHARS);
      current = tail;
    }

    if (para.length <= CHARS_PER_CHUNK) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      // Single paragraph exceeds chunk size on its own — hard-split it.
      let rest = para;
      while (rest.length > CHARS_PER_CHUNK) {
        const piece = rest.slice(0, CHARS_PER_CHUNK);
        chunks.push((current ? `${current}\n\n${piece}` : piece).trim());
        current = "";
        rest = rest.slice(CHARS_PER_CHUNK - OVERLAP_CHARS);
      }
      current = rest;
    }
  }

  flush();
  return chunks;
}
