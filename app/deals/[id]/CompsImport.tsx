"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMP_FIELDS, coerceRowsToComps, guessColumnMapping, parseCsv, type NormalizedComp } from "@/lib/compsImport";

export default function CompsImport({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<"idle" | "importing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  function handleFile(file: File) {
    setError(null);
    setImportedCount(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      if (h.length === 0 || r.length === 0) {
        setError("Couldn't find any rows in that file — check it's a CSV export.");
        return;
      }
      setHeaders(h);
      setRows(r);
      setMapping(guessColumnMapping(h));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rows) return;
    setStatus("importing");
    setError(null);
    const comps: NormalizedComp[] = coerceRowsToComps(rows, mapping);
    try {
      const res = await fetch(`/api/deals/${dealId}/comps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to import comps.");
      setImportedCount(data.inserted);
      setHeaders(null);
      setRows(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import comps.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3>Import Comps from CSV</h3>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Export your comps search results to CSV (e.g. from CoStar) and upload the file here — this parses a
        file you already have access to, no automated scraping.
      </p>

      {!headers && (
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      )}

      {error && (
        <p className="text-danger" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      {importedCount !== null && (
        <p style={{ color: "var(--color-success)", marginTop: 8 }}>Imported {importedCount} comp(s).</p>
      )}

      {headers && rows && (
        <div style={{ marginTop: 16 }}>
          <p className="text-muted" style={{ fontSize: 13 }}>
            {rows.length} row(s) found. Confirm how each column maps — adjust any that guessed wrong.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>CSV Column</th>
                  <th>Maps To</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h}>
                    <td>{h}</td>
                    <td>
                      <select
                        className="field"
                        value={mapping[h] ?? ""}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value || null }))}
                        style={{ width: "auto" }}
                      >
                        <option value="">Ignore</option>
                        {COMP_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-faint">{rows[0]?.[h] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleImport} disabled={status === "importing"} className="btn btn-primary">
              {status === "importing" ? "Importing…" : `Import ${rows.length} comp(s)`}
            </button>
            <button
              onClick={() => {
                setHeaders(null);
                setRows(null);
                setError(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
