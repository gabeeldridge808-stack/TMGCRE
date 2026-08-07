import Link from "next/link";
import { queryOrThrow } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  ASSET_CLASSES,
  DEVELOPMENT_STAGES,
  DEVELOPMENT_STAGE_LABELS,
  DEVELOPMENT_STAGE_BADGE_VARIANT,
  titleCase,
  type DevelopmentStage,
} from "@/lib/dealConstants";
import { filterDealsByFacets } from "@/lib/dealSearch";
import Badge from "@/app/Badge";

export const dynamic = "force-dynamic";

interface DevelopmentDeal {
  id: string;
  name: string;
  asset_class: string;
  development_stage: string | null;
  owner_name: string;
  total_cost_basis: number | null;
  total_cost_actual: number | null;
  entitlement_risk: string | null;
  cost_overrun_risk: string | null;
  market_risk: string | null;
  projected_stabilization_date: string | null;
}

interface MilestoneRow {
  id: string;
  deal_id: string;
  deal_name: string;
  category: string;
  label: string;
  milestone_date: string | null;
  target_date: string | null;
  status: string;
}

const RISK_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

export default async function DevelopmentDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ asset_class?: string; development_stage?: string }>;
}) {
  const params = await searchParams;
  const assetClassFilter = params?.asset_class ?? "";
  const developmentStageFilter = params?.development_stage ?? "";

  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  let deals: DevelopmentDeal[] = [];
  let milestones: MilestoneRow[] = [];
  let loadError: string | null = null;
  try {
    if (!currentUser) throw new Error("not signed in");

    deals = await queryOrThrow<DevelopmentDeal>(
      isAdmin
        ? `select d.id, d.name, d.asset_class, d.development_stage, u.name as owner_name,
                  dd.total_cost_basis, dd.total_cost_actual, dd.entitlement_risk, dd.cost_overrun_risk,
                  dd.market_risk, dd.projected_stabilization_date
           from deals d
           join users u on u.id = d.owner_id
           left join deal_development_details dd on dd.deal_id = d.id
           where d.deal_category = 'development'
           order by d.created_at desc`
        : `select d.id, d.name, d.asset_class, d.development_stage, u.name as owner_name,
                  dd.total_cost_basis, dd.total_cost_actual, dd.entitlement_risk, dd.cost_overrun_risk,
                  dd.market_risk, dd.projected_stabilization_date
           from deals d
           join users u on u.id = d.owner_id
           left join deal_development_details dd on dd.deal_id = d.id
           where d.deal_category = 'development' and d.owner_id = $1
           order by d.created_at desc`,
      isAdmin ? [] : [currentUser.id]
    );

    milestones = await queryOrThrow<MilestoneRow>(
      isAdmin
        ? `select m.id, m.deal_id, d.name as deal_name, m.category, m.label, m.milestone_date, m.target_date, m.status
           from deal_milestones m
           join deals d on d.id = m.deal_id
           where d.deal_category = 'development'
           order by coalesce(m.target_date, m.milestone_date) nulls last, m.created_at`
        : `select m.id, m.deal_id, d.name as deal_name, m.category, m.label, m.milestone_date, m.target_date, m.status
           from deal_milestones m
           join deals d on d.id = m.deal_id
           where d.deal_category = 'development' and d.owner_id = $1
           order by coalesce(m.target_date, m.milestone_date) nulls last, m.created_at`,
      isAdmin ? [] : [currentUser.id]
    );
  } catch (error) {
    loadError =
      error instanceof Error && error.message === "not signed in"
        ? "You must be signed in to view the development dashboard."
        : "Couldn't load the development dashboard — the database is unreachable. This does not mean your deals are gone; check DATABASE_URL and try again.";
  }

  const filteredDeals = filterDealsByFacets(deals, { assetClass: assetClassFilter, developmentStage: developmentStageFilter });
  const filteredDealIds = new Set(filteredDeals.map((d) => d.id));
  const filteredMilestones = milestones.filter((m) => filteredDealIds.has(m.deal_id));

  const totalBasis = filteredDeals.reduce((sum, d) => sum + (d.total_cost_basis ?? 0), 0);
  const totalActual = filteredDeals.reduce((sum, d) => sum + (d.total_cost_actual ?? 0), 0);
  const totalVariance = totalActual - totalBasis;

  return (
    <main className="page">
      <h1 style={{ marginBottom: 24 }}>Development Dashboard</h1>

      {loadError ? (
        <p className="text-danger">{loadError}</p>
      ) : (
        <>
          <form method="get" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <select className="field" name="asset_class" defaultValue={assetClassFilter} style={{ width: "auto" }}>
              <option value="">All Asset Classes</option>
              {ASSET_CLASSES.map((ac) => (
                <option key={ac} value={ac}>
                  {titleCase(ac)}
                </option>
              ))}
            </select>
            <select className="field" name="development_stage" defaultValue={developmentStageFilter} style={{ width: "auto" }}>
              <option value="">All Stages</option>
              {DEVELOPMENT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {DEVELOPMENT_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">
              Filter
            </button>
          </form>

          {filteredDeals.length === 0 ? (
            <p className="text-muted">No development deals match this filter.</p>
          ) : (
            <>
              <h2>Budget Variance Rollup</h2>
              <table className="table" style={{ marginBottom: 32 }}>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Asset Class</th>
                    <th>Stage</th>
                    <th>Owner</th>
                    <th>Basis</th>
                    <th>Actual</th>
                    <th>Variance</th>
                    <th>Cost Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((d) => {
                    const variance = d.total_cost_basis !== null && d.total_cost_actual !== null ? d.total_cost_actual - d.total_cost_basis : null;
                    return (
                      <tr key={d.id}>
                        <td>
                          <Link href={`/deals/${d.id}`} style={{ fontWeight: 500, textDecoration: "none" }}>
                            {d.name}
                          </Link>
                        </td>
                        <td>
                          <Badge variant="neutral">{titleCase(d.asset_class)}</Badge>
                        </td>
                        <td>
                          {d.development_stage && (
                            <Badge variant={DEVELOPMENT_STAGE_BADGE_VARIANT[d.development_stage as DevelopmentStage]}>
                              {DEVELOPMENT_STAGE_LABELS[d.development_stage as DevelopmentStage]}
                            </Badge>
                          )}
                        </td>
                        <td className="text-muted">{d.owner_name}</td>
                        <td>{formatCurrency(d.total_cost_basis)}</td>
                        <td>{formatCurrency(d.total_cost_actual)}</td>
                        <td className={variance !== null && variance > 0 ? "text-danger" : undefined}>
                          {variance === null ? "—" : `${variance > 0 ? "+" : ""}${formatCurrency(variance)}`}
                        </td>
                        <td>{d.cost_overrun_risk && <Badge variant={RISK_VARIANT[d.cost_overrun_risk]}>{d.cost_overrun_risk}</Badge>}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan={4}>Total</td>
                    <td>{formatCurrency(totalBasis)}</td>
                    <td>{formatCurrency(totalActual)}</td>
                    <td className={totalVariance > 0 ? "text-danger" : undefined}>
                      {totalVariance > 0 ? "+" : ""}
                      {formatCurrency(totalVariance)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <h2>Timeline</h2>
              {filteredMilestones.length === 0 ? (
                <p className="text-muted">No milestones logged for these deals yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Deal</th>
                      <th>Category</th>
                      <th>Milestone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMilestones.map((m) => (
                      <tr key={m.id}>
                        <td>{m.milestone_date ?? m.target_date ?? "—"}</td>
                        <td>
                          <Link href={`/deals/${m.deal_id}`} style={{ textDecoration: "none" }}>
                            {m.deal_name}
                          </Link>
                        </td>
                        <td className="text-muted">{m.category.replace(/_/g, " ")}</td>
                        <td>{m.label}</td>
                        <td>
                          <Badge
                            variant={
                              m.status === "complete" ? "success" : m.status === "at_risk" ? "danger" : m.status === "delayed" ? "warning" : "neutral"
                            }
                          >
                            {m.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
