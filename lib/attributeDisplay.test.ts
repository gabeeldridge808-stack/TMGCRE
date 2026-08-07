import { describe, expect, it } from "vitest";
import { formatSource, groupAttributesForDisplay } from "@/lib/attributeDisplay";

describe("formatSource", () => {
  it("maps known source values to a short caption", () => {
    expect(formatSource("manual")).toBe("entered manually");
    expect(formatSource("chat agent")).toBe("confirmed via chat");
    expect(formatSource("Rent_Roll.pdf")).toBe("from Rent_Roll.pdf");
  });

  it("returns null for a missing source rather than an empty caption", () => {
    expect(formatSource(null)).toBeNull();
    expect(formatSource(undefined)).toBeNull();
    expect(formatSource("")).toBeNull();
  });
});

describe("groupAttributesForDisplay", () => {
  it("carries the source field through onto each display item", () => {
    const groups = groupAttributesForDisplay([{ key: "purchase_price", value: 1_000_000, source: "OM.pdf" }]);
    expect(groups[0].items[0].source).toBe("OM.pdf");
  });

  it("leaves source undefined when not provided, rather than throwing", () => {
    const groups = groupAttributesForDisplay([{ key: "purchase_price", value: 1_000_000 }]);
    expect(groups[0].items[0].source).toBeUndefined();
  });
});
