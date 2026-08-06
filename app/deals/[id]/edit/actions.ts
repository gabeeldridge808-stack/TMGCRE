"use server";

import { buildDealPayload } from "@/lib/dealForm";
import { updateDeal, describeDealWriteError } from "@/lib/deals";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";

export interface EditDealState {
  error?: string;
  saved?: boolean;
}

export async function editDealAction(
  dealId: string,
  _prevState: EditDealState,
  formData: FormData
): Promise<EditDealState> {
  const payload = buildDealPayload({
    name: formData.get("name")?.toString() ?? "",
    asset_class: formData.get("asset_class")?.toString() ?? "",
    stage: formData.get("stage")?.toString() ?? "",
    owner: formData.get("owner")?.toString() ?? "",
  });

  if (!payload.name || !payload.asset_class || !payload.owner) {
    return { error: "Name, asset class, and owner are required." };
  }

  try {
    await updateDeal(dealId, payload);
  } catch (error) {
    return { error: describeDealWriteError(error).message };
  }

  const user = await getCurrentUser();
  if (user) await recordAuditLog(user, { dealId, action: "deal.updated" });

  // See the comment in app/deals/new/actions.ts — redirect() to a
  // middleware-protected path from a Server Action bounces to /login even
  // for an authenticated user, so the client navigates instead.
  return { saved: true };
}
