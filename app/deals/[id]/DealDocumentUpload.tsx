"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { UPLOADABLE_MIME_TYPES } from "@/lib/dealConstants";

interface UploadResult {
  filename: string;
  chunkCount: number;
  attributesAdded: string[];
  warning?: string;
}

export default function DealDocumentUpload({ dealId }: { dealId: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  async function handleFiles(files: FileList) {
    setError(null);

    for (const file of Array.from(files)) {
      try {
        setStatus("uploading");
        const blob = await upload(`deals/${dealId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: `/api/deals/${dealId}/documents/upload-url`,
        });

        setStatus("processing");
        const res = await fetch(`/api/deals/${dealId}/documents`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            blobUrl: blob.url,
            pathname: blob.pathname,
            filename: file.name,
            mimeType: file.type,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? `Failed to process ${file.name}`);
        }
        setResults((prev) => [data as UploadResult, ...prev]);
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
      <p style={{ color: "#999", fontSize: 13, marginTop: 4 }}>PDF, Word (.docx), or plain text.</p>

      {status === "uploading" && <p>Uploading…</p>}
      {status === "processing" && <p>Extracting and indexing…</p>}
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
