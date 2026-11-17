"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MapTown } from "./RailMap";
const RailMap = dynamic(() => import("./RailMap"), { ssr: false, loading: () => <div className="h-[420px] rounded-lg bg-coal-2" /> });

export default function HeroMap({ towns, years, trackKm }: { towns: MapTown[]; years: number[]; trackKm: Record<string, number> }) {
  const [i, setI] = useState(years.indexOf(1881) >= 0 ? years.indexOf(1881) : 0);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!play) return;
    const h = setInterval(() => setI((x) => (x + 1) % years.length), 1600);
    return () => clearInterval(h);
  }, [play, years.length]);
  const y = years[i];
  return (
    <div>
      <RailMap year={y} towns={towns} height="420px" interactive={false} />
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button onClick={() => setPlay(!play)} className="border border-cream/40 rounded px-3 py-1" aria-pressed={play}>{play ? "Pause" : "Play"}</button>
        <input aria-label="Benchmark year" type="range" min={0} max={years.length - 1} value={i} onChange={(e) => { setPlay(false); setI(Number(e.target.value)); }} className="flex-1 accent-[#c9784b]" />
        <span className="num text-copper-2 w-40 text-right">{y} · {Math.round(trackKm[String(y)]).toLocaleString()} km</span>
      </div>
      <p className="text-xs text-cream/60 mt-1">Slider steps through documented benchmark maps only.</p>
    </div>
  );
}
