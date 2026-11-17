import type { Metadata } from "next";
import { getSources, getSummary } from "@/lib/data";
import { PageHeader, Container, Card, Ext, fmt } from "@/components/ui";

export const metadata: Metadata = { title: "Data", description: "Download RailEffect's derived research datasets, data dictionary, source registry and correction process." };

const REPO = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/renish5609-beep/raileffect";

const FILES = [
  { f: "raileffect_towns_analysis.csv", d: "One row per town: location, rail distances by benchmark, network metrics, verified populations and growth outcomes." },
  { f: "raileffect_population_observations.csv", d: "Long table of every census population reading with grade, note, source table(s) and PDF page." },
  { f: "raileffect_network_edges_texas.csv", d: "Graph edges (Atack segments intersecting Texas) with benchmark, opening interval, length and node ids. Geometry is not included." },
  { f: "raileffect_town_exclusions.csv", d: "Every OCR place identity excluded from the town set, with the reason." },
  { f: "raileffect_model_results.json", d: "All model estimates, diagnostics and robustness checks as produced by fit_models.py." },
];

const DICT: [string, string][] = [
  ["id", "Stable town identifier: slug of name and county"],
  ["lat, lon", "WGS84 point (GNIS populated place, else 2020 census place internal point)"],
  ["coord_source / gaz_id", "Gazetteer used and its feature identifier"],
  ["first_served", "First Atack benchmark year with track within 2 km (empty: none by 1911)"],
  ["opened_after", "Previous benchmark; the line opened after this year and by first_served"],
  ["dist_YYYY", "km from town point to nearest segment recorded by benchmark YYYY; dist_2020 uses TIGER 2020"],
  ["served1911 / served2020 / lost_rail", "Indicators at the 2 km threshold"],
  ["hub_net_km_1889 / _1911", "Shortest network km to the nearest 1910 city of 10,000+ (served towns only)"],
  ["betweenness_1911", "Sampled length-weighted betweenness of the nearest edge's better-connected node"],
  ["node_degree_1911", "Graph degree at that node (3+ = mapped junction)"],
  ["dist_interstate_km", "km to nearest 2020 Interstate (TIGER primary roads, RTTYP = I)"],
  ["popAYYYY", "Verified (grade A) census count for year YYYY; blank if none"],
  ["pop2010 / pop2020", "Official census counts linked through the 2020 census place code"],
  ["g40_60, g40_20, g60_20", "Natural-log population change between the indicated years (verified values only)"],
  ["quality", "A verified, B single printing with OCR consensus, C uncertain"],
  ["readings", "JSON list of {table, page, value} readings behind a value"],
];

export default function Page() {
  const src = getSources(), s = getSummary();
  return (
    <>
      <PageHeader eyebrow="Open Data" title="Download the research data">Derived datasets created by this project are released under CC BY 4.0. Third-party inputs remain under their owners’ terms and are not redistributed except as noted.</PageHeader>
      <Container className="py-8 grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" kicker="Downloads" title="Project-created datasets">
          <ul className="divide-y divide-rule">
            {FILES.map((x) => (
              <li key={x.f} className="py-3">
                <a href={`/downloads/${x.f}`} download className="link font-semibold" data-testid={`dl-${x.f}`}>{x.f}</a>
                <p className="text-sm text-muted">{x.d}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm mt-3"><a className="link font-semibold" href="/report/raileffect_report.md" data-testid="report-link">Research report (Markdown)</a> with <a className="link" href="/report/figures/fig1_network_maps.png">generated figures</a>.</p>
          <p className="text-sm mt-1">The full pipeline, tests and research report are in the <Ext href={REPO}>GitHub repository</Ext>.</p>
        </Card>
        <Card kicker="Licensing" title="Reuse terms">
          <ul className="text-sm space-y-2">
            <li><strong>Census volumes, TIGER, GNIS:</strong> U.S. federal government works, public domain.</li>
            <li><strong>Atack railroad GIS:</strong> research dataset; cite {src.railroads.atack.citation.split(".")[0]} (2016). Simplified Texas geometries are displayed with attribution; obtain the original from the author.</li>
            <li><strong>RailEffect derived data:</strong> CC BY 4.0. Code: MIT.</li>
          </ul>
        </Card>
        <Card className="lg:col-span-2" kicker="Data dictionary" title="Key fields">
          <table className="w-full text-sm"><tbody>{DICT.map(([k, v]) => <tr key={k} className="border-b border-rule/60 align-top"><td className="py-1.5 pr-3 num whitespace-nowrap">{k}</td><td>{v}</td></tr>)}</tbody></table>
        </Card>
        <Card kicker="Coverage" title="At a glance">
          <ul className="text-sm space-y-1">
            <li><span className="num">{fmt(s.towns_analyzed)}</span> towns</li>
            <li><span className="num">{fmt(s.rail_segments_texas)}</span> Texas track segments, {s.benchmark_years.length} benchmarks</li>
            <li><span className="num">{fmt(s.population_observations_total)}</span> population readings (all grades)</li>
          </ul>
        </Card>
        <Card className="lg:col-span-2" kicker="Archival evidence" title="Historical railroad maps">
          <ul className="text-sm space-y-1">{src.archival_maps.map((m: { url: string; title: string; date: string; holder: string; note?: string }) => <li key={m.url}><Ext href={m.url}>{m.title}</Ext> <span className="text-muted">— {m.date}, {m.holder}{m.note ? `. ${m.note}` : ""}</span></li>)}</ul>
          <p className="text-xs text-muted mt-2">These maps are images. They were not digitised for this release; they are listed so readers can check the vector network against period evidence.</p>
        </Card>
        <Card kicker="Community corrections" title="Report an inaccuracy">
          <div id="corrections" className="text-sm space-y-2">
            <p>Found a misread census figure, a wrongly placed town or a missing railroad? Corrections are reviewed publicly on GitHub.</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open a <Ext href={`${REPO}/issues/new?template=data-correction.yml`}>data correction issue</Ext>.</li>
              <li>Give the town, census year, the value you believe is correct and the source (table, page or archival item).</li>
              <li>A maintainer checks the page image; accepted corrections are added to the verification file and the pipeline is re-run.</li>
            </ol>
            <p><Ext href={`${REPO}/issues/new?template=source-contribution.yml`}>Suggest a new source</Ext></p>
          </div>
        </Card>
      </Container>
    </>
  );
}
