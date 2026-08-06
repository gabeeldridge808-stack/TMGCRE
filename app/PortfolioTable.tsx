"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { titleCase } from "@/lib/dealConstants";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

const actionButtonStyle = {
  padding: "4px 10px",
  border: "1px solid #d32f2f",
  borderRadius: 6,
  color: "#d32f2f",
  background: "none",
  cursor: "pointer",
  fontSize: 13,
} as const;

export default function PortfolioTable({ deals }: { deals: Deal[] }) {
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
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            background: "#fdf3f3",
            border: "1px solid #eecccc",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          <span>{selected.size} selected</span>
          <button onClick={deleteSelected} disabled={pending} style={actionButtonStyle}>
            {pending ? "Deleting…" : "Delete selected"}
          </button>
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: "8px 4px" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all deals" />
            </th>
            <th style={{ padding: "8px 4px" }}>Name</th>
            <th style={{ padding: "8px 4px" }}>Asset Class</th>
            <th style={{ padding: "8px 4px" }}>Stage</th>
            <th style={{ padding: "8px 4px" }}>Owner</th>
            <th style={{ padding: "8px 4px" }}></th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 4px" }}>
                <input
                  type="checkbox"
                  checked={selected.has(deal.id)}
                  onChange={() => toggleOne(deal.id)}
                  aria-label={`Select ${deal.name}`}
                />
              </td>
              <td style={{ padding: "8px 4px" }}>
                <Link href={`/deals/${deal.id}`}>{deal.name}</Link>
              </td>
              <td style={{ padding: "8px 4px" }}>{titleCase(deal.asset_class)}</td>
              <td style={{ padding: "8px 4px" }}>{titleCase(deal.stage)}</td>
              <td style={{ padding: "8px 4px" }}>{deal.owner}</td>
              <td style={{ padding: "8px 4px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={`/deals/${deal.id}/edit`} style={{ marginRight: 12, fontSize: 13 }}>
                  Edit
                </Link>
                <button onClick={() => deleteOne(deal.id, deal.name)} disabled={pending} style={actionButtonStyle}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
