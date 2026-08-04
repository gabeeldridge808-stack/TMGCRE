import { describe, expect, it } from "vitest";
import { buildUserMessage } from "@/lib/agent";

describe("buildUserMessage", () => {
  const deal = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Harbor Point",
    asset_class: "multifamily",
    stage: "underwriting",
    owner: "Mina",
    attributes: [{ key: "unit_count", value: 212 }],
  };

  it("includes deal metadata, attributes, sources, and the question", () => {
    const message = buildUserMessage(
      deal,
      [
        {
          source_filename: "Rent_Roll_Mar2026.pdf",
          page_number: 3,
          content: "Occupancy is 94% as of March.",
          similarity: 0.87,
        },
      ],
      "what's the occupancy?"
    );

    expect(message).toContain("Harbor Point");
    expect(message).toContain("multifamily");
    expect(message).toContain("underwriting");
    expect(message).toContain("unit_count: 212");
    expect(message).toContain("Rent_Roll_Mar2026.pdf, p. 3");
    expect(message).toContain("Occupancy is 94% as of March.");
    expect(message).toContain("what's the occupancy?");
  });

  it("notes when there are no attributes or matched documents", () => {
    const message = buildUserMessage({ ...deal, attributes: [] }, [], "any red flags?");

    expect(message).toContain("(none recorded)");
    expect(message).toContain("no indexed documents matched");
  });
});
