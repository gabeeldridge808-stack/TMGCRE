import { describe, expect, it } from "vitest";
import { describeDealWriteError } from "@/lib/deals";

describe("describeDealWriteError", () => {
  it("reports a 400 with the valid values when a check constraint is violated", () => {
    const result = describeDealWriteError({ code: "23514" });

    expect(result.status).toBe(400);
    expect(result.message).toContain("multifamily");
    expect(result.message).toContain("sourcing");
  });

  it("falls back to a 503 unreachable message for anything else", () => {
    const result = describeDealWriteError({ code: "ENOTFOUND" });

    expect(result.status).toBe(503);
    expect(result.message).toContain("unreachable");
  });

  it("handles a non-object error without throwing", () => {
    const result = describeDealWriteError("some random string");

    expect(result.status).toBe(503);
  });
});
