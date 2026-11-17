import type { Metadata } from "next";
import Link from "next/link";
import { getCaseStudies, getTown, getSources } from "@/lib/data";
import { PageHeader, Container, Card, KindTag, Ext, fmt, logpct, QualityBadge } from "@/components/ui";
import PopChart from "@/components/PopChart";
import { citation } from "@/lib/sources";

export const metadata: Metadata = { title: "Case Studies", description: "Paired comparisons of real Texas towns selected by stated, data-driven rules." };

/* eslint-disable @typescript-eslint/no-explicit-any */
const ALT: Record<string, string[]> = {
  "denison-sherman": [
    "Administrative and commercial roles that differ between neighbouring towns (for example courts, colleges, or wholesale functions) can shape growth independently of track.",
    "Both towns were served in the same benchmark interval, so rail access alone cannot explain why their paths diverge; differences in later industry, highway and metropolitan ties are candidates.",
    "Annexation and boundary changes affect city counts; the census tables do not report historical boundaries.",
  ],
  "served-vs-unserved": [
    "Proximity to a large metropolitan area can dominate long-run growth; check the network and Interstate distances below.",
    "The 2 km rule depends on where GNIS places the town point and on the precision of Atack's digitised line; a town just beyond the threshold may still have used the railroad.",
    "Incorporation dates differ: a later-incorporating town enters the census tables at a different stage of growth.",
  ],
  "kept-vs-lost-track": [
    "Lines are often abandoned because traffic fell; population decline can be a cause, not a consequence, of losing track.",
    "TIGER 2020 and Atack are different digitisations; a 'lost' line may be a realignment or a mapping offset.",
    "Highway access, agricultural consolidation and county-level economic change are plausible competing explanations.",
  ],
  "early-vs-late": [
    "Early-served towns were often already larger or better located; early arrival may reflect, rather than cause, their advantages.",
    "Benchmark dates are interval-censored: 'by 1872' and '1890–1911' bracket openings, not exact dates.",
    "Regional economies (cotton, ranching, oil) changed after 1900 in ways unrelated to the date of first track.",
  ],
};

function Side({ s }: { s: any }) {
  return (
    <div className="text-sm">
      <h3 className="text-lg font-semibold"><Link className="underline decoration-copper/50" href={`/towns/${s.id}`}>{s.name}</Link> <span className="text-muted text-sm font-normal">{s.county} County</span></h3>
      <dl className="grid grid-cols-[1fr_auto] gap-y-0.5 mt-2">
        <dt className="text-muted">First benchmark with track ≤ 2 km</dt><dd className="num">{s.first_served ?? "none by 1911"}</dd>
        <dt className="text-muted">Distance to track 1911 / 2020</dt><dd className="num">{fmt(s.dist_1911, 1)} / {fmt(s.dist_2020, 1)} km</dd>
        <dt className="text-muted">Verified 1910 / 1940 / 1960</dt><dd className="num">{fmt(s.pop1910)} / {fmt(s.pop1940)} / {fmt(s.pop1960)}</dd>
        <dt className="text-muted">2020 census</dt><dd className="num">{fmt(s.pop2020)}</dd>
        <dt className="text-muted">Change 1940–2020</dt><dd className="num">{logpct(s.g40_20)}</dd>
        <dt className="text-muted">Network km to 1910 hub</dt><dd className="num">{fmt(s.hub_net_km_1911, 0)}</dd>
        <dt className="text-muted">km to 2020 Interstate</dt><dd className="num">{fmt(s.dist_interstate_km, 1)}</dd>
      </dl>
    </div>
  );
}

export default function Page() {
  const cases = getCaseStudies();
  const sources = getSources();
  return (
    <>
      <PageHeader eyebrow="Historical Case Studies" title="Paired towns, chosen by rule rather than by story">
        Each pair below was selected automatically by a rule written before looking at outcomes (except the Denison–Sherman pair, chosen as a same-county example from the project brief). None of these comparisons is a natural experiment.
      </PageHeader>
      <Container className="py-8 space-y-8">
        {cases.map((c: any, i: number) => {
          const ta = getTown(c.a.id)!, tb = getTown(c.b.id)!;
          return (
            <Card key={c.id} kicker={`Case ${i + 1} · selection ${c.selection_rule}`} title={c.title}>
              <div id={c.id} className="grid lg:grid-cols-3 gap-5">
                <div className="space-y-4"><Side s={c.a} /><Side s={c.b} /><p className="text-xs text-muted">Straight-line distance between town points: <span className="num">{c.distance_km}</span> km.</p></div>
                <div className="lg:col-span-2">
                  <PopChart series={[{ name: ta.name, pops: ta.pops }, { name: tb.name, pops: tb.pops }]} log height={300} />
                  <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <KindTag kind="Computed result" />
                      <p className="mt-1">{c.a.name}: {logpct(c.a.g40_20)} (1940–2020); {c.b.name}: {logpct(c.b.g40_20)}. Difference: <span className="num">{c.a.g40_20 != null && c.b.g40_20 != null ? (c.a.g40_20 - c.b.g40_20).toFixed(2) : "—"}</span> log points.</p>
                      <p className="mt-2 text-muted">Railroad documentation: Atack benchmark maps place track within 2 km of {c.a.name} {c.a.first_served ? `from ${c.a.first_served}` : "at no benchmark through 1911"} and of {c.b.name} {c.b.first_served ? `from ${c.b.first_served}` : "at no benchmark through 1911"}.</p>
                    </div>
                    <div>
                      <KindTag kind="Uncertain inference" />
                      <p className="mt-1 font-medium">Alternative explanations to weigh</p>
                      <ul className="list-disc pl-4 mt-1 space-y-1">{(ALT[c.id] || []).map((a) => <li key={a}>{a}</li>)}</ul>
                    </div>
                  </div>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-copper">Archival citations for these figures</summary>
                    <ul className="mt-2 space-y-1">
                      {[ta, tb].flatMap((t) => t.pops.filter((p) => p.quality === "A").flatMap((p) => (p.readings || []).map((r, k) => {
                        const cc = citation(sources, r.table, r.page);
                        return cc ? <li key={`${t.id}-${p.year}-${k}`}><QualityBadge q="A" /> {t.name} {p.year}: <span className="num">{fmt(p.pop)}</span> — <Ext href={cc.url}>{cc.title.split(":")[0]}, PDF p. {r.page}</Ext></li> : null;
                      })))}
                      <li>Railroad geometry and dates: {sources.railroads.atack.citation}</li>
                      {sources.archival_maps.filter((m: any) => m.holder.startsWith("Library")).slice(0, 3).map((m: any) => <li key={m.url}><Ext href={m.url}>{m.title} ({m.date})</Ext></li>)}
                    </ul>
                  </details>
                  <p className="text-xs text-muted mt-3">Limitations: both towns are incorporated places that survived to appear in census tables; boundaries changed over time; rail access is measured from a town point, not from where depots stood.</p>
                </div>
              </div>
            </Card>
          );
        })}
      </Container>
    </>
  );
}
