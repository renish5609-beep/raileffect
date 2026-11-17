import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTowns, getTown, getSources } from "@/lib/data";
import { Container, Card, QualityBadge, KindTag, Ext, fmt, logpct } from "@/components/ui";
import { citation } from "@/lib/sources";
import PopChart from "@/components/PopChart";
import TownMap from "@/components/TownMap";

export function generateStaticParams() {
  return getTowns().map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = getTown(id);
  return t ? { title: `${t.name}, ${t.county} County`, description: `Census population history and documented railroad access for ${t.name}, Texas.` } : {};
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = getTown(id);
  if (!t) notFound();
  const sources = getSources();
  const A = t.pops.filter((p) => p.quality === "A" && p.pop != null);
  const first = A[0], last = A[A.length - 1];
  const fs = t.first_served_benchmark;
  const handbook = `https://www.tshaonline.org/search?q=${encodeURIComponent(t.name)}`;
  const portal = `https://texashistory.unt.edu/search/?q=${encodeURIComponent(`"${t.name}" Texas`)}&t=fulltext`;
  return (
    <>
      <section className="bg-coal text-cream relative">
        <Container className="py-8">
          <p className="ui text-cream/70 text-[0.95rem]"><Link href="/towns" className="underline underline-offset-4 hover:text-white">All towns</Link><span aria-hidden="true"> / </span>{t.county} County</p>
          <h1 className="text-[3.2rem] sm:text-[5rem] leading-none mt-2" data-testid="town-name">{t.name}</h1>
          <p className="ui text-cream/65 mt-3 text-[0.9rem]"><span className="tabular-nums">{t.lat.toFixed(4)}°N, {Math.abs(t.lon).toFixed(4)}°W</span>, located from the {t.coord_source === "usgs_gnis" ? "USGS GNIS populated-place point" : "2020 Census place point"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/compare?a=${t.id}`} className="ui bg-copper hover:bg-copper-2 text-white px-4 py-2.5 rounded-sm font-semibold transition-colors" data-testid="compare-link">Compare with another town</Link>
            <Link href="/explorer" className="ui border-2 border-cream/50 hover:border-cream px-4 py-2 rounded-sm font-semibold transition-colors">Open the Railroad Explorer</Link>
          </div>
        </Container>
      </section>
      <Container className="py-12 grid lg:grid-cols-3 gap-x-10 gap-y-12">
        <div className="lg:col-span-2 space-y-12">
          <Card kicker="Population" title="Census population history">
            <PopChart series={[{ name: t.name, pops: t.pops }]} />
            <p className="text-xs text-muted mt-2">Solid markers: verified (A). Hollow: single-printing OCR consensus (B). Crosses: uncertain (C). Lines connect only verified values and do not imply intermediate measurements.</p>
          </Card>
          <Card kicker="Evidence" title="Population observations and citations">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="obs-table">
                <thead><tr className="text-left border-b border-rule"><th className="py-1 pr-2">Year</th><th className="pr-2">Population</th><th className="pr-2">Grade</th><th className="pr-2">Source (page)</th><th>Note</th></tr></thead>
                <tbody>
                  {t.pops.map((p) => (
                    <tr key={p.year} className="border-b border-rule/60 align-top">
                      <td className="py-1 pr-2 num">{p.year}</td>
                      <td className="pr-2 num">{fmt(p.pop)}</td>
                      <td className="pr-2"><QualityBadge q={p.quality} /></td>
                      <td className="pr-2">
                        {p.readings && p.readings.length > 0 ? p.readings.map((r, i) => {
                          const c = citation(sources, r.table, r.page);
                          return c ? <div key={i}><a className="link" href={c.url} target="_blank" rel="noopener noreferrer" data-testid="citation-link">{r.table.split("_")[0]} census, Table {r.table.split("_")[1]?.replace("T", "")}, p. {r.page ?? "?"}</a>{r.value != null && r.value !== p.pop ? <span className="text-muted"> (read {r.value.toLocaleString()})</span> : null}</div> : <div key={i}>{r.table}</div>;
                        }) : p.sources.map((s) => { const src = sources.census_tables[s]; return src ? <a key={s} className="link" href={src.url} target="_blank" rel="noopener noreferrer">{s.replace("official_", "Census ")}</a> : <span key={s}>{s}</span>; })}
                      </td>
                      <td className="text-xs text-muted">{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card kicker="Railroad access" title="Distance to documented track at each benchmark">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-rule"><th className="py-1">Benchmark</th>{t.rail.map((r) => <th key={r.year} className="num px-1">{r.year === 2020 ? "2020*" : r.year}</th>)}</tr></thead>
                <tbody><tr><td className="py-1 text-muted">km</td>{t.rail.map((r) => <td key={r.year} className={`num px-1 ${r.served ? "text-copper font-semibold" : ""}`}>{r.dist_km == null ? "—" : r.dist_km < 10 ? r.dist_km.toFixed(1) : Math.round(r.dist_km)}</td>)}</tr></tbody>
              </table>
            </div>
            <p className="text-xs text-muted mt-2">Straight-line km from the town point to the nearest segment recorded as operating by that benchmark (Atack 2016). Highlighted ≤ 2 km. *2020 uses Census TIGER/Line rail features, a different source.</p>
          </Card>
        </div>
        <div className="space-y-10">
          <TownMap lat={t.lat} lon={t.lon} id={t.id} name={t.name} />
          <Card kicker="Summary" title="What the data show">
            <ul className="space-y-3 text-sm">
              <li><KindTag kind="Computed result" /><p className="mt-1">{fs ? <>Track first recorded within 2 km on the <span className="num">{fs}</span> benchmark map{t.arrival_interval?.[0] ? <> (not on the {t.arrival_interval[0]} map), so the line opened between {t.arrival_interval[0]} and {fs}</> : null}.</> : <>No track recorded within 2 km on any benchmark map through 1911 (nearest: {t.rail.find((r) => r.year === 1911)?.dist_km?.toFixed(1)} km).</>}</p></li>
              <li><KindTag kind="Computed result" /><p className="mt-1">{t.served_2020 ? "Rail features are present within 2 km in 2020." : fs ? "No 2020 rail feature within 2 km — consistent with later abandonment or realignment (not independently documented here)." : "No 2020 rail feature within 2 km."}</p></li>
              {first && last && first.year !== last.year && <li><KindTag kind="Observed fact" /><p className="mt-1">Verified counts: <span className="num">{fmt(first.pop)}</span> in {first.year}, <span className="num">{fmt(last.pop)}</span> in {last.year} ({logpct(Math.log((last.pop as number) / (first.pop as number)))}).</p></li>}
              {t.outcomes.peak_year && t.outcomes.declined_from_peak_pct != null && t.outcomes.declined_from_peak_pct > 0 && <li><KindTag kind="Computed result" /><p className="mt-1">2020 population is {t.outcomes.declined_from_peak_pct}% below its verified peak ({t.outcomes.peak_year}).</p></li>}
              <li><KindTag kind="Observed fact" /><p className="mt-1">{t.outcomes.persisted_2020 ? "Enumerated as a census place in 2020." : "Not a census place in 2020. This alone does not mean the community disappeared."}</p></li>
            </ul>
          </Card>
          <Card kicker="Network position (1911)" title="Connectivity metrics">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-muted">Network km to nearest 1910 city ≥10,000</dt><dd className="num">{fmt(t.metrics.hub_net_km_1911, 1)}</dd>
              <dt className="text-muted">Same, 1889 network</dt><dd className="num">{fmt(t.metrics.hub_net_km_1889, 1)}</dd>
              <dt className="text-muted">Graph degree at nearest node</dt><dd className="num">{fmt(t.metrics.node_degree_1911)}</dd>
              <dt className="text-muted">Betweenness (sampled, normalised)</dt><dd className="num">{fmt(t.metrics.betweenness_1911, 4)}</dd>
              <dt className="text-muted">In main connected component</dt><dd>{t.metrics.main_component_1911 == null ? "—" : t.metrics.main_component_1911 ? "yes" : "no"}</dd>
              <dt className="text-muted">km to a 2020 Interstate</dt><dd className="num">{fmt(t.metrics.dist_interstate_km, 1)}</dd>
            </dl>
            <p className="text-xs text-muted mt-2">Network metrics are computed only for towns within 2 km of track. See <Link className="underline" href="/methodology#graph">graph methodology</Link>.</p>
          </Card>
          <Card kicker="Historical context" title="Further reading">
            <p className="text-sm text-muted">RailEffect does not reproduce narrative histories it could not verify. Start with these searches of established references:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li><Ext href={handbook}>Handbook of Texas (TSHA) search</Ext></li>
              <li><Ext href={portal}>The Portal to Texas History search</Ext></li>
            </ul>
            {t.flags.length > 0 && <ul className="mt-3 text-xs text-rail list-disc pl-4">{t.flags.map((f) => <li key={f}>{f}</li>)}</ul>}
          </Card>
        </div>
      </Container>
    </>
  );
}
