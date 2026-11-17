"use client";
import { useMemo, useState } from "react";
import { Chart, COLORS } from "@/components/Chart";
import { Card, Stat, KindTag, fmt } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const BINS = Array.from({ length: 27 }, (_, i) => -2.5 + i * 0.25);
const binc = (a: number[]) => BINS.slice(0, -1).map((b, i) => a.filter((x) => (i === 0 ? x < BINS[1] : i === BINS.length - 2 ? x >= b : x >= b && x < BINS[i + 1])).length);
const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export default function Dashboard({ s, m, idx }: { s: any; m: any; idx: any[] }) {
  const [zone, setZone] = useState("");
  const [era, setEra] = useState("");
  const [size, setSize] = useState("");
  const f = useMemo(() => idx.filter((t) => (!zone || t.zone === zone) && (!era || t.era === era) &&
    (!size || (t.pop1940 != null && (size === "small" ? t.pop1940 < 2500 : size === "mid" ? t.pop1940 >= 2500 && t.pop1940 < 10000 : t.pop1940 >= 10000)))), [idx, zone, era, size]);
  const gs = f.filter((t) => t.g4020 != null && t.served1911).map((t) => t.g4020);
  const gn = f.filter((t) => t.g4020 != null && !t.served1911).map((t) => t.g4020);
  const b1 = s.headline.b1_served1911;
  const years = Object.keys(s.observations_by_year_quality);
  const eras = ["by 1872", "1873-1881", "1882-1889", "1890-1911", "not served by 1911"];
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8" data-testid="headline-stats">
        <Stat testid="stat-towns" label="Towns analysed (geolocated census places)" value={fmt(s.towns_analyzed)} note={`from ${fmt(s.candidate_census_identities)} OCR'd place identities`} />
        <Stat testid="stat-segments" label="Atack track segments in Texas" value={fmt(s.rail_segments_texas)} note={`${s.benchmark_years.length} benchmark snapshots, ${s.benchmark_years[0]}–${s.benchmark_years[s.benchmark_years.length - 1]}`} />
        <Stat testid="stat-obs" label="Population observations (A or B)" value={fmt(s.population_observations_ab)} note={`incl. ${fmt(s.official_counts["2010"] + s.official_counts["2020"])} official 2010/2020 counts`} />
        <Stat testid="stat-n" label="Towns in main regression" value={fmt(s.towns_in_regression_sample)} note="verified 1940 and 2020 counts" />
      </div>

      <Card kicker="Headline" title="Main result">
        <div className="grid md:grid-cols-2 gap-5 text-sm">
          <div><KindTag kind="Computed result" /><p className="mt-2">Unadjusted: towns rail-served by 1911 grew <span className="num">{s.headline.diff_mean_g40_20.served_minus_not.toFixed(2)}</span> log points more from 1940 to 2020 (95% CI {s.headline.diff_mean_g40_20.ci[0].toFixed(2)} to {s.headline.diff_mean_g40_20.ci[1].toFixed(2)}).</p></div>
          <div><KindTag kind="Computed result" /><p className="mt-2">Adjusted for 1940 size and geography (Model B1): <span className="num">{b1.coef.toFixed(2)}</span> (95% CI {b1.ci_low.toFixed(2)} to {b1.ci_high.toFixed(2)}, p = {b1.p_hc3.toFixed(2)}). The data cannot distinguish this from no association.</p></div>
          <div><KindTag kind="Historical interpretation" /><p className="mt-2">By 1911 roughly {Math.round(s.served1911_share * 100)}% of the study towns lay within 2 km of track, so “rail versus no rail” separates mainly a small, western, later-settled group from everyone else. Long-run growth among mid-century towns tracks distance to large cities and to the later Interstate network more closely than early rail access.</p></div>
          <div><KindTag kind="Uncertain inference" /><p className="mt-2">Survivorship bias is built in: the sample consists of places that incorporated and appeared in census tables. Settlements that never incorporated — often the ones bypassed by railroads — are invisible here.</p></div>
        </div>
      </Card>

      <div className="ui flex flex-wrap gap-4 items-end border-y-2 border-ink py-3 text-[0.95rem] sticky top-14 z-10 bg-paper" aria-label="Filters">
        <span className="font-semibold">Filter the descriptive results</span>
        <label>Region <select value={zone} onChange={(e) => setZone(e.target.value)} className="border-2 border-rule rounded-sm px-2 py-1 bg-white"><option value="">All</option><option>East</option><option>Central</option><option>West</option></select></label>
        <label>Arrival <select value={era} onChange={(e) => setEra(e.target.value)} className="border-2 border-rule rounded-sm px-2 py-1 bg-white"><option value="">All</option>{eras.map((e) => <option key={e}>{e}</option>)}</select></label>
        <label>1940 size <select value={size} onChange={(e) => setSize(e.target.value)} className="border-2 border-rule rounded-sm px-2 py-1 bg-white"><option value="">All</option><option value="small">&lt; 2,500</option><option value="mid">2,500–9,999</option><option value="large">10,000+</option></select></label>
        <span className="ml-auto text-muted" aria-live="polite">{f.length} towns, growth known for {gs.length + gn.length}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-10 gap-y-12">
        <Card kicker="Distribution" title="Population change 1940–2020 (log points)">
          <Chart label="Histogram of growth by rail access" height={300} data={[
            { type: "bar", x: BINS.slice(0, -1).map((b) => b + 0.125), y: binc(gs).map((c) => c / Math.max(1, gs.length)), width: 0.25, name: `Track ≤ 2 km by 1911 (n=${gs.length})`, opacity: 0.7, marker: { color: COLORS.served } } as any,
            { type: "bar", x: BINS.slice(0, -1).map((b) => b + 0.125), y: binc(gn).map((c) => c / Math.max(1, gn.length)), width: 0.25, name: `No track (n=${gn.length})`, opacity: 0.7, marker: { color: COLORS.notServed } } as any,
          ]} layout={{ barmode: "overlay", yaxis: { title: { text: "Share of group" }, tickformat: ".0%" }, xaxis: { title: { text: "ln(pop 2020 / pop 1940)" } }}} />
          <p className="text-xs text-muted">Values below −2.5 or above 4 are placed in the end bins.</p>
          <p className="text-sm">Median: served <span className="num">{Number.isNaN(median(gs)) ? "—" : median(gs).toFixed(2)}</span>, not served <span className="num">{Number.isNaN(median(gn)) ? "—" : median(gn).toFixed(2)}</span>. Mean: <span className="num">{Number.isNaN(mean(gs)) ? "—" : mean(gs).toFixed(2)}</span> vs <span className="num">{Number.isNaN(mean(gn)) ? "—" : mean(gn).toFixed(2)}</span>. Declined: {gs.length ? Math.round(100 * gs.filter((x) => x < 0).length / gs.length) : "—"}% vs {gn.length ? Math.round(100 * gn.filter((x) => x < 0).length / gn.length) : "—"}%.</p>
        </Card>
        <Card kicker="Network growth" title="Texas track recorded by benchmark">
          <Chart label="Track km by benchmark year" height={300} data={[{ type: "scatter", mode: "lines+markers", x: Object.keys(s.texas_track_km_by_benchmark).map(Number).filter((y) => y >= 1861), y: Object.entries(s.texas_track_km_by_benchmark).filter(([y]) => Number(y) >= 1861).map(([, v]) => v as number), line: { color: COLORS.rail }, marker: { color: COLORS.rail }, name: "km" }]}
            layout={{ yaxis: { title: { text: "km of track in Texas" } }, xaxis: { title: { text: "Atack benchmark map" } }, showlegend: false }} />
          <p className="text-sm text-muted">Points are benchmark maps only. The 2020 TIGER layer ({fmt(s.tiger2020_km)} km incl. sidings and yards) is not comparable and is excluded.</p>
        </Card>
        <Card kicker="Coverage" title="Population observations by census year and grade">
          <Chart label="Observations by year and quality" height={300} data={(["A", "B", "C"] as const).map((q, i) => ({ type: "bar", name: q === "A" ? "A verified" : q === "B" ? "B single printing" : "C uncertain", x: years, y: years.map((y) => s.observations_by_year_quality[y][q] || 0), marker: { color: [COLORS.notServed, "#c9b99a", COLORS.rail][i] } }))}
            layout={{ barmode: "stack", yaxis: { title: { text: "Place-year observations" } } }} />
          <p className="text-sm text-muted">Plus official counts for {fmt(s.official_counts["2010"])} towns (2010) and {fmt(s.official_counts["2020"])} towns (2020). 1920 is not covered; 1930 and 1970 rest on one printing each.</p>
        </Card>
        <Card kicker="Missing data" title="Share of towns without a value">
          <Chart label="Missing data by year" height={300} data={[
            { type: "bar", name: "No A/B value", x: Object.keys(s.missing), y: Object.values(s.missing) as number[], marker: { color: "#c9b99a" } },
            { type: "bar", name: "No verified (A) value", x: Object.keys(s.missing_A), y: Object.values(s.missing_A) as number[], marker: { color: COLORS.rail } },
          ]} layout={{ barmode: "group", yaxis: { title: { text: "Share missing" }, tickformat: ".0%", range: [0, 1] } }} />
        </Card>
        <Card kicker="Arrival" title="Towns by first benchmark with track ≤ 2 km">
          <Chart label="Arrival benchmark counts" height={280} data={[{ type: "bar", x: Object.keys(s.arrival_counts), y: Object.values(s.arrival_counts) as number[], marker: { color: COLORS.served } }]} layout={{ xaxis: { type: "category", title: { text: "Benchmark map" } }, yaxis: { title: { text: "Towns" } }, showlegend: false }} />
          <p className="text-sm text-muted">{fmt(s.towns_analyzed - Object.values(s.arrival_counts).reduce((a: number, b: any) => a + b, 0))} towns had no track within 2 km by 1911. {fmt(s.lost_rail_by_2020)} rail-served towns have no 2020 rail feature within 2 km.</p>
        </Card>
        <Card kicker="Graph" title="Network snapshots (study area)">
          <div className="overflow-x-auto"><table className="w-full text-sm num">
            <thead><tr className="text-left border-b border-rule"><th className="py-1">Year</th><th>Nodes</th><th>Edges</th><th>Components</th><th>Largest share</th><th>Junctions</th></tr></thead>
            <tbody>{Object.entries(s.network).filter(([y]) => Number(y) >= 1861).map(([y, v]: any) => <tr key={y} className="border-b border-rule/60"><td className="py-1">{y}</td><td>{fmt(v.nodes)}</td><td>{fmt(v.edges)}</td><td>{v.components}</td><td>{(v.largest_component_share * 100).toFixed(0)}%</td><td>{v.junction_nodes_deg3plus}</td></tr>)}</tbody>
          </table></div>
          <p className="text-xs text-muted mt-2">Endpoints snapped within {s.snap_tolerance_m} m. {s.network_audit.proper_crossings_without_shared_endpoint} map crossings inside Texas share no endpoint and are left unconnected.</p>
        </Card>
      </div>
      <Card kicker="Model estimates" title="Rail-access coefficient across specifications">
        <Chart label="Rail coefficient across models" height={340} data={[{
          type: "scatter", mode: "markers",
          x: [...m.model_b.models.filter((x: any) => x.terms.some((t: any) => t.term === "served1911")).map((x: any) => x.terms.find((t: any) => t.term === "served1911").coef), ...m.robustness.filter((r: any) => r.coef != null).map((r: any) => r.coef)],
          y: [...m.model_b.models.filter((x: any) => x.terms.some((t: any) => t.term === "served1911")).map((x: any) => x.label.split(":")[0]), ...m.robustness.filter((r: any) => r.coef != null).map((r: any) => r.check)],
          error_x: { type: "data", symmetric: false,
            array: [...m.model_b.models.filter((x: any) => x.terms.some((t: any) => t.term === "served1911")).map((x: any) => { const t = x.terms.find((t: any) => t.term === "served1911"); return t.ci_high - t.coef; }), ...m.robustness.filter((r: any) => r.coef != null).map((r: any) => r.ci_high - r.coef)],
            arrayminus: [...m.model_b.models.filter((x: any) => x.terms.some((t: any) => t.term === "served1911")).map((x: any) => { const t = x.terms.find((t: any) => t.term === "served1911"); return t.coef - t.ci_low; }), ...m.robustness.filter((r: any) => r.coef != null).map((r: any) => r.coef - r.ci_low)] },
          marker: { color: COLORS.served, size: 9 },
        }]} layout={{ margin: { l: 300, r: 20, t: 10, b: 40 }, xaxis: { title: { text: "Coefficient on rail access (log points, 95% CI)" }, zerolinewidth: 2 }, yaxis: { automargin: true }, showlegend: false }} />
      </Card>
    </div>
  );
}
