"use client";

import { useState } from "react";

export default function IcMemoTool({ dealId }: { dealId: string }) {
  const [memoText, setMemoText] = useState("");
  const [status, setStatus] = useState<"idle" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setStatus("generating");
    setError(null);
    setMemoText("");
    try {
      const res = await fetch(`/api/deals/${dealId}/memo`, { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMemoText(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate memo.");
    } finally {
      setStatus("idle");
    }
  }

  async function downloadDocx() {
    const res = await fetch(`/api/deals/${dealId}/memo/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoText }),
    });
    if (!res.ok) {
      alert("Failed to export memo.");
      return;
    }
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="(.+)"/);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = match ? match[1] : "IC-Memo.docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <h3>Investment Committee Memo</h3>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Drafted from this deal&rsquo;s recorded attributes, pro forma underwriting, and imported comps.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={generate} disabled={status === "generating"} className="btn btn-primary">
          {status === "generating" ? "Drafting…" : memoText ? "Regenerate" : "Generate Memo"}
        </button>
        {memoText && status !== "generating" && (
          <button onClick={downloadDocx} className="btn btn-secondary">
            Download as Word
          </button>
        )}
      </div>
      {error && <p className="text-danger">{error}</p>}
      {memoText && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 14,
            lineHeight: 1.6,
            maxHeight: 600,
            overflowY: "auto",
            padding: 16,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {memoText}
        </div>
      )}
    </div>
  );
}
