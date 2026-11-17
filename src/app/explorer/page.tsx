import type { Metadata } from "next";
import { readJson, getSummary } from "@/lib/data";
import { Suspense } from "react";
import Explorer from "./Explorer";

export const metadata: Metadata = { title: "Railroad Explorer", description: "Interactive map of documented Texas railroad network snapshots, 1861–1911, with the 2020 network for comparison." };

type Idx = { id: string; name: string; county: string; lat: number; lon: number; firstServed: number | null; served1911: boolean; pop1940: number | null; pop2020: number | null };

export default function Page() {
  const towns = readJson<Idx[]>("towns_index.json");
  const summary = getSummary();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rail = readJson<any>("rail_atack.geojson");
  const ops = Array.from(new Set<string>(rail.features.map((f: { properties: { rr: string } }) => f.properties.rr).filter(Boolean))).sort();
  return (
    <Suspense fallback={<div className="ui p-8 text-muted">Loading the explorer…</div>}>
    <Explorer
      towns={towns.map((t) => ({ id: t.id, name: t.name, county: t.county, lat: t.lat, lon: t.lon, firstServed: t.firstServed, served1911: t.served1911, pop1940: t.pop1940, pop2020: t.pop2020 }))}
      years={summary.benchmark_years}
      trackKm={summary.texas_track_km_by_benchmark}
      operators={ops}
      segmentsTexas={summary.rail_segments_texas}
    />
    </Suspense>
  );
}
