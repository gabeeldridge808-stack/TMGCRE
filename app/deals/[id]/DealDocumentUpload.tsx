"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UPLOADABLE_MIME_TYPES } from "@/lib/dealConstants";

interface UploadResult {
  filename: string;
  chunkCount: number;
  attributesAdded: string[];
  warning?: string;
}

// Matches Vercel's serverless request body limit — this upload goes through
// our own API route, not a direct-to-Blob client upload (see README).
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

export default function DealDocumentUpload({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

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
      <p style={{ color: "#999", fontSize: 13, marginTop: 4 }}>
        PDF, Word (.docx), or plain text. Max 4.5MB per file.
      </p>

      {status === "processing" && <p>Uploading and indexing…</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {results.length > 0 && (
        <ul style={{ marginTop: 8 }}>
          {results.map((r, i) => (
            <li key={i}>
              <strong>{r.filename}</strong>
              {r.warning ? (
                <span style={{ color: "#b06000" }}> — {r.warning}</span>
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
