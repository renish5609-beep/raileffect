import type { Metadata } from "next";
import Link from "next/link";
import { getSummary, getSources, getModels } from "@/lib/data";
import { PageHeader, Container, Ext, fmt } from "@/components/ui";

export const metadata: Metadata = { title: "Methodology", description: "Research question, sources, town selection, OCR and verification of census tables, graph construction, statistical models, validation and limitations." };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Page() {
  const s = getSummary(), src = getSources(), m = getModels();
  const toc = [["question", "Research question"], ["scope", "Historical scope"], ["sources", "Data sources"], ["selection", "Town inclusion"], ["population", "Population data and verification"], ["geo", "Geospatial methods"], ["graph", "Graph construction"], ["models", "Statistical models"], ["validation", "Validation"], ["missing", "Missing data"], ["limitations", "Limitations"], ["citation", "Citation policy"], ["reproduce", "Reproducibility"]];
  return (
    <>
      <PageHeader eyebrow="Research Transparency" title="Methodology">How every number on this site was produced, what it can support, and where it is weak.</PageHeader>
      <Container className="py-8 grid lg:grid-cols-[220px_1fr] gap-8">
        <nav aria-label="On this page" className="hidden lg:block text-sm sticky top-20 self-start space-y-1">{toc.map(([id, l]) => <a key={id} href={`#${id}`} className="block text-muted hover:text-copper">{l}</a>)}</nav>
        <article className="prose-re max-w-3xl">
          <h2 id="question">Research question</h2>
          <p>Did railroad access influence which Texas towns grew, declined or persisted? The project treats this as an open empirical question. Railroads may have mattered, but so may initial size, geography, regional economies, proximity to cities and later transport such as highways. The analysis is designed so that a null or mixed result is reportable.</p>
          <h2 id="scope">Historical scope</h2>
          <p>Railroad access is observed from Atack’s benchmark maps between {s.benchmark_years[0]} and {s.benchmark_years[s.benchmark_years.length - 1]}, plus the 2020 TIGER network for comparison. Population is observed from census tables for 1890, 1900, 1910, 1930, 1940, 1950, 1960 and 1970, and from official digital counts for 2010 and 2020. The brief’s 1870–1970 window was narrowed: 1870 and 1880 place counts and the 1920 census were not digitised, and the network after 1911 is unobserved until 2020. The main regression therefore asks whether access recorded by 1911 predicts growth from 1940 onward.</p>

          <h2 id="sources">Data sources</h2>
          <h3>Railroads</h3>
          <p>{src.railroads.atack.citation} {src.railroads.atack.note} Archived copy: {src.railroads.atack.archive}. Segments carry <code>InOpBy</code>, the benchmark map on which a line is first recorded; the opening date is therefore known only to lie after the previous benchmark and by that one. Operator names (<code>RRname</code>) are present for {s.rail_segments_with_operator} of {fmt(s.rail_segments_texas)} Texas segments and are shown only where present.</p>
          <p>Modern rail: {src.railroads.tiger2020.citation} It includes main lines, sidings and yards and is a different digitisation, so it is used only to ask whether a town has any rail feature nearby in 2020.</p>
          <h3>Population</h3>
          <ul>{Object.entries(src.census_tables).map(([k, v]: any) => <li key={k}><Ext href={v.url}>{v.title}</Ext></li>)}</ul>
          <h3>Gazetteers and other layers</h3>
          <ul>{Object.values(src.gazetteers).map((g: any) => <li key={g.url}><Ext href={g.url}>{g.citation}</Ext></li>)}</ul>
          <h3>Sources examined but not used</h3>
          <ul>{src.not_used.map((n: any) => <li key={n.source}><strong>{n.source}.</strong> {n.reason}</li>)}</ul>

          <h2 id="selection">Town inclusion criteria</h2>
          <ol>
            <li>The place is printed as an incorporated place in at least one digitised census table (1910 Table 2; 1940 Table 5; 1950 Table 7; 1960 Table 8; 1970 Table 6). Places marked unincorporated “(U)” are excluded.</li>
            <li>It has at least one population value of grade A or B.</li>
            <li>Its OCR name, snapped to a gazetteer spelling within the same county, matches exactly a USGS GNIS populated place (preferred, because GNIS points mark historic town centres) or a 2020 Census place.</li>
          </ol>
          <p>From {fmt(s.candidate_census_identities)} OCR place identities, {fmt(s.towns_analyzed)} towns qualify. Every exclusion is listed with its reason in <Link href="/data">raileffect_town_exclusions.csv</Link>. This frame is systematic — it is every incorporated place in the tables, not a list of famous railroad towns — but it is not free of selection: settlements that never incorporated are absent.</p>

          <h2 id="population">Population data and verification</h2>
          <p>The census volumes are scanned images. Each table page is rendered at 500 dpi, deskewed, and its ruled columns are found by morphological line detection (1970 uses a merged name/county column). Each numeric column is read five times (Tesseract default model at 500 and 300 dpi, a binarised variant, the <code>tessdata_best</code> LSTM model, and the legacy engine) after removing leader dots. Values are assigned to rows by tracking each column’s vertical drift relative to the name column, which corrects page curvature.</p>
          <p>Grades are rule-based:</p>
          <ul>
            <li><strong>A — verified.</strong> The same count is read from two independently printed volumes (e.g. 1940 appears in the 1940, 1950 and 1960 volumes), or it was visually checked against the page image ({fmt(s.visual_verified)} values for larger 1890–1910 towns, listed in <code>data/metadata/visual_verification.csv</code>), or it is an official 2010/2020 count.</li>
            <li><strong>B — single printing, consensus.</strong> Only one volume prints the value and at least 4 of 5 readings agree.</li>
            <li><strong>C — uncertain.</strong> Weaker agreement, disagreeing printings, implausible jumps or inconsistency with adjacent censuses.</li>
          </ul>
          <p>All statistical models use A-grade values only. B values appear on town pages and in a robustness check. Nothing is interpolated: a missing census year is shown as missing.</p>

          <h2 id="geo">Geospatial methods</h2>
          <p>All distances use NAD83 / Texas Centric Albers Equal Area (EPSG:3083). A town is “served” at a benchmark if a segment recorded by that benchmark lies within 2 km of its point (robustness: 1 km, 5 km and continuous distance). Display geometries are simplified to 25 m; analysis uses the unsimplified lines.</p>

          <h2 id="graph">Graph construction</h2>
          <p>Each segment’s endpoints become nodes; endpoints within {s.snap_tolerance_m} m are merged to absorb digitising error. No other connections are created: {s.network_audit.proper_crossings_without_shared_endpoint} places where lines cross on the map inside Texas without a shared endpoint are left unconnected, because a crossing is not evidence of an interchange. Edges are weighted by length. Snapshot graphs include every segment recorded by that benchmark. Metrics for towns within 2 km of track: network distance to the nearest 1910 city of 10,000+ (hubs: {s.hubs.join(", ")}; selected from 1910 counts of grade A or B), sampled length-weighted betweenness (1,500 sources, fixed seed), node degree, and connected-component membership.</p>

          <h2 id="models">Statistical models</h2>
          <p><strong>Model A</strong> compares mean and median log growth by rail status and by arrival benchmark, with bootstrap intervals. <strong>Model B</strong> is OLS of ln(pop<sub>2020</sub>/pop<sub>1940</sub>) on rail access with controls for ln 1940 population, a quadratic surface in longitude and latitude, and a coarse three-zone regional effect; HC3 and county-clustered errors are reported, with diagnostics. Extensions add distance to the 2020 Interstate network, rail presence in 2020, and (among served towns) network position. A logit models persistence as a 2020 census place. <strong>Model C</strong> attempts a two-way fixed-effects panel for 1890–1910 around rail arrival; only {m.model_c.panel_1890_1910.n_switchers} towns change status inside that window, so the result is shown but not interpreted causally. A Mahalanobis nearest-neighbour match on 1940 size and location is reported as a further comparison, with its balance problems stated.</p>

          <h2 id="validation">Validation</h2>
          <ul>
            <li>Cross-printing agreement is itself a validation: grade-A values are those two independent scans agree on.</li>
            <li>A reproducible random sample (seed 7) of OCR values was checked against row crops of the page images (<code>pipeline/validation_sample.py</code>; results in <code>data/metadata/validation_sample_results.csv</code>): grade A {s.validation.A.correct}/{s.validation.A.checked} correct (95% Clopper–Pearson interval {Math.round(s.validation.A.ci95_clopper_pearson[0] * 100)}–{Math.round(s.validation.A.ci95_clopper_pearson[1] * 100)}%); grade B {s.validation.B.correct}/{s.validation.B.checked} ({Math.round(s.validation.B.ci95_clopper_pearson[0] * 100)}–{Math.round(s.validation.B.ci95_clopper_pearson[1] * 100)}%). The sample is small; the intervals, not the point estimates, describe what is known.</li>
            <li>The 1911 Texas network totals {fmt(Math.round(s.texas_track_km_by_benchmark["1911"]))} km in Atack’s data; the pipeline reports this total so it can be checked against published mileage statistics.</li>
            <li>Automated checks (pytest) cover duplicate identifiers, coordinate bounds, impossible populations, missing citations, unsupported railroad years, CRS consistency, geometry validity and expected sample sizes.</li>
          </ul>

          <h2 id="missing">Missing data</h2>
          <p>Coverage is uneven by year (see the Findings dashboard). Towns with a verified 1940 count are more often rail-served ({Math.round(m.missing_data.served1911_share_with * 100)}%) than towns without one ({Math.round(m.missing_data.served1911_share_without * 100)}%), so the regression sample over-represents rail towns. No imputation is performed.</p>

          <h2 id="limitations">Limitations</h2>
          <ul>
            <li>Survivorship: only incorporated places that appear in census tables are observed; bypassed hamlets that never incorporated are missing.</li>
            <li>OCR error: grade-A agreement reduces but does not eliminate the chance of a wrong value; report errors via the correction process.</li>
            <li>Boundaries: city counts reflect boundaries at each census; annexations are not adjusted.</li>
            <li>Network after 1911 is unobserved until 2020; abandonment timing is unknown.</li>
            <li>Atack lines are digitised from small-scale state maps; positional error of hundreds of metres is plausible, which matters for a 2 km threshold.</li>
            <li>Controls are coarse. Agricultural output, county-seat status, oil discoveries and highway timing are not measured.</li>
            <li>The 2020 Interstate distance is measured after the outcome period begins and may itself respond to town size.</li>
          </ul>

          <h2 id="citation">Citation policy</h2>
          <p>Every population value links to its census table and PDF page. Narrative history is not reproduced unless verified; town pages link to the Handbook of Texas and Portal to Texas History as starting points. Statements on the site are labelled as observed facts, computed results, historical interpretations or uncertain inferences.</p>

          <h2 id="reproduce">Reproducibility</h2>
          <p>Run <code>pip install -r pipeline/requirements.txt</code>, install Tesseract 5, then <code>make pipeline</code> (or the scripts in <code>pipeline/</code> in the order listed in the README). Raw downloads are logged with URL, access time and SHA-256 in <code>data/metadata/acquisition_log.json</code>. The website is a static Next.js build reading <code>public/data</code>.</p>
        </article>
      </Container>
    </>
  );
}
