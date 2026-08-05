import { computeUnderwritingChecks } from "@/lib/underwriting";

export default function UnderwritingSummary({
  attributes,
}: {
  attributes: { key: string; value: unknown }[];
}) {
  const checks = computeUnderwritingChecks(attributes);
  if (checks.length === 0) return null;

  return (
    <div style={{ marginTop: 20, marginBottom: 20, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h3 style={{ fontSize: 15, color: "#555", marginTop: 0, marginBottom: 10 }}>
        Underwriting Check <span style={{ fontWeight: 400, color: "#999" }}>(computed, not stored)</span>
      </h3>
      <dl style={{ margin: 0 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ marginBottom: 6 }}>
            <dt style={{ fontWeight: 600, display: "inline" }}>{c.label}: </dt>
            <dd style={{ display: "inline" }}>{c.value}</dd>
            {c.flag && (
              <div style={{ color: "#b06000", fontSize: 13, marginTop: 2 }}>&#9888; {c.flag}</div>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
