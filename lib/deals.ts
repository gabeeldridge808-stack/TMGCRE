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
  owner_id: string;
  deal_category: string;
  development_stage: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDealInput {
  name: string;
  asset_class: string;
  stage: string;
  owner_id: string;
  deal_category: string;
  development_stage: string | null;
}

/** Throws on any failure — callers use describeDealWriteError to turn that into a message. */
export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const [deal] = await queryOrThrow<Deal>(
    `insert into deals (name, asset_class, stage, owner_id, deal_category, development_stage)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [input.name, input.asset_class, input.stage, input.owner_id, input.deal_category, input.development_stage]
  );
  await ensureChecklistForStage(deal.id, deal.stage);
  return deal;
}

/** Throws on any failure (including "not found", surfaced as a plain Error) — callers use describeDealWriteError. */
export async function updateDeal(id: string, input: CreateDealInput): Promise<Deal> {
  const [deal] = await queryOrThrow<Deal>(
    `update deals set name = $2, asset_class = $3, stage = $4, owner_id = $5,
       deal_category = $6, development_stage = $7, updated_at = now()
     where id = $1
     returning *`,
    [id, input.name, input.asset_class, input.stage, input.owner_id, input.deal_category, input.development_stage]
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

// Postgres error codes. See https://www.postgresql.org/docs/current/errcodes-appendix.html
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

/** Pure: turns a createDeal()/updateDeal() failure into a status + message a caller can show directly. */
export function describeDealWriteError(error: unknown): DealWriteError {
  if (error instanceof Error && error.message === "not found") {
    return { status: 404, message: "Deal not found." };
  }
  const code = (error as { code?: string } | null | undefined)?.code;

  if (code === CHECK_VIOLATION) {
    const constraint = (error as { constraint?: string } | null | undefined)?.constraint;
    if (constraint === "development_stage_matches_category") {
      return {
        status: 400,
        message: "A development deal requires a development stage; an acquisition deal must not have one.",
      };
    }
    return {
      status: 400,
      message: `Invalid asset class or stage. asset_class must be one of: ${ASSET_CLASSES.join(", ")}. stage must be one of: ${STAGES.join(", ")}.`,
    };
  }

  if (code === FOREIGN_KEY_VIOLATION) {
    return { status: 400, message: "Owner must be an existing user." };
  }

  return {
    status: 503,
    message: "Couldn't save the deal — the database is unreachable. Check that DATABASE_URL is set and the database is running.",
  };
}
