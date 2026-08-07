export interface DealDraft {
  name: string;
  asset_class: string;
  stage?: string;
  owner_id: string;
  deal_category?: string;
  development_stage?: string;
}

export function buildDealPayload(input: DealDraft) {
  const dealCategory = input.deal_category?.trim() ? input.deal_category.trim() : "acquisition";
  return {
    name: input.name.trim(),
    asset_class: input.asset_class.trim(),
    stage: input.stage?.trim() ? input.stage.trim() : "sourcing",
    owner_id: input.owner_id.trim(),
    deal_category: dealCategory,
    // Only a development deal carries a development_stage -- an acquisition
    // deal's value is dropped here rather than left for the DB constraint
    // to reject, since a stray value surviving a category switch (dev ->
    // acquisition) shouldn't turn into a confusing 400 on save.
    development_stage: dealCategory === "development" && input.development_stage?.trim() ? input.development_stage.trim() : null,
  };
}
