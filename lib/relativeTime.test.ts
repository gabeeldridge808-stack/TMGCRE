import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/relativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("formats a few seconds ago as just now", () => {
    expect(formatRelativeTime(new Date("2026-01-15T11:59:45Z"), now)).toBe("just now");
  });

  it("formats minutes, hours, and days ago", () => {
    expect(formatRelativeTime(new Date("2026-01-15T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(formatRelativeTime(new Date("2026-01-15T09:00:00Z"), now)).toBe("3 hours ago");
    expect(formatRelativeTime(new Date("2026-01-13T12:00:00Z"), now)).toBe("2 days ago");
  });

  it("formats future times", () => {
    expect(formatRelativeTime(new Date("2026-01-16T12:00:00Z"), now)).toBe("tomorrow");
  });
});
