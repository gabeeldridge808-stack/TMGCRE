"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseMessageSegments, type AttributeProposal } from "@/lib/chatProposals";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function DealChat({
  dealId,
  initialMessages = [],
  fieldLabels = {},
}: {
  dealId: string;
  initialMessages?: Message[];
  /** key -> human label (e.g. purchase_price -> "Purchase Price"), passed as plain data from the server
   *  rather than importing lib/attributeSchemas.ts here — that module pulls in Zod and every asset
   *  class's schema, which has no business being in this client bundle just to render a label. */
  fieldLabels?: Record<string, string>;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;

    const history = messages;
    const withQuestion: Message[] = [...history, { role: "user", content: question }];

    setError(null);
    setInput("");
    setLoading(true);
    setMessages([...withQuestion, { role: "assistant", content: "" }]);

    try {
      // History isn't sent — the server reads it from chat_messages, so
      // this stays correct even if someone else added a message to this
      // deal's conversation since the page loaded.
      const res = await fetch(`/api/deals/${dealId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...withQuestion, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages(history);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Ask the deal</h2>
      <p className="text-muted" style={{ marginTop: -8, marginBottom: 16, fontSize: 14 }}>
        Grounded in this deal&apos;s recorded attributes and indexed documents. Conversation is saved with the deal.
      </p>

      <div
        className="card"
        style={{
          minHeight: 80,
          maxHeight: 480,
          overflowY: "auto",
          marginBottom: 12,
        }}
      >
        {messages.length === 0 ? (
          <p className="text-faint" style={{ margin: 0 }}>
            No questions yet. Try &quot;what are the key risks in this deal?&quot;
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13, color: "var(--color-text-muted)" }}>
                {m.role === "user" ? "You" : "Analyst"}
              </div>
              {m.role === "assistant" ? (
                <MessageBody
                  content={m.content}
                  dealId={dealId}
                  fieldLabels={fieldLabels}
                  loading={loading && i === messages.length - 1}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.content}</div>
              )}
            </div>
          ))
        )}
      </div>

      {error && <p className="text-danger">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this deal's underwriting, risks, terms..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary">
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}

function MessageBody({
  content,
  dealId,
  fieldLabels,
  loading,
}: {
  content: string;
  dealId: string;
  fieldLabels: Record<string, string>;
  loading: boolean;
}) {
  if (!content) {
    return <div style={{ fontSize: 14 }}>{loading ? "…" : ""}</div>;
  }

  const segments = parseMessageSegments(content);

  return (
    <div style={{ fontSize: 14 }}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {seg.content}
          </span>
        ) : (
          <ProposalCard key={i} dealId={dealId} proposal={seg.proposal} label={fieldLabels[seg.proposal.key]} />
        )
      )}
    </div>
  );
}

function ProposalCard({
  dealId,
  proposal,
  label,
}: {
  dealId: string;
  proposal: AttributeProposal;
  label?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "saving" | "saved" | "rejected">("pending");
  const displayLabel = label ?? proposal.key;
  const displayValue = typeof proposal.value === "object" ? JSON.stringify(proposal.value) : String(proposal.value);

  async function accept() {
    setStatus("saving");
    const res = await fetch(`/api/deals/${dealId}/attributes/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(proposal),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("pending");
      alert("Failed to save this attribute.");
    }
  }

  return (
    <div
      className="card"
      style={{
        display: "block",
        whiteSpace: "normal",
        margin: "8px 0",
        padding: 12,
        background: "var(--color-accent-bg)",
        borderColor: "var(--color-accent-bg)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
        Proposed: set {displayLabel} to {displayValue}
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
        {proposal.reasoning}
      </div>
      {status === "pending" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={accept} className="btn btn-primary btn-sm">
            Accept
          </button>
          <button onClick={() => setStatus("rejected")} className="btn btn-secondary btn-sm">
            Reject
          </button>
        </div>
      )}
      {status === "saving" && <span className="text-faint">Saving…</span>}
      {status === "saved" && <span style={{ color: "var(--color-success)", fontSize: 13 }}>Saved to attributes</span>}
      {status === "rejected" && <span className="text-faint">Rejected</span>}
    </div>
  );
}
