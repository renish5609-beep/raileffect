import type { Metadata } from "next";
import { getSummary, getModels, readJson } from "@/lib/data";
import { PageHeader, Container } from "@/components/ui";
import Dashboard from "./Dashboard";

export const metadata: Metadata = { title: "Findings", description: "Research findings dashboard: sample sizes, coverage, growth distributions and model estimates computed from the RailEffect data." };

export default function Page() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = readJson<any[]>("towns_index.json");
  return (
    <>
      <PageHeader eyebrow="Research Findings" title="What the evidence shows, and what it can’t">
        Every number on this page is computed from the published data at build time. Filters recompute descriptive statistics in your browser; model estimates are fixed results from the full sample.
      </PageHeader>
      <Container className="py-8"><Dashboard s={getSummary()} m={getModels()} idx={idx} /></Container>
    </>
  );
}
