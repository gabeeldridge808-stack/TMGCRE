// Cross-deal semantic search — the same retrieval lib/agent.ts does for one
// deal's chat, but without the deal_id filter, so it answers "which deals
// mention X" instead of "what does this deal's documents say about X."
import { query, pgvector } from "@/lib/db";
import { embedQuery } from "@/lib/embeddings";

export interface PortfolioSearchResult {
  deal_id: string;
  deal_name: string;
  source_filename: string;
  page_number: number | null;
  content: string;
  similarity: number;
}

/**
 * `restrictToOwnerId` scopes results to one owner's deals — every caller
 * except an admin must pass their own user id here, since this otherwise
 * searches documents across every deal in the org regardless of who owns
 * them.
 */
export async function searchPortfolio(
  queryText: string,
  restrictToOwnerId: string | null,
  topK = 15
): Promise<PortfolioSearchResult[]> {
  const embedding = await embedQuery(queryText);
  return query<PortfolioSearchResult>(
    restrictToOwnerId
      ? `select d.id as deal_id, d.name as deal_name, doc.source_filename, doc.page_number, doc.content,
                1 - (doc.embedding <=> $1) as similarity
         from documents doc
         join deals d on d.id = doc.deal_id
         where d.owner_id = $3
         order by doc.embedding <=> $1
         limit $2`
      : `select d.id as deal_id, d.name as deal_name, doc.source_filename, doc.page_number, doc.content,
                1 - (doc.embedding <=> $1) as similarity
         from documents doc
         join deals d on d.id = doc.deal_id
         order by doc.embedding <=> $1
         limit $2`,
    restrictToOwnerId ? [pgvector.toSql(embedding), topK, restrictToOwnerId] : [pgvector.toSql(embedding), topK]
  );
}
