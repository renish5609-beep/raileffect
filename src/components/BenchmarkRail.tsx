"use client";
import { useRef, type KeyboardEvent } from "react";

/**
 * Benchmark years drawn as stations on a line, spaced by real elapsed time.
 * These years are a genuine sequence (the source maps), so a line diagram encodes information.
 * Arrow keys move between stations (roving tabindex), Home/End jump to the ends.
 */
export default function BenchmarkRail({ years, value, onChange, dark = false, extra, testidPrefix = "year" }: {
  years: number[]; value: number | "2020"; onChange: (y: number | "2020") => void; dark?: boolean;
  extra?: { label: string; value: "2020" }; testidPrefix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const min = years[0], max = years[years.length - 1];
  const pos = (y: number) => ((y - min) / (max - min)) * 100;
  const current = value === "2020" ? max : value;
  const all: (number | "2020")[] = extra ? [...years, extra.value] : years;
  const idx = all.indexOf(value);
  const move = (e: KeyboardEvent) => {
    const k = e.key;
    let n = idx;
    if (k === "ArrowRight" || k === "ArrowDown") n = Math.min(all.length - 1, idx + 1);
    else if (k === "ArrowLeft" || k === "ArrowUp") n = Math.max(0, idx - 1);
    else if (k === "Home") n = 0;
    else if (k === "End") n = all.length - 1;
    else return;
    e.preventDefault();
    onChange(all[n]);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-i="${n}"]`)?.focus());
  };
  return (
    <div ref={ref} role="radiogroup" aria-label="Railroad network snapshot" onKeyDown={move}
      className={`flex items-end gap-4 ${dark ? "text-cream" : "text-ink"}`}>
      <div className="overflow-x-auto flex-1 -mx-1 px-1 pb-1">
        <div className="rail-line relative h-16 min-w-[560px] mx-3" style={{ ["--rail-track" as string]: dark ? "#3a4252" : "var(--color-rule)" }}>
          <div className="rail-fill" style={{ width: `${pos(current)}%` }} aria-hidden="true" />
          {years.map((y, i) => {
            const sel = value === y;
            return (
              <button key={y} type="button" role="radio" aria-checked={sel} aria-pressed={sel} data-i={i} tabIndex={sel || (idx < 0 && i === 0) ? 0 : -1}
                data-testid={`${testidPrefix}-${y}`} onClick={() => onChange(y)}
                className={`station absolute top-1/2 -translate-x-1/2 ${y <= current ? "passed" : ""}`}
                style={{ left: `${pos(y)}%`, transform: `translate(-50%, ${i % 2 ? "-12px" : "-30px"})` }}>
                {i % 2 ? <><span className="station-dot" /><span className="station-year">{y}</span></> : <><span className="station-year">{y}</span><span className="station-dot" /></>}
              </button>
            );
          })}
        </div>
      </div>
      {extra && (
        <button type="button" role="radio" aria-checked={value === extra.value} aria-pressed={value === extra.value} data-i={all.length - 1}
          tabIndex={value === extra.value ? 0 : -1} data-testid={`${testidPrefix}-2020`} onClick={() => onChange(extra.value)}
          className={`ui shrink-0 mb-2 px-3 py-1.5 rounded-sm border-2 text-[0.95rem] font-semibold transition-colors ${value === extra.value ? "bg-slate border-slate text-white" : dark ? "border-cream/40 hover:border-cream" : "border-slate/50 text-slate hover:border-slate"}`}>
          {extra.label}
        </button>
      )}
    </div>
  );
}
