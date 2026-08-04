"use server";

import { redirect } from "next/navigation";
import { buildDealPayload } from "@/lib/dealForm";
import { createDeal, describeCreateDealError } from "@/lib/deals";

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
    return { error: describeCreateDealError(error).message };
  }

  redirect(`/deals/${dealId}`);
}
