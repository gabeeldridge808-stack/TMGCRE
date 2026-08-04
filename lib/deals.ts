// Shared deal-creation logic used by both the API route
// (app/api/deals/route.ts) and the "New Deal" server action
// (app/deals/new/actions.ts) — one INSERT, not two copies of it.
import { queryOrThrow } from "@/lib/db";
import { ASSET_CLASSES, STAGES } from "@/lib/dealConstants";

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

/** Throws on any failure — callers use describeCreateDealError to turn that into a message. */
export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const [deal] = await queryOrThrow<Deal>(
    `insert into deals (name, asset_class, stage, owner)
     values ($1, $2, $3, $4)
     returning *`,
    [input.name, input.asset_class, input.stage, input.owner]
  );
  return deal;
}

export interface CreateDealError {
  status: number;
  message: string;
}

// Postgres check-constraint violation. See https://www.postgresql.org/docs/current/errcodes-appendix.html
const CHECK_VIOLATION = "23514";

/** Pure: turns a createDeal() failure into a status + message a caller can show directly. */
export function describeCreateDealError(error: unknown): CreateDealError {
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
