import { formatAuditAction } from "@/lib/auditLog";
import { formatRelativeTime } from "@/lib/relativeTime";

interface AuditLogRow {
  id: string;
  user_name: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

function detailsSummary(action: string, details: Record<string, unknown>): string | null {
  if (action === "document.uploaded" && typeof details.filename === "string") {
    return details.filename as string;
  }
  if (action === "comps.imported" && typeof details.count === "number") {
    return `${details.count} row(s)`;
  }
  if (action === "comps.deleted" && typeof details.property_name === "string") {
    return details.property_name;
  }
  if (action === "deal.deleted" && typeof details.name === "string") {
    return details.name;
  }
  return null;
}

export default function AuditLogSection({ entries }: { entries: AuditLogRow[] }) {
  if (entries.length === 0) {
    return <p className="text-muted">No activity recorded yet.</p>;
  }

  return (
    <div className="card">
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {entries.map((entry) => {
          const summary = detailsSummary(entry.action, entry.details);
          return (
            <li
              key={entry.id}
              style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)", fontSize: 14 }}
            >
              <span style={{ fontWeight: 600 }}>{entry.user_name}</span> {formatAuditAction(entry.action)}
              {summary && <span className="text-muted"> — {summary}</span>}
              <div className="text-faint">{formatRelativeTime(new Date(entry.created_at))}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
