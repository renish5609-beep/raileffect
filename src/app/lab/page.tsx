import type { Metadata } from "next";
import { getModels } from "@/lib/data";
import { PageHeader, Container } from "@/components/ui";
import { Suspense } from "react";
import Lab from "./Lab";

export const metadata: Metadata = { title: "Research Lab", description: "Reproducible model results: descriptive comparisons, multivariate regressions, panel and matched designs, robustness checks." };

export default function Page() {
  const m = getModels();
  return (
    <>
      <PageHeader eyebrow="Statistical Research Laboratory" title="Three ways of asking the same question">
        All estimates below were computed by <code className="text-copper-2">pipeline/fit_models.py</code> from the published datasets and can be reproduced exactly. They are associations: none of these designs isolates the causal effect of a railroad.
      </PageHeader>
      <Container className="py-10"><Suspense fallback={<p className="ui text-muted">Loading the models…</p>}><Lab m={m} /></Suspense></Container>
    </>
  );
}
