"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapTown } from "./RailMap";
import BenchmarkRail from "./BenchmarkRail";

const RailMap = dynamic(() => import("./RailMap"), { ssr: false, loading: () => <div className="h-full w-full bg-[#1d2431]" /> });

/** The site's one orchestrated motion moment: on first view the network grows benchmark by benchmark, once. */
export default function HeroMap({ towns, years, trackKm }: { towns: MapTown[]; years: number[]; trackKm: Record<string, number> }) {
  const [year, setYear] = useState<number>(years[0]);
  const played = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setYear(years[years.length - 1]); return; }
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setYear(years[i]);
      if (i >= years.length - 1 && timer.current) clearInterval(timer.current);
    }, 750);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [years]);
  const served = useMemo(() => towns.filter((t) => t.firstServed != null && t.firstServed <= year).length, [towns, year]);
  const pick = (y: number | "2020") => { if (timer.current) clearInterval(timer.current); setYear(y as number); };
  return (
    <div>
      <div className="relative border border-white/10"><div className="h-[300px] sm:h-[460px] lg:h-[520px]">
        <RailMap year={year} towns={towns} height="100%" interactive={false} theme="night" attribution={false} /></div>
        <p className="ui sm:absolute left-0 bottom-0 bg-coal/90 text-cream/85 text-[0.92rem] px-4 py-3 border-t border-r border-white/10" aria-live="polite">
          <span className="font-serif text-[2.6rem] font-bold text-white tabular-nums leading-none block">{year}</span>
          {Math.round(trackKm[String(year)]).toLocaleString()} km of track in Texas
          <br />{served} of {towns.length} study towns within 2 km
        </p>
      </div>
      <div className="mt-4"><BenchmarkRail years={years} value={year} onChange={pick} dark testidPrefix="hero-year" /></div>
      <p className="ui text-cream/55 text-[0.85rem] mt-1">Stations are the dates of Atack’s source maps, spaced in real time. Nothing between them is drawn. Railroads: J. Atack (2016). Boundaries: U.S. Census TIGER/Line.</p>
    </div>
  );
}
