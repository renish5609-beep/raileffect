"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { MapTown } from "@/components/RailMap";

const RailMap = dynamic(() => import("@/components/RailMap"), { ssr: false, loading: () => <div className="h-[70vh] rounded-lg bg-sand grid place-items-center text-muted text-sm">Loading map…</div> });

type T = MapTown & { pop1940: number | null; pop2020: number | null };
type Seg = { id?: string; y?: number; a?: number | null; rr?: string; km?: number; fid?: number };

const ATACK_DOC = "https://cdn.vanderbilt.edu/t2-my/my-prd/wp-content/uploads/sites/133/2021/02/Creating-Historical-Transportation-Shapefiles-RevisedFeb2021.pdf";

export default function Explorer({ towns, years, trackKm, operators, segmentsTexas }: { towns: T[]; years: number[]; trackKm: Record<string, number>; operators: string[]; segmentsTexas: number }) {
  const [year, setYear] = useState<number | "2020">(1881);
  const [sel, setSel] = useState<string | null>(null);
  const [seg, setSeg] = useState<Seg | null>(null);
  const [q, setQ] = useState("");
  const [op, setOp] = useState("");
  const [showModern, setShowModern] = useState(false);
  const town = towns.find((t) => t.id === sel) || null;
  const matches = useMemo(() => (q.length < 2 ? [] : towns.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)), [q, towns]);
  const focus = useMemo(() => (town ? { lon: town.lon, lat: town.lat, zoom: 9 } : null), [town]);
  const servedNow = typeof year === "number" ? towns.filter((t) => t.firstServed != null && t.firstServed <= year).length : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-copper uppercase tracking-[0.18em] text-xs font-medium">Railroad Explorer</p>
          <h1 className="text-2xl sm:text-3xl font-semibold">Texas railroad network snapshots</h1>
        </div>
        <p className="text-sm text-muted max-w-xl">Only years with a documented source map are selectable. Each historical snapshot shows the track Atack’s data record as operating by that benchmark; nothing between benchmarks is interpolated.</p>
      </div>

      <div className="mb-3" role="group" aria-label="Network snapshot year">
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button key={y} onClick={() => setYear(y)} aria-pressed={year === y} data-testid={`year-${y}`}
              className={`num text-sm px-3 py-1.5 rounded-md border ${year === y ? "bg-coal text-cream border-coal" : "bg-white border-rule hover:border-copper"}`}>{y}</button>
          ))}
          <button onClick={() => setYear("2020")} aria-pressed={year === "2020"} data-testid="year-2020"
            className={`text-sm px-3 py-1.5 rounded-md border ${year === "2020" ? "bg-slate text-white border-slate" : "bg-white border-rule hover:border-slate"}`}>2020 (modern, TIGER)</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <div>
          <RailMap year={year} towns={towns} selectedTownId={sel} onTownClick={(id) => { setSel(id); setSeg(null); }}
            onSegmentClick={(p) => setSeg(p as Seg)} operatorFilter={op} showModern={showModern} focus={focus} />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink items-center" aria-label="Legend">
            <span className="flex items-center gap-2"><span className="inline-block w-6 h-[3px] bg-copper" /> first recorded at selected benchmark</span>
            <span className="flex items-center gap-2"><span className="inline-block w-6 h-[2px] bg-coal" /> recorded at an earlier benchmark</span>
            <span className="flex items-center gap-2"><span className="inline-block w-6 border-t border-dashed border-muted" /> recorded later (context)</span>
            <span className="flex items-center gap-2"><span className="inline-block w-6 h-[2px] bg-slate" /> 2020 TIGER rail</span>
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-cream border border-coal" /> town with track ≤ 2 km</span>
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-sage border border-coal" /> town without</span>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="bg-white/70 border border-rule rounded-lg p-4">
            <label htmlFor="town-search" className="text-sm font-medium">Find a town</label>
            <input id="town-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Denison"
              className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-paper" autoComplete="off" data-testid="town-search" />
            {matches.length > 0 && (
              <ul className="mt-2 divide-y divide-rule border border-rule rounded-md bg-white" role="listbox">
                {matches.map((m) => (
                  <li key={m.id}><button className="w-full text-left px-3 py-1.5 text-sm hover:bg-sand" onClick={() => { setSel(m.id); setQ(""); setSeg(null); }}>
                    {m.name} <span className="text-muted">· {m.county} Co.</span></button></li>
                ))}
              </ul>
            )}
            <label htmlFor="op" className="text-sm font-medium block mt-3">Filter by recorded operator</label>
            <select id="op" value={op} onChange={(e) => setOp(e.target.value)} className="mt-1 w-full border border-rule rounded-md px-2 py-2 text-sm bg-paper">
              <option value="">All segments</option>
              {operators.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <p className="text-[11px] text-muted mt-1">Operator names appear only where Atack’s file records one (a minority of Texas segments).</p>
            <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={showModern} onChange={(e) => setShowModern(e.target.checked)} /> Overlay 2020 rail network</label>
          </div>

          <div className="bg-white/70 border border-rule rounded-lg p-4 text-sm" aria-live="polite">
            <p className="text-[11px] uppercase tracking-[0.14em] text-copper font-medium">Snapshot</p>
            {year === "2020" ? (
              <p className="mt-1">Modern rail features from U.S. Census TIGER/Line 2020 (main lines, spurs and yards). A different source and digitisation from the historical layer; not evidence of historical routes.</p>
            ) : (
              <>
                <p className="num text-2xl mt-1">{Math.round(trackKm[String(year)] || 0).toLocaleString()} km</p>
                <p className="text-muted">of track within Texas recorded as operating by {year}</p>
                <p className="mt-2"><span className="num">{servedNow}</span> of {towns.length} study towns within 2 km of recorded track.</p>
              </>
            )}
          </div>

          {town && (
            <div className="bg-white border border-copper/50 rounded-lg p-4 text-sm" data-testid="town-panel">
              <p className="text-[11px] uppercase tracking-[0.14em] text-copper font-medium">Town</p>
              <h2 className="text-lg font-semibold">{town.name}</h2>
              <p className="text-muted">{town.county} County</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1">
                <dt className="text-muted">First benchmark with track ≤ 2 km</dt><dd className="num">{town.firstServed ?? "none by 1911"}</dd>
                <dt className="text-muted">1940 population (verified)</dt><dd className="num">{town.pop1940?.toLocaleString() ?? "—"}</dd>
                <dt className="text-muted">2020 population</dt><dd className="num">{town.pop2020?.toLocaleString() ?? "not a 2020 census place"}</dd>
              </dl>
              <Link href={`/towns/${town.id}`} className="mt-3 inline-block text-copper underline" data-testid="open-profile">Open town profile →</Link>
            </div>
          )}

          {seg && (
            <div className="bg-white border border-coal/40 rounded-lg p-4 text-sm" data-testid="segment-panel">
              <p className="text-[11px] uppercase tracking-[0.14em] text-copper font-medium">Track segment</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted">Segment</dt><dd className="num break-all">{seg.id}</dd>
                <dt className="text-muted">Recorded operating by</dt><dd className="num">{seg.y} (benchmark map)</dd>
                <dt className="text-muted">Opening interval</dt><dd className="num">{seg.a ? `after ${seg.a}, by ${seg.y}` : `by ${seg.y}`}</dd>
                <dt className="text-muted">Operator</dt><dd>{seg.rr || <span className="text-muted">not recorded in source</span>}</dd>
                <dt className="text-muted">Length</dt><dd className="num">{seg.km} km</dd>
                <dt className="text-muted">Geometry</dt><dd>Atack (2016) digitisation of period state railroad maps; simplified to 25 m for display</dd>
                <dt className="text-muted">Alignment</dt><dd>Positional uncertainty is not quantified in the source; treat as map-scale (hundreds of metres).</dd>
              </dl>
              <p className="mt-2"><a className="text-copper underline" href={ATACK_DOC} target="_blank" rel="noopener noreferrer">Source documentation (Atack) ↗</a></p>
            </div>
          )}

          <div className="bg-rail/5 border border-rail/30 rounded-lg p-3 text-xs text-ink/80">
            <p className="font-medium text-rail mb-1">Data uncertainty</p>
            Atack’s dates mark the first benchmark map on which a line appears, so opening years are interval-censored. Abandonments before 1911 are not recorded. Lines crossing on the map are not assumed to be junctions. Coverage: {segmentsTexas.toLocaleString()} segments intersecting Texas.
          </div>
        </aside>
      </div>
    </div>
  );
}
