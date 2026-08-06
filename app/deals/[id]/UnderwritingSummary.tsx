import { computeUnderwritingChecks } from "@/lib/underwriting";

export default function UnderwritingSummary({
  attributes,
}: {
  attributes: { key: string; value: unknown }[];
}) {
  const checks = computeUnderwritingChecks(attributes);
  if (checks.length === 0) return null;

  return (
    <div className="callout">
      <h3 style={{ marginBottom: 12 }}>
        Underwriting Check <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(computed, not stored)</span>
      </h3>
      <dl style={{ margin: 0, display: "grid", gap: 8 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ fontSize: 14 }}>
            <dt style={{ fontWeight: 600, display: "inline" }}>{c.label}: </dt>
            <dd style={{ display: "inline", margin: 0 }}>{c.value}</dd>
            {c.flag && <div className="flag-text">&#9888; {c.flag}</div>}
          </div>
        ))}
      </dl>
    </div>
  );
}
