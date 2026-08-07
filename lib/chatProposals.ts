// Parses [[PROPOSAL:{...}]] markers (emitted by the chat route when the
// agent calls propose_attribute_update — see lib/agent.ts) out of a chat
// message's text so the UI can render an accept/reject card in place of
// the raw marker instead of showing it as literal text.
export interface AttributeProposal {
  key: string;
  value: unknown;
  reasoning: string;
}

export type MessageSegment = { type: "text"; content: string } | { type: "proposal"; proposal: AttributeProposal };

const PROPOSAL_REGEX = /\[\[PROPOSAL:(.*?)\]\]/gs;

function isAttributeProposal(value: unknown): value is AttributeProposal {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).key === "string" &&
    "value" in value &&
    typeof (value as Record<string, unknown>).reasoning === "string"
  );
}

/** Pure: splits message text into plain-text and proposal segments, in order. A malformed marker degrades to plain text rather than disappearing. */
export function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(PROPOSAL_REGEX)) {
    const fullMatch = match[0];
    const json = match[1];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: "text", content: content.slice(lastIndex, index) });
    }

    try {
      const parsed: unknown = JSON.parse(json);
      segments.push(isAttributeProposal(parsed) ? { type: "proposal", proposal: parsed } : { type: "text", content: fullMatch });
    } catch {
      segments.push({ type: "text", content: fullMatch });
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.slice(lastIndex) });
  }

  return segments;
}
