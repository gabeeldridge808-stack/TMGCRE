// Shared deal-creation logic used by both the API route
// (app/api/deals/route.ts) and the "New Deal" server action
// (app/deals/new/actions.ts) — one INSERT, not two copies of it.
import { query } from "@/lib/db";

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

/** Returns undefined if the database is unreachable — callers check for that. */
export async function createDeal(input: CreateDealInput): Promise<Deal | undefined> {
  const [deal] = await query<Deal>(
    `insert into deals (name, asset_class, stage, owner)
     values ($1, $2, $3, $4)
     returning *`,
    [input.name, input.asset_class, input.stage, input.owner]
  );
  return deal;
}
