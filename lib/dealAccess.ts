import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { SessionUser } from "@/lib/auth";

/** An admin can see/edit every deal; anyone else only their own. */
export function canAccessDeal(user: SessionUser, ownerId: string): boolean {
  return user.role === "admin" || user.id === ownerId;
}

export type DealAccessResult = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

/**
 * Gate for every /api/deals/[id]/** route: a deal id in the URL is
 * otherwise just an unguarded lookup key any logged-in user could pass.
 * Looks the owner up itself rather than trusting a caller-supplied id,
 * since the whole point is not to trust the caller.
 */
export async function requireDealAccess(dealId: string): Promise<DealAccessResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const [deal] = await query<{ owner_id: string }>(`select owner_id from deals where id = $1`, [dealId]);
  if (!deal) {
    return { ok: false, response: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }

  if (!canAccessDeal(user, deal.owner_id)) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { ok: true, user };
}
