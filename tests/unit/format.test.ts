import { describe, expect, it } from "vitest";
import { fmt, pct, logpct } from "../../src/components/ui";
import { citation } from "../../src/lib/sources";

describe("number formatting", () => {
  it("formats counts and missing values", () => {
    expect(fmt(24923)).toBe("24,923");
    expect(fmt(null)).toBe("—");
    expect(fmt(1.234, 1)).toBe("1.2");
  });
  it("converts log growth to percent change", () => {
    expect(logpct(Math.log(2))).toBe("+100%");
    expect(logpct(Math.log(0.5))).toBe("-50%");
    expect(logpct(null)).toBe("—");
  });
  it("formats shares", () => expect(pct(0.705)).toBe("71%"));
});

describe("citations", () => {
  const sources = { census_tables: { "1950_T7": { title: "1950 Census, Table 7", url: "https://www2.census.gov/x.pdf" } } };
  it("links to a PDF page", () => expect(citation(sources, "1950_T7", 30)?.url).toBe("https://www2.census.gov/x.pdf#page=30"));
  it("returns null for unknown tables", () => expect(citation(sources, "nope", 1)).toBeNull());
});
