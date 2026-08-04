export interface DealSearchItem {
  id?: string;
  name?: string;
  asset_class?: string;
  stage?: string;
  owner?: string;
}

export function filterDealsByQuery<T extends DealSearchItem>(
  deals: T[],
  search: string
): T[] {
  const term = search.trim().toLowerCase();

  if (!term) {
    return deals;
  }

  return deals.filter((deal) => {
    const haystack = [
      deal.name,
      deal.asset_class,
      deal.stage,
      deal.owner,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}
