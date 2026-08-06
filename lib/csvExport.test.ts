import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csvExport";

describe("toCsv", () => {
  it("produces a header row and quotes fields containing commas", () => {
    const csv = toCsv([{ name: "Harbor Point, LLC", price: 1000000 }]);
    expect(csv).toContain("name,price");
    expect(csv).toContain('"Harbor Point, LLC",1000000');
  });

  it("returns just a header for an empty array with no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
