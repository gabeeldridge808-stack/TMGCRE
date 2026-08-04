import { describe, expect, it } from "vitest";
import { describeCreateDealError } from "@/lib/deals";

describe("describeCreateDealError", () => {
  it("reports a 400 with the valid values when a check constraint is violated", () => {
    const result = describeCreateDealError({ code: "23514" });

    expect(result.status).toBe(400);
    expect(result.message).toContain("multifamily");
    expect(result.message).toContain("sourcing");
  });

  it("falls back to a 503 unreachable message for anything else", () => {
    const result = describeCreateDealError({ code: "ENOTFOUND" });

    expect(result.status).toBe(503);
    expect(result.message).toContain("unreachable");
  });

  it("handles a non-object error without throwing", () => {
    const result = describeCreateDealError("some random string");

    expect(result.status).toBe(503);
  });
});
