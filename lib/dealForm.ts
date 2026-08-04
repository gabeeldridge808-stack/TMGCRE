export interface DealDraft {
  name: string;
  asset_class: string;
  stage?: string;
  owner: string;
}

export function buildDealPayload(input: DealDraft) {
  return {
    name: input.name.trim(),
    asset_class: input.asset_class.trim(),
    stage: input.stage?.trim() ? input.stage.trim() : "sourcing",
    owner: input.owner.trim(),
  };
}
