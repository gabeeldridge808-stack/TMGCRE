// Retrieval verification CLI — no chat/agent layer, just: does retrieval
// actually return the right chunk for a question you know the answer to.
// Calls the same retrieveContext() the chat agent uses (lib/agent.ts),
// hybrid vector + keyword + exact-figure matching, not a separate
// vector-only implementation that could silently drift from it.
//
//   npx tsx scripts/search.ts --deal-id <uuid> --query "..." [--top-k 5]

import "dotenv/config";
import { retrieveContext } from "../lib/agent";

interface Args {
  dealId: string;
  searchQuery: string;
  topK: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };

  const dealId = get("--deal-id");
  const searchQuery = get("--query");
  const topK = Number(get("--top-k") ?? "5");

  if (!dealId || !searchQuery) {
    console.error('Usage: search.ts --deal-id <uuid> --query "..." [--top-k 5]');
    process.exit(1);
  }

  return { dealId, searchQuery, topK };
}

async function main() {
  const { dealId, searchQuery, topK } = parseArgs();

  const results = await retrieveContext(dealId, searchQuery, topK);

  if (results.length === 0) {
    console.log("No documents found for this deal. Have you run ingest.ts yet?");
    process.exit(0);
  }

  console.log(`Top ${results.length} result(s) for: "${searchQuery}"\n`);
  results.forEach((r, i) => {
    const page = r.page_number ? `, page ${r.page_number}` : "";
    const preview = r.content.replace(/\s+/g, " ").trim().slice(0, 300);
    console.log(`${i + 1}. [${r.similarity.toFixed(3)}] ${r.source_filename}${page}`);
    console.log(`   ${preview}${r.content.length > 300 ? "..." : ""}\n`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
