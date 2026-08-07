"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { titleCase, STAGE_BADGE_VARIANT, type Stage } from "@/lib/dealConstants";
import Badge from "@/app/Badge";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner_name: string;
}

export default function PortfolioTable({ deals, isAdmin }: { deals: Deal[]; isAdmin: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const allSelected = deals.length > 0 && selected.size === deals.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deals.map((d) => d.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteOne(id: string, name: string) {
    if (
      !window.confirm(
        `Delete "${name}"? This permanently removes its documents, attributes, and chat history. This cannot be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    } else {
      alert("Failed to delete deal.");
    }
  }

  async function deleteSelected() {
    const count = selected.size;
    if (
      !window.confirm(
        `Delete ${count} selected deal${count === 1 ? "" : "s"}? This permanently removes their documents, attributes, and chat history. This cannot be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    const results = await Promise.all(
      Array.from(selected).map((id) => fetch(`/api/deals/${id}`, { method: "DELETE" }))
    );
    setPending(false);
    const failedCount = results.filter((r) => !r.ok).length;
    setSelected(new Set());
    router.refresh();
    if (failedCount > 0) {
      alert(`${failedCount} deal(s) failed to delete.`);
    }
  }

  return (
    <div>
      {isAdmin && selected.size > 0 && (
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            marginBottom: 12,
            background: "var(--color-accent-bg)",
            borderColor: "var(--color-accent-bg)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>{selected.size} selected</span>
          <button onClick={deleteSelected} disabled={pending} className="btn btn-danger btn-sm">
            {pending ? "Deleting…" : "Delete selected"}
          </button>
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            {isAdmin && (
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all deals" />
              </th>
            )}
            <th>Name</th>
            <th>Asset Class</th>
            <th>Stage</th>
            <th>Owner</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              {isAdmin && (
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(deal.id)}
                    onChange={() => toggleOne(deal.id)}
                    aria-label={`Select ${deal.name}`}
                  />
                </td>
              )}
              <td>
                <Link href={`/deals/${deal.id}`} style={{ fontWeight: 500, textDecoration: "none" }}>
                  {deal.name}
                </Link>
              </td>
              <td>
                <Badge variant="neutral">{titleCase(deal.asset_class)}</Badge>
              </td>
              <td>
                <Badge variant={STAGE_BADGE_VARIANT[deal.stage as Stage] ?? "neutral"}>{titleCase(deal.stage)}</Badge>
              </td>
              <td className="text-muted">{deal.owner_name}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={`/deals/${deal.id}/edit`} className="btn btn-secondary btn-sm" style={{ marginRight: 8 }}>
                  Edit
                </Link>
                {isAdmin && (
                  <button onClick={() => deleteOne(deal.id, deal.name)} disabled={pending} className="btn btn-danger btn-sm">
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
