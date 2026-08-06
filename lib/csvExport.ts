import Papa from "papaparse";

/** Pure: array of flat objects -> CSV text. Thin wrapper so callers don't need to know it's Papa Parse underneath. */
export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows);
}
