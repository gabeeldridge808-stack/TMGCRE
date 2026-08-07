import { groupAttributesForDisplay, formatScalar, formatSource, isRowShaped, rowTableColumns } from "@/lib/attributeDisplay";

export default function AttributesSection({
  attributes,
}: {
  attributes: { key: string; value: unknown; source?: string | null }[];
}) {
  if (attributes.length === 0) {
    return <p className="text-muted">No type-specific attributes recorded yet.</p>;
  }

  const groups = groupAttributesForDisplay(attributes);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {groups.map((g) => (
        <div key={g.group} className="card">
          <h3>{g.group}</h3>
          <dl style={{ margin: 0, display: "grid", gap: 6 }}>
            {g.items.map((item) =>
              isRowShaped(item.value) ? (
                <div key={item.key}>
                  <dt style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{item.label}</dt>
                  <dd style={{ margin: 0, overflowX: "auto" }}>
                    <RowTable rows={item.value} />
                  </dd>
                </div>
              ) : (
                <div key={item.key} style={{ fontSize: 14 }}>
                  <dt style={{ fontWeight: 600, display: "inline" }}>{item.label}: </dt>
                  <dd style={{ display: "inline", margin: 0 }}>{formatScalar(item.value, item.unit)}</dd>
                  {formatSource(item.source) && (
                    <span className="text-faint" style={{ marginLeft: 6 }}>
                      ({formatSource(item.source)})
                    </span>
                  )}
                </div>
              )
            )}
          </dl>
        </div>
      ))}
    </div>
  );
}

function RowTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = rowTableColumns(rows);
  return (
    <table className="table table-compact">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c.replace(/_/g, " ")}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c}>{formatScalar(row[c])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
