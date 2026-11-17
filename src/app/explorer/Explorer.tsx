"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MapTown } from "@/components/RailMap";
import BenchmarkRail from "@/components/BenchmarkRail";

const RailMap = dynamic(() => import("@/components/RailMap"), { ssr: false, loading: () => <div className="h-[70vh] bg-sand grid place-items-center text-muted text-sm">Loading map…</div> });

type T = MapTown & { pop1940: number | null; pop2020: number | null };
type Seg = { id?: string; y?: number; a?: number | null; rr?: string; km?: number; fid?: number };

const ATACK_DOC = "https://cdn.vanderbilt.edu/t2-my/my-prd/wp-content/uploads/sites/133/2021/02/Creating-Historical-Transportation-Shapefiles-RevisedFeb2021.pdf";

export default function Explorer({ towns, years, trackKm, operators, segmentsTexas }: { towns: T[]; years: number[]; trackKm: Record<string, number>; operators: string[]; segmentsTexas: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const initialYear = (() => { const y = sp.get("year"); if (y === "2020") return "2020" as const; const n = Number(y); return years.includes(n) ? n : 1881; })();
  const [year, setYear] = useState<number | "2020">(initialYear);
  const [sel, setSel] = useState<string | null>(sp.get("town"));
  // keep the snapshot and selected town in the URL so any view can be linked or bookmarked
  useEffect(() => {
    const q = new URLSearchParams();
    q.set("year", String(year));
    if (sel) q.set("town", sel);
    router.replace(`/explorer?${q}`, { scroll: false });
  }, [year, sel, router]);
  const [seg, setSeg] = useState<Seg | null>(null);
  const [q, setQ] = useState("");
  const [op, setOp] = useState("");
  const [showModern, setShowModern] = useState(false);
  const town = towns.find((t) => t.id === sel) || null;
  const matches = useMemo(() => (q.length < 2 ? [] : towns.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)), [q, towns]);
  const focus = useMemo(() => (town ? { lon: town.lon, lat: town.lat, zoom: 9 } : null), [town]);
  const servedNow = typeof year === "number" ? towns.filter((t) => t.firstServed != null && t.firstServed <= year).length : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-8">
      <div className="grid lg:grid-cols-[1fr_340px] gap-x-8 gap-y-3 items-end mb-2">
        <h1 className="text-[2.4rem] sm:text-[3rem]">Texas railroad network, map by map</h1>
        <p className="ui text-[0.95rem] text-muted">You can only pick years for which a source map exists. Each snapshot shows the track recorded as running by that date; nothing in between is drawn.</p>
      </div>
      <div className="mb-4">
        <BenchmarkRail years={years} value={year} onChange={setYear} extra={{ label: "Today (2020)", value: "2020" }} />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <div>
          <RailMap year={year} towns={towns} selectedTownId={sel} onTownClick={(id) => { setSel(id); setSeg(null); }}
            onSegmentClick={(p) => setSeg(p as Seg)} operatorFilter={op} showModern={showModern} focus={focus} />
          <div className="ui mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.85rem] text-ink items-center" aria-label="Legend">
            <span className="flex items-center gap-2"><span className="inline-block w-6 h-[3px] bg-copper" /> first recorded at selected benchmark</span>
            <span className="flex items-center gap-2"><span className="inline-block w-6 h-[2px] bg-coal" /> recorded at an earlier benchmark</span>
            <span className="flex items-center gap-2"><span className="inline-block w-6 border-t border-dashed border-muted" /> recorded later (context)</span>
            <span className="flex items-center gap-2"><span className="inline-block w-6 h-[2px] bg-slate" /> today’s track (2020)</span>
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-cream border border-coal" /> town with track ≤ 2 km</span>
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-sage border border-coal" /> town without</span>
          </div>
        </div>

        <aside className="space-y-6 ui">
          <div className="border-t-2 border-ink pt-3">
            <label htmlFor="town-search" className="ui font-semibold">Find a town</label>
            <input id="town-search" type="search" name="town" autoComplete="off" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Denison, Cisco, Abilene…"
              className="mt-1 w-full border-2 border-rule focus:border-ink rounded-sm px-3 py-2 text-[1rem] bg-white" data-testid="town-search" />
            {matches.length > 0 && (
              <ul className="mt-1 divide-y divide-rule border-2 border-ink border-t-0 bg-white" role="listbox">
                {matches.map((m) => (
                  <li key={m.id}><button className="w-full text-left px-3 py-1.5 text-sm hover:bg-sand" onClick={() => { setSel(m.id); setQ(""); setSeg(null); }}>
                    {m.name} <span className="text-muted">{m.county} County</span></button></li>
                ))}
              </ul>
            )}
            <label htmlFor="op" className="ui font-semibold block mt-4">Railroad company</label>
            <select id="op" value={op} onChange={(e) => setOp(e.target.value)} className="mt-1 w-full border-2 border-rule rounded-sm px-2 py-2 text-[0.95rem] bg-white">
              <option value="">All segments</option>
              {operators.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <p className="text-[0.8rem] text-muted mt-1">Only some segments name their company in the source.</p>
            <label className="flex items-center gap-2 mt-4"><input type="checkbox" className="accent-[#2d5b88] w-4 h-4" checked={showModern} onChange={(e) => setShowModern(e.target.checked)} /> Show today’s track on top</label>
          </div>

          <div className="border-t-2 border-ink pt-3 text-sm ui" aria-live="polite">
            
            {year === "2020" ? (
              <p className="mt-1">Modern rail features from U.S. Census TIGER/Line 2020 (main lines, spurs and yards). A different source and digitisation from the historical layer; not evidence of historical routes.</p>
            ) : (
              <>
                <p className="font-serif font-bold text-[2.6rem] leading-none tabular-nums">{Math.round(trackKm[String(year)] || 0).toLocaleString()} km</p>
                <p className="text-muted">of track within Texas recorded as operating by {year}</p>
                <p className="mt-2"><span className="num">{servedNow}</span> of {towns.length} study towns within 2 km of recorded track.</p>
              </>
            )}
          </div>

          {town && (
            <div className="border-t-4 border-copper pt-3 text-sm ui" data-testid="town-panel">
                            <h2 className="text-[1.9rem]">{town.name}</h2>
              <p className="text-muted">{town.county} County</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1">
                <dt className="text-muted">First benchmark with track ≤ 2 km</dt><dd className="num">{town.firstServed ?? "none by 1911"}</dd>
                <dt className="text-muted">1940 population (verified)</dt><dd className="num">{town.pop1940?.toLocaleString() ?? "—"}</dd>
                <dt className="text-muted">2020 population</dt><dd className="num">{town.pop2020?.toLocaleString() ?? "not a 2020 census place"}</dd>
              </dl>
              <Link href={`/towns/${town.id}`} className="mt-3 inline-block link font-semibold" data-testid="open-profile">Open the {town.name} profile</Link>
            </div>
          )}

          {seg && (
            <div className="border-t-4 border-ink pt-3 text-sm ui" data-testid="segment-panel">
              <h2 className="text-[1.5rem]">Track segment</h2>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted">Segment</dt><dd className="num break-all">{seg.id}</dd>
                <dt className="text-muted">Recorded operating by</dt><dd className="num">{seg.y} (benchmark map)</dd>
                <dt className="text-muted">Opening interval</dt><dd className="num">{seg.a ? `after ${seg.a}, by ${seg.y}` : `by ${seg.y}`}</dd>
                <dt className="text-muted">Operator</dt><dd>{seg.rr || <span className="text-muted">not recorded in source</span>}</dd>
                <dt className="text-muted">Length</dt><dd className="num">{seg.km} km</dd>
                <dt className="text-muted">Geometry</dt><dd>Atack (2016) digitisation of period state railroad maps; simplified to 25 m for display</dd>
                <dt className="text-muted">Alignment</dt><dd>Positional uncertainty is not quantified in the source; treat as map-scale (hundreds of metres).</dd>
              </dl>
              <p className="mt-2"><a className="link" href={ATACK_DOC} target="_blank" rel="noopener noreferrer">How Atack built the dataset (PDF)</a></p>
            </div>
          )}

          <div className="evidence ui text-[0.85rem] text-ink/80" style={{ ["--note" as string]: "#a3262a" }}>
            <p className="evidence-kind">What this map can’t tell you</p>
            Dates are the first map on which a line appears, so a line opened sometime between that map and the one before. Abandonments before 1911 are not recorded. Lines crossing on the map are not assumed to be junctions. Coverage: {segmentsTexas.toLocaleString()} segments intersecting Texas.
          </div>
        </aside>
      </div>
    </div>
  );
}
