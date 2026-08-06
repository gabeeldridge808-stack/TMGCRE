"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteDealButton({ dealId, dealName }: { dealId: string; dealName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${dealName}"? This permanently removes its documents, attributes, and chat history. This cannot be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to delete deal.");
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      aria-label={`Delete ${dealName}`}
      style={{
        padding: "4px 10px",
        border: "1px solid #d32f2f",
        borderRadius: 6,
        color: "#d32f2f",
        background: "none",
        cursor: pending ? "default" : "pointer",
        fontSize: 13,
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
