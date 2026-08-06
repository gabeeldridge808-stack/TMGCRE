import Link from "next/link";
import { buildKeyDates, type DateAttributeRow } from "@/lib/keyDates";

export default function KeyDatesWidget({ rows }: { rows: DateAttributeRow[] }) {
  const entries = buildKeyDates(rows).filter((e) => e.daysUntil <= 60);
  if (entries.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3>Key Dates</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {entries.slice(0, 8).map((entry, i) => {
          const urgent = entry.daysUntil <= 7;
          const soon = entry.daysUntil <= 30;
          const color = urgent ? "var(--color-danger)" : soon ? "var(--color-warning)" : "var(--color-text-muted)";
          return (
            <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
              <span>
                <Link href={`/deals/${entry.dealId}`} style={{ fontWeight: 500 }}>
                  {entry.dealName}
                </Link>
                <span className="text-muted"> — {entry.label}</span>
              </span>
              <span style={{ color, fontWeight: 600 }}>
                {entry.daysUntil < 0
                  ? `${Math.abs(entry.daysUntil)}d overdue`
                  : entry.daysUntil === 0
                    ? "today"
                    : `in ${entry.daysUntil}d`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
