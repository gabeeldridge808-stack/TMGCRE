"use server";

import { buildDealPayload } from "@/lib/dealForm";
import { updateDeal, describeDealWriteError } from "@/lib/deals";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";
import { query } from "@/lib/db";
import { canAccessDeal } from "@/lib/dealAccess";

export interface EditDealState {
  error?: string;
  saved?: boolean;
}

export async function editDealAction(
  dealId: string,
  _prevState: EditDealState,
  formData: FormData
): Promise<EditDealState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in to edit a deal." };
  }

  // Re-checked here, not just at the page that renders the form — a Server
  // Action is its own callable endpoint and can't rely on the page having
  // gated access before rendering.
  const [existing] = await query<{ owner_id: string }>(`select owner_id from deals where id = $1`, [dealId]);
  if (!existing) {
    return { error: "Deal not found." };
  }
  if (!canAccessDeal(user, existing.owner_id)) {
    return { error: "You don't have access to this deal." };
  }

  const submittedOwnerId = formData.get("owner_id")?.toString() ?? "";
  const ownerId = user.role === "admin" && submittedOwnerId ? submittedOwnerId : existing.owner_id;

  const payload = buildDealPayload({
    name: formData.get("name")?.toString() ?? "",
    asset_class: formData.get("asset_class")?.toString() ?? "",
    stage: formData.get("stage")?.toString() ?? "",
    owner_id: ownerId,
    deal_category: formData.get("deal_category")?.toString() ?? "",
    development_stage: formData.get("development_stage")?.toString() ?? "",
  });

  if (!payload.name || !payload.asset_class || !payload.owner_id) {
    return { error: "Name, asset class, and owner are required." };
  }

  try {
    await updateDeal(dealId, payload);
  } catch (error) {
    return { error: describeDealWriteError(error).message };
  }

  await recordAuditLog(user, { dealId, action: "deal.updated" });

  // See the comment in app/deals/new/actions.ts — redirect() to a
  // middleware-protected path from a Server Action bounces to /login even
  // for an authenticated user, so the client navigates instead.
  return { saved: true };
}
