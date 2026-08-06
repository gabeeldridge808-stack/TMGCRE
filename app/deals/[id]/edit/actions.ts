"use server";

import { redirect } from "next/navigation";
import { buildDealPayload } from "@/lib/dealForm";
import { updateDeal, describeDealWriteError } from "@/lib/deals";

export interface EditDealState {
  error?: string;
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

  redirect(`/deals/${dealId}`);
}
