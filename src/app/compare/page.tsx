import type { Metadata } from "next";
import { Suspense } from "react";
import { readJson } from "@/lib/data";
import Compare from "./Compare";

export const metadata: Metadata = { title: "Compare towns", description: "Side-by-side census population histories and railroad access for two Texas towns." };

export default function Page() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = readJson<any[]>("towns_index.json").map((t) => ({ id: t.id, name: t.name, county: t.county }));
  return <Suspense fallback={<div className="p-8">Loading…</div>}><Compare index={idx} /></Suspense>;
}
