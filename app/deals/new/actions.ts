"use server";

import { redirect } from "next/navigation";
import { buildDealPayload } from "@/lib/dealForm";
import { createDeal } from "@/lib/deals";

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

  const deal = await createDeal(payload);

  if (!deal) {
    return {
      error:
        "Couldn't save the deal — the database is unreachable. Check that DATABASE_URL is set and the database is running.",
    };
  }

  redirect(`/deals/${deal.id}`);
}
