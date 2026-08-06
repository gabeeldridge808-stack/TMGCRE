"use client";

import { useState } from "react";

interface DocumentFile {
  source_filename: string;
  chunk_count: string;
  drive_file_id: string;
}

export default function DocumentList({ dealId, files }: { dealId: string; files: DocumentFile[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

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

  return (
    <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
      {files.map((f) => (
        <li key={f.drive_file_id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>
              {f.source_filename} — {f.chunk_count} chunk(s)
            </span>
            <button onClick={() => togglePreview(f.drive_file_id)} className="btn btn-secondary btn-sm">
              {open === f.drive_file_id ? "Hide" : "Preview"}
            </button>
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
  );
}
