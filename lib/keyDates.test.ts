import { describe, expect, it } from "vitest";
import { buildKeyDates } from "@/lib/keyDates";

describe("buildKeyDates", () => {
  const today = new Date("2026-01-15T12:00:00Z");

  it("parses known date attributes and computes days until, sorted soonest first", () => {
    const entries = buildKeyDates(
      [
        { deal_id: "1", deal_name: "Deal A", key: "closing_date", value: "2026-02-14" },
        { deal_id: "2", deal_name: "Deal B", key: "rate_lock_date", value: "2026-01-20" },
      ],
      today
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].dealName).toBe("Deal B");
    expect(entries[0].daysUntil).toBe(5);
    expect(entries[1].dealName).toBe("Deal A");
    expect(entries[1].label).toBe("Closing");
  });

  it("reports a negative daysUntil for a date already past", () => {
    const entries = buildKeyDates([{ deal_id: "1", deal_name: "Deal A", key: "closing_date", value: "2026-01-10" }], today);
    expect(entries[0].daysUntil).toBe(-5);
  });

  it("skips unparseable or irrelevant values without throwing", () => {
    const entries = buildKeyDates(
      [
        { deal_id: "1", deal_name: "Deal A", key: "closing_date", value: "TBD" },
        { deal_id: "2", deal_name: "Deal B", key: "purchase_price", value: 1000000 },
      ],
      today
    );
    expect(entries).toEqual([]);
  });
});
