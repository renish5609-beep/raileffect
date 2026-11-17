import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Town } from "./types";

const DIR = path.join(process.cwd(), "public", "data");

const cache = new Map<string, unknown>();
export function readJson<T>(file: string): T {
  if (!cache.has(file)) {
    const p = path.join(DIR, file);
    if (!fs.existsSync(p)) throw new Error(`Required research data file missing: public/data/${file}`);
    cache.set(file, JSON.parse(fs.readFileSync(p, "utf8")));
  }
  return cache.get(file) as T;
}

export const getTowns = () => readJson<Town[]>("towns.json");
let townIndex: Map<string, Town> | null = null;
/** O(1) lookup; generateStaticParams builds ~1,000 pages, so a linear find per page was quadratic. */
export const getTown = (id: string) => {
  if (!townIndex) townIndex = new Map(getTowns().map((t) => [t.id, t]));
  return townIndex.get(id);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getSummary = () => readJson<any>("summary.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getModels = () => readJson<any>("models.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCaseStudies = () => readJson<any>("case_studies.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getSources = () => readJson<any>("sources.json");
