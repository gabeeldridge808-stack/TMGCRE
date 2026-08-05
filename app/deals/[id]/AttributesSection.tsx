import { groupAttributesForDisplay, formatScalar, isRowShaped, rowTableColumns } from "@/lib/attributeDisplay";

export default function AttributesSection({
  attributes,
}: {
  attributes: { key: string; value: unknown }[];
}) {
  if (attributes.length === 0) {
    return <p>No type-specific attributes recorded yet.</p>;
  }

  const groups = groupAttributesForDisplay(attributes);

  return (
    <>
      {groups.map((g) => (
        <div key={g.group} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, color: "#555", marginBottom: 6 }}>{g.group}</h3>
          <dl style={{ margin: 0 }}>
            {g.items.map((item) =>
              isRowShaped(item.value) ? (
                <div key={item.key} style={{ marginBottom: 10 }}>
                  <dt style={{ fontWeight: 600, marginBottom: 4 }}>{item.label}</dt>
                  <dd style={{ margin: 0, overflowX: "auto" }}>
                    <RowTable rows={item.value} />
                  </dd>
                </div>
              ) : (
                <div key={item.key} style={{ marginBottom: 4 }}>
                  <dt style={{ fontWeight: 600, display: "inline" }}>{item.label}: </dt>
                  <dd style={{ display: "inline" }}>{formatScalar(item.value, item.unit)}</dd>
                </div>
              )
            )}
          </dl>
        </div>
      ))}
    </>
  );
}

function RowTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = rowTableColumns(rows);
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c}
              style={{ textAlign: "left", padding: "4px 10px 4px 0", borderBottom: "1px solid #ddd", fontWeight: 600 }}
            >
              {c.replace(/_/g, " ")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c} style={{ padding: "4px 10px 4px 0", borderBottom: "1px solid #f0f0f0" }}>
                {formatScalar(row[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
