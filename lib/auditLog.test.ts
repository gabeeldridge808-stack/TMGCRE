import { describe, expect, it } from "vitest";
import { formatAuditAction } from "@/lib/auditLog";

describe("formatAuditAction", () => {
  it("maps known actions to a human-readable label", () => {
    expect(formatAuditAction("deal.created")).toBe("created this deal");
    expect(formatAuditAction("comps.imported")).toBe("imported comps");
  });

  it("falls back to the raw string for an unknown action", () => {
    expect(formatAuditAction("something.new")).toBe("something.new");
  });
});
