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

export async function searchPortfolio(queryText: string, topK = 15): Promise<PortfolioSearchResult[]> {
  const embedding = await embedQuery(queryText);
  return query<PortfolioSearchResult>(
    `select d.id as deal_id, d.name as deal_name, doc.source_filename, doc.page_number, doc.content,
            1 - (doc.embedding <=> $1) as similarity
     from documents doc
     join deals d on d.id = doc.deal_id
     order by doc.embedding <=> $1
     limit $2`,
    [pgvector.toSql(embedding), topK]
  );
}
