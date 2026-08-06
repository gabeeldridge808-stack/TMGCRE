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

/** Exact-match filters, applied in addition to (not instead of) the free-text search. */
export function filterDealsByFacets<T extends DealSearchItem>(
  deals: T[],
  facets: { assetClass?: string; stage?: string }
): T[] {
  return deals.filter((deal) => {
    if (facets.assetClass && deal.asset_class !== facets.assetClass) return false;
    if (facets.stage && deal.stage !== facets.stage) return false;
    return true;
  });
}
