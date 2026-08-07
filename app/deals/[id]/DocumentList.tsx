"use client";

import { useMemo, useState } from "react";

interface DocumentFile {
  source_filename: string;
  chunk_count: string;
  drive_file_id: string;
  document_type?: string | null;
  development_stage?: string | null;
}

export default function DocumentList({
  dealId,
  files,
  isDevelopment = false,
}: {
  dealId: string;
  files: DocumentFile[];
  isDevelopment?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [flagging, setFlagging] = useState<string | null>(null);

  const documentTypes = useMemo(
    () => [...new Set(files.map((f) => f.document_type).filter((t): t is string => Boolean(t)))],
    [files]
  );
  const visibleFiles = typeFilter ? files.filter((f) => f.document_type === typeFilter) : files;

  async function togglePreview(fileId: string) {
    if (open === fileId) {
      setOpen(null);
      return;
    }
    setOpen(fileId);
    if (!content[fileId]) {
      setLoading(fileId);
      const res = await fetch(`/api/deals/${dealId}/documents/preview?fileId=${encodeURIComponent(fileId)}`);
      const data = await res.json();
      setContent((prev) => ({ ...prev, [fileId]: res.ok ? data.content : "Failed to load preview." }));
      setLoading(null);
    }
  }

  // Section 3 of the development module: a document that references a
  // budget or timeline change creates a deal_milestones row for
  // reconciliation, rather than a flag with nowhere to go.
  async function flagChange(filename: string, category: "budget_change" | "schedule_change") {
    setFlagging(filename);
    const res = await fetch(`/api/deals/${dealId}/milestones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category,
        label: `${category === "budget_change" ? "Budget" : "Schedule"} change referenced in ${filename}`,
        source_document: filename,
        status: "pending",
      }),
    });
    setFlagging(null);
    if (res.ok) {
      alert("Flagged — see the Milestones list on the Development tab to reconcile.");
    } else {
      alert("Failed to flag this document.");
    }
  }

  return (
    <div>
      {isDevelopment && documentTypes.length > 0 && (
        <label style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          Filter by document type
          <select className="field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ marginTop: 4, maxWidth: 240 }}>
            <option value="">All types</option>
            {documentTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
        {visibleFiles.map((f) => (
          <li key={f.drive_file_id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>
                {f.source_filename} — {f.chunk_count} chunk(s)
                {f.document_type && (
                  <span className="text-faint"> · {f.document_type.replace(/_/g, " ")}</span>
                )}
                {f.development_stage && (
                  <span className="text-faint"> · {f.development_stage.replace(/_/g, " ")}</span>
                )}
              </span>
              <button onClick={() => togglePreview(f.drive_file_id)} className="btn btn-secondary btn-sm">
                {open === f.drive_file_id ? "Hide" : "Preview"}
              </button>
              {isDevelopment && (
                <>
                  <button
                    onClick={() => flagChange(f.source_filename, "budget_change")}
                    disabled={flagging === f.source_filename}
                    className="btn btn-secondary btn-sm"
                  >
                    Flag budget change
                  </button>
                  <button
                    onClick={() => flagChange(f.source_filename, "schedule_change")}
                    disabled={flagging === f.source_filename}
                    className="btn btn-secondary btn-sm"
                  >
                    Flag schedule change
                  </button>
                </>
              )}
            </div>
            {open === f.drive_file_id && (
              <div
                className="card"
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflowY: "auto",
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  color: "var(--color-text-muted)",
                }}
              >
                {loading === f.drive_file_id ? "Loading…" : content[f.drive_file_id]}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
