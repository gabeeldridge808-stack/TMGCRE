import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, capToCharBudget } from "@/lib/extractAttributes";

describe("buildExtractionPrompt", () => {
  it("lists already-recorded keys and includes every document", () => {
    const prompt = buildExtractionPrompt(
      "multifamily",
      ["unit_count", "owner"],
      [{ filename: "OM.pdf", text: "212 units, built 1998." }]
    );

    expect(prompt).toContain("multifamily");
    expect(prompt).toContain("unit_count, owner");
    expect(prompt).toContain("--- OM.pdf ---");
    expect(prompt).toContain("212 units, built 1998.");
  });

  it("says nothing is recorded yet when there are no existing keys", () => {
    const prompt = buildExtractionPrompt("land", [], []);
    expect(prompt).toContain("Nothing has been recorded for this deal yet.");
  });
});

describe("capToCharBudget", () => {
  it("passes documents through unchanged when under budget", () => {
    const docs = [{ filename: "a.pdf", text: "short" }];
    expect(capToCharBudget(docs, 1000)).toEqual(docs);
  });

  it("truncates a document that exceeds the remaining budget and drops the rest", () => {
    const docs = [
      { filename: "a.pdf", text: "0123456789" },
      { filename: "b.pdf", text: "should be dropped entirely" },
    ];

    const result = capToCharBudget(docs, 5);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("a.pdf");
    expect(result[0].text).toBe("01234\n[...truncated...]");
  });
});
