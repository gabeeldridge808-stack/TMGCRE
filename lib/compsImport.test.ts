import { describe, expect, it } from "vitest";
import { coerceRowsToComps, guessColumnMapping, parseCsv, parseDate, parseNumeric } from "@/lib/compsImport";

describe("parseCsv", () => {
  it("parses headers and rows, including quoted fields with embedded commas", () => {
    const csv = `Property Name,Address,Sale Price\n"Oak Tower","123 Main St, Suite 100","$1,250,000"`;
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["Property Name", "Address", "Sale Price"]);
    expect(rows).toEqual([
      { "Property Name": "Oak Tower", Address: "123 Main St, Suite 100", "Sale Price": "$1,250,000" },
    ]);
  });
});

describe("guessColumnMapping", () => {
  it("maps common comp export headers to the right field", () => {
    const mapping = guessColumnMapping([
      "Property Name",
      "Property Address",
      "City",
      "State",
      "Sale Date",
      "Sale Price",
      "Price/SF",
      "Price/Unit",
      "Cap Rate",
      "Building SF",
      "Units",
      "Year Built",
      "Buyer Name",
      "Seller Name",
      "Secondary Type",
    ]);

    expect(mapping["Property Name"]).toBe("property_name");
    expect(mapping["Property Address"]).toBe("address");
    expect(mapping["City"]).toBe("city");
    expect(mapping["State"]).toBe("state");
    expect(mapping["Sale Date"]).toBe("sale_date");
    expect(mapping["Sale Price"]).toBe("sale_price");
    expect(mapping["Price/SF"]).toBe("price_per_sqft");
    expect(mapping["Price/Unit"]).toBe("price_per_unit");
    expect(mapping["Cap Rate"]).toBe("cap_rate");
    expect(mapping["Building SF"]).toBe("building_sqft");
    expect(mapping["Units"]).toBe("unit_count");
    expect(mapping["Year Built"]).toBe("year_built");
    expect(mapping["Buyer Name"]).toBe("buyer");
    expect(mapping["Seller Name"]).toBe("seller");
    expect(mapping["Secondary Type"]).toBe("asset_class");
  });

  it("does not let generic 'price' claim price/SF or price/unit columns", () => {
    const mapping = guessColumnMapping(["Price/SF", "Price/Unit", "Price"]);
    expect(mapping["Price/SF"]).toBe("price_per_sqft");
    expect(mapping["Price/Unit"]).toBe("price_per_unit");
    expect(mapping["Price"]).toBe("sale_price");
  });

  it("returns null for a header with no confident match", () => {
    const mapping = guessColumnMapping(["Days on Market", "Notes"]);
    expect(mapping["Days on Market"]).toBeNull();
    expect(mapping["Notes"]).toBeNull();
  });
});

describe("parseNumeric", () => {
  it("strips currency, commas, and percent signs", () => {
    expect(parseNumeric("$1,250,000")).toBe(1250000);
    expect(parseNumeric("6.5%")).toBe(6.5);
    expect(parseNumeric("212")).toBe(212);
  });

  it("returns undefined for unparseable input", () => {
    expect(parseNumeric("")).toBeUndefined();
    expect(parseNumeric("N/A")).toBeUndefined();
  });
});

describe("parseDate", () => {
  it("parses common date formats to ISO", () => {
    expect(parseDate("1/15/2024")).toBe("2024-01-15");
    expect(parseDate("2024-01-15")).toBe("2024-01-15");
  });

  it("returns undefined for unparseable input", () => {
    expect(parseDate("")).toBeUndefined();
    expect(parseDate("not a date")).toBeUndefined();
  });
});

describe("coerceRowsToComps", () => {
  it("applies the mapping, coerces types, and keeps unmapped columns in extra", () => {
    const rows = [
      {
        "Property Name": "Oak Tower",
        "Sale Price": "$1,250,000",
        "Cap Rate": "6.5%",
        "Sale Date": "1/15/2024",
        "Days on Market": "45",
      },
    ];
    const mapping = {
      "Property Name": "property_name",
      "Sale Price": "sale_price",
      "Cap Rate": "cap_rate",
      "Sale Date": "sale_date",
      "Days on Market": null,
    };

    const comps = coerceRowsToComps(rows, mapping);

    expect(comps).toHaveLength(1);
    expect(comps[0]).toEqual({
      property_name: "Oak Tower",
      sale_price: 1250000,
      cap_rate: 6.5,
      sale_date: "2024-01-15",
      extra: { "Days on Market": "45" },
    });
  });

  it("skips empty cells rather than writing empty strings or NaN", () => {
    const rows = [{ "Property Name": "", "Sale Price": "" }];
    const mapping = { "Property Name": "property_name", "Sale Price": "sale_price" };

    const comps = coerceRowsToComps(rows, mapping);

    expect(comps[0]).toEqual({ extra: {} });
  });
});
