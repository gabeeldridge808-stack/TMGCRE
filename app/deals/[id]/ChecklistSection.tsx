"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { titleCase } from "@/lib/dealConstants";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export default function ChecklistSection({
  dealId,
  stage,
  items,
}: {
  dealId: string;
  stage: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-muted">No checklist items for the {titleCase(stage)} stage.</p>;
  }

  const doneCount = items.filter((i) => i.done).length;

  async function toggle(itemId: string, done: boolean) {
    setPending(itemId);
    const res = await fetch(`/api/deals/${dealId}/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done }),
    });
    setPending(null);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to update checklist item.");
    }
  }

  return (
    <div className="card">
      <h3>
        {titleCase(stage)} Checklist{" "}
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
          ({doneCount}/{items.length})
        </span>
      </h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((item) => (
          <li key={item.id} style={{ padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={item.done}
              disabled={pending === item.id}
              onChange={(e) => toggle(item.id, e.target.checked)}
              id={`checklist-${item.id}`}
            />
            <label
              htmlFor={`checklist-${item.id}`}
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: item.done ? "var(--color-text-faint)" : "var(--color-text)",
                textDecoration: item.done ? "line-through" : "none",
              }}
            >
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
