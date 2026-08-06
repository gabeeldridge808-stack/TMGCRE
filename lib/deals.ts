// Shared deal-creation/edit logic used by the API routes
// (app/api/deals/route.ts, app/api/deals/[id]/route.ts) and the "New Deal"
// / "Edit Deal" server actions — one INSERT and one UPDATE, not scattered
// copies of them.
import { queryOrThrow } from "@/lib/db";
import { ASSET_CLASSES, STAGES } from "@/lib/dealConstants";
import { ensureChecklistForStage } from "@/lib/checklist";

export interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDealInput {
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

/** Throws on any failure — callers use describeDealWriteError to turn that into a message. */
export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const [deal] = await queryOrThrow<Deal>(
    `insert into deals (name, asset_class, stage, owner)
     values ($1, $2, $3, $4)
     returning *`,
    [input.name, input.asset_class, input.stage, input.owner]
  );
  await ensureChecklistForStage(deal.id, deal.stage);
  return deal;
}

/** Throws on any failure (including "not found", surfaced as a plain Error) — callers use describeDealWriteError. */
export async function updateDeal(id: string, input: CreateDealInput): Promise<Deal> {
  const [deal] = await queryOrThrow<Deal>(
    `update deals set name = $2, asset_class = $3, stage = $4, owner = $5, updated_at = now()
     where id = $1
     returning *`,
    [id, input.name, input.asset_class, input.stage, input.owner]
  );
  if (!deal) {
    throw new Error("not found");
  }
  await ensureChecklistForStage(deal.id, deal.stage);
  return deal;
}

export interface DealWriteError {
  status: number;
  message: string;
}

// Postgres check-constraint violation. See https://www.postgresql.org/docs/current/errcodes-appendix.html
const CHECK_VIOLATION = "23514";

/** Pure: turns a createDeal()/updateDeal() failure into a status + message a caller can show directly. */
export function describeDealWriteError(error: unknown): DealWriteError {
  if (error instanceof Error && error.message === "not found") {
    return { status: 404, message: "Deal not found." };
  }
  const code = (error as { code?: string } | null | undefined)?.code;

  if (code === CHECK_VIOLATION) {
    return {
      status: 400,
      message: `Invalid asset class or stage. asset_class must be one of: ${ASSET_CLASSES.join(", ")}. stage must be one of: ${STAGES.join(", ")}.`,
    };
  }

  return {
    status: 503,
    message: "Couldn't save the deal — the database is unreachable. Check that DATABASE_URL is set and the database is running.",
  };
}
