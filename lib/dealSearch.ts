export interface DealSearchItem {
  id?: string;
  name?: string;
  asset_class?: string;
  stage?: string;
  owner_name?: string;
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
      deal.owner_name,
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

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

/** Pure: 1-indexed page slice, clamped into [1, totalPages] so an out-of-range page (e.g. from a stale bookmark) doesn't return an empty page unnecessarily. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: clampedPage,
    totalPages,
    totalItems: items.length,
  };
}
