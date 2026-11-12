import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV export escaping (SEC-006)", () => {
  it("neutralizes spreadsheet formulas from untrusted text", () => {
    expect(csvCell('=HYPERLINK("https://evil.example","ver")')).toBe('"\'=HYPERLINK(""https://evil.example"",""ver"")"');
    expect(csvCell("+1+1")).toBe('"\'+1+1"');
    expect(csvCell("-2+3")).toBe('"\'-2+3"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tcmd")).toBe('"\'\tcmd"');
  });

  it("keeps plain numbers, empty values and normal text intact", () => {
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell("+52")).toBe('"+52"');
    expect(csvCell(12.5)).toBe('"12.5"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell("Ana López")).toBe('"Ana López"');
  });

  it("builds CRLF rows with the header first", () => {
    expect(toCsv([{ name: "=1+1", delta: -2 }], ["name", "delta"])).toBe('"name","delta"\r\n"\'=1+1","-2"\r\n');
  });
});
