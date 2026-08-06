"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function DealChat({ dealId }: { dealId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
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
      const res = await fetch(`/api/deals/${dealId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history }),
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
        Grounded in this deal&apos;s recorded attributes and indexed documents.
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
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                {m.content || (loading && i === messages.length - 1 ? "…" : "")}
              </div>
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
