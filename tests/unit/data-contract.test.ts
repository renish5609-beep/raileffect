import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const D = path.join(__dirname, "../../public/data");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));

describe("published data contract", () => {
  const towns = read("towns.json");
  const summary = read("summary.json");
  it("summary statistics are consistent with the town file", () => {
    expect(summary.towns_analyzed).toBe(towns.length);
  });
  it("every town has coordinates, a county and cited population values", () => {
    for (const t of towns) {
      expect(typeof t.lat).toBe("number");
      expect(t.county).toBeTruthy();
      for (const p of t.pops) expect(p.sources.length).toBeGreaterThan(0);
    }
  });
  it("snapshot years are documented benchmarks only", () => {
    const rail = read("rail_atack.geojson");
    const years = new Set(rail.features.map((f: { properties: { y: number } }) => f.properties.y));
    for (const y of years) expect([1852, 1854, 1858, 1861, 1863, 1868, 1872, 1877, 1881, 1889, 1893, 1898, 1903, 1911]).toContain(y);
  });
  it("downloads exist", () => {
    for (const f of ["raileffect_towns_analysis.csv", "raileffect_population_observations.csv", "raileffect_network_edges_texas.csv"])
      expect(fs.existsSync(path.join(__dirname, "../../public/downloads", f))).toBe(true);
  });
});
