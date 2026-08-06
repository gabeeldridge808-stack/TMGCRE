"use server";

import { redirect } from "next/navigation";
import { buildDealPayload } from "@/lib/dealForm";
import { createDeal, describeDealWriteError } from "@/lib/deals";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";

export interface CreateDealState {
  error?: string;
}

export async function createDealAction(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const payload = buildDealPayload({
    name: formData.get("name")?.toString() ?? "",
    asset_class: formData.get("asset_class")?.toString() ?? "",
    stage: formData.get("stage")?.toString() ?? "",
    owner: formData.get("owner")?.toString() ?? "",
  });

  if (!payload.name || !payload.asset_class || !payload.owner) {
    return { error: "Name, asset class, and owner are required." };
  }

  let dealId: string;
  try {
    const deal = await createDeal(payload);
    dealId = deal.id;
  } catch (error) {
    return { error: describeDealWriteError(error).message };
  }

  const user = await getCurrentUser();
  if (user) await recordAuditLog(user, { dealId, action: "deal.created" });

  redirect(`/deals/${dealId}`);
}
