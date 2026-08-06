import { describe, expect, it } from "vitest";
import { titleCase } from "@/lib/dealConstants";

describe("titleCase", () => {
  it("capitalizes a single word", () => {
    expect(titleCase("multifamily")).toBe("Multifamily");
    expect(titleCase("sourcing")).toBe("Sourcing");
  });

  it("capitalizes each word of an underscore-separated value", () => {
    expect(titleCase("modified_gross")).toBe("Modified Gross");
    expect(titleCase("under_construction")).toBe("Under Construction");
  });
});
