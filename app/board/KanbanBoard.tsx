"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STAGES, titleCase, STAGE_BADGE_VARIANT, type Stage } from "@/lib/dealConstants";
import Badge from "@/app/Badge";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

export default function KanbanBoard({ deals: initialDeals }: { deals: Deal[] }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  async function moveDeal(dealId: string, newStage: string) {
    const prev = deals;
    setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    if (!res.ok) {
      setDeals(prev);
      alert("Failed to move deal.");
    } else {
      router.refresh();
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16 }}>
      {STAGES.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage);
            }}
            onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStage(null);
              if (dragging) moveDeal(dragging, stage);
            }}
            style={{
              flex: "0 0 260px",
              background: dragOverStage === stage ? "var(--color-accent-bg)" : "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              padding: 12,
              minHeight: 420,
              transition: "background-color 0.12s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Badge variant={STAGE_BADGE_VARIANT[stage as Stage]}>{titleCase(stage)}</Badge>
              <span className="text-faint">{stageDeals.length}</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {stageDeals.map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => setDragging(deal.id)}
                  onDragEnd={() => setDragging(null)}
                  className="card"
                  style={{ padding: 10, cursor: "grab" }}
                >
                  <Link
                    href={`/deals/${deal.id}`}
                    style={{ fontWeight: 500, fontSize: 14, textDecoration: "none", display: "block", marginBottom: 6 }}
                  >
                    {deal.name}
                  </Link>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Badge variant="neutral">{titleCase(deal.asset_class)}</Badge>
                    <span className="text-faint">{deal.owner}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
