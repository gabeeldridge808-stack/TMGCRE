// Pure helpers behind lib/agent.ts's retrieveContext(). Split out so the
// merge/scoring logic can be unit tested without a database: pure cosine
// similarity search can't tell "5.25% cap rate" from "5.75% cap rate" apart
// except by how close their embeddings happen to land, which is exactly
// the failure mode this exists to catch — two nearby, similar-but-different
// figures in the same document, where an embedding-only search has no
// mechanism to prefer the chunk that actually contains the number asked
// about. This adds an exact-text matching lane alongside vector search
// specifically for that.

const NUMERIC_TOKEN_RE = /\$\d[\d,]*(?:\.\d+)?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?x\b|\d{1,3}(?:,\d{3})*(?:\.\d+)?/gi;

/**
 * Pure: pulls dollar amounts, percentages, multiples (e.g. "1.35x" DSCR),
 * and plain numbers out of a question. These are worth an exact substring
 * match against document content in addition to embedding similarity,
 * since two figures that are numerically distinct but contextually similar
 * (two cap rates, two unit counts) can embed close together.
 */
export function extractNumericTokens(question: string): string[] {
  const matches = question.match(NUMERIC_TOKEN_RE) ?? [];
  return [...new Set(matches)];
}

/**
 * Pure: reciprocal rank fusion of two ranked lists into one. A result that
 * ranks well on either signal (vector similarity or keyword relevance)
 * surfaces, rather than one list's ordering silently dominating.
 */
export function fuseRankings<T>(rankedA: T[], rankedB: T[], keyOf: (item: T) => string, k = 60): T[] {
  const scored = new Map<string, { item: T; score: number }>();

  const add = (list: T[]) => {
    list.forEach((item, i) => {
      const key = keyOf(item);
      const contribution = 1 / (k + i + 1);
      const existing = scored.get(key);
      if (existing) existing.score += contribution;
      else scored.set(key, { item, score: contribution });
    });
  };

  add(rankedA);
  add(rankedB);

  return [...scored.values()].sort((a, b) => b.score - a.score).map((s) => s.item);
}

/**
 * Pure: combines exact numeric matches, vector-ranked results, and
 * keyword-ranked results into one deduplicated list capped at `limit`.
 * Exact matches go first and always survive the cap — if the question
 * names a specific figure, the chunk containing that literal figure should
 * never be the one that gets crowded out.
 */
export function fuseRetrievedChunks<T extends { content: string }>(
  exactMatches: T[],
  vectorRanked: T[],
  keywordRanked: T[],
  limit: number
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  const addAll = (list: T[]) => {
    for (const item of list) {
      if (result.length >= limit) return;
      if (seen.has(item.content)) continue;
      seen.add(item.content);
      result.push(item);
    }
  };

  addAll(exactMatches);
  addAll(fuseRankings(vectorRanked, keywordRanked, (c) => c.content));
  return result;
}
