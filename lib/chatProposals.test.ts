import { describe, expect, it } from "vitest";
import { parseMessageSegments } from "@/lib/chatProposals";

describe("parseMessageSegments", () => {
  it("returns a single text segment when there's no proposal marker", () => {
    const segments = parseMessageSegments("Occupancy is 94% as of March.");
    expect(segments).toEqual([{ type: "text", content: "Occupancy is 94% as of March." }]);
  });

  it("extracts a proposal marker into its own segment, surrounding text preserved", () => {
    const proposal = { key: "purchase_price", value: 2_000_000, reasoning: "The OM states this on page 3." };
    const content = `Here's what I found.\n\n[[PROPOSAL:${JSON.stringify(proposal)}]]\n\nLet me know if you want more detail.`;

    const segments = parseMessageSegments(content);

    expect(segments).toEqual([
      { type: "text", content: "Here's what I found.\n\n" },
      { type: "proposal", proposal },
      { type: "text", content: "\n\nLet me know if you want more detail." },
    ]);
  });

  it("handles multiple proposals in one message", () => {
    const p1 = { key: "purchase_price", value: 2_000_000, reasoning: "a" };
    const p2 = { key: "noi", value: 150_000, reasoning: "b" };
    const content = `[[PROPOSAL:${JSON.stringify(p1)}]] and [[PROPOSAL:${JSON.stringify(p2)}]]`;

    const segments = parseMessageSegments(content);

    expect(segments.filter((s) => s.type === "proposal")).toHaveLength(2);
  });

  it("degrades a malformed proposal marker to plain text instead of dropping it", () => {
    const segments = parseMessageSegments("Before [[PROPOSAL:{not valid json}]] after");
    expect(segments).toEqual([
      { type: "text", content: "Before " },
      { type: "text", content: "[[PROPOSAL:{not valid json}]]" },
      { type: "text", content: " after" },
    ]);
  });

  it("degrades a well-formed JSON object missing required fields to plain text", () => {
    const content = `[[PROPOSAL:${JSON.stringify({ key: "purchase_price" })}]]`;
    const segments = parseMessageSegments(content);
    expect(segments).toEqual([{ type: "text", content }]);
  });
});
