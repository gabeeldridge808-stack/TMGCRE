"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UPLOADABLE_MIME_TYPES, DEVELOPMENT_STAGES, DEVELOPMENT_STAGE_LABELS } from "@/lib/dealConstants";

interface UploadResult {
  filename: string;
  chunkCount: number;
  attributesAdded: string[];
  warning?: string;
}

const DOCUMENT_TYPES = [
  "entitlement",
  "gc_contract",
  "franchise_agreement",
  "psa",
  "cost_report",
  "lease",
  "financing_memo",
  "other",
];

// Matches Vercel's serverless request body limit — this upload goes through
// our own API route, not a direct-to-Blob client upload (see README).
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

export default function DealDocumentUpload({ dealId, isDevelopment = false }: { dealId: string; isDevelopment?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [developmentStage, setDevelopmentStage] = useState("");

  async function handleFiles(files: FileList) {
    setError(null);

    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — the upload limit is 4.5MB. For bigger files, use the Google Drive bulk-ingest path (see below).`
        );
        continue;
      }

      try {
        setStatus("processing");
        const formData = new FormData();
        formData.append("file", file);
        if (documentType) formData.append("document_type", documentType);
        if (developmentStage) formData.append("development_stage", developmentStage);

        const res = await fetch(`/api/deals/${dealId}/documents`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? `Failed to process ${file.name}`);
        }
        setResults((prev) => [data as UploadResult, ...prev]);
        // Re-fetch the server-rendered document list + attributes below —
        // this component's own state (the results list above) is untouched.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
      }
    }

    setStatus("idle");
  }

  return (
    <div>
      {isDevelopment && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>
            Document Type
            <select className="field" value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ marginTop: 4 }}>
              <option value="">—</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Development Stage
            <select
              className="field"
              value={developmentStage}
              onChange={(e) => setDevelopmentStage(e.target.value)}
              style={{ marginTop: 4 }}
            >
              <option value="">—</option>
              {DEVELOPMENT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {DEVELOPMENT_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <input
        type="file"
        multiple
        accept={UPLOADABLE_MIME_TYPES.join(",")}
        disabled={status !== "idle"}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />
      <p className="text-faint" style={{ marginTop: 4 }}>
        PDF, Word (.docx), or plain text. Max 4.5MB per file.
      </p>

      {status === "processing" && <p className="text-muted">Uploading and indexing…</p>}
      {error && <p className="text-danger">{error}</p>}

      {results.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          {results.map((r, i) => (
            <li key={i}>
              <strong>{r.filename}</strong>
              {r.warning ? (
                <span style={{ color: "var(--color-warning)" }}> — {r.warning}</span>
              ) : (
                <>
                  {" "}
                  — {r.chunkCount} chunk(s) indexed
                  {r.attributesAdded.length > 0 &&
                    `, ${r.attributesAdded.length} attribute(s) added (${r.attributesAdded.join(", ")})`}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
