"use client";
import { Chart, COLORS } from "./Chart";
import type { PopObs } from "@/lib/types";

const PALETTE = [COLORS.served, COLORS.slate, COLORS.notServed, COLORS.rail];

export default function PopChart({ series, log = false, height = 300 }: { series: { name: string; pops: PopObs[] }[]; log?: boolean; height?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];
  series.forEach((s, i) => {
    const c = PALETTE[i % PALETTE.length];
    const A = s.pops.filter((p) => p.quality === "A" && p.pop != null);
    data.push({ x: A.map((p) => p.year), y: A.map((p) => p.pop), name: `${s.name} (verified)`, type: "scatter", mode: "lines+markers", line: { color: c, width: 2 }, marker: { size: 8, color: c } });
    for (const [q, sym] of [["B", "circle-open"], ["C", "x"]] as const) {
      const P = s.pops.filter((p) => p.quality === q && p.pop != null);
      if (P.length) data.push({ x: P.map((p) => p.year), y: P.map((p) => p.pop), name: `${s.name} (${q === "B" ? "single printing" : "uncertain"})`, type: "scatter", mode: "markers", marker: { size: 8, color: c, symbol: sym }, showlegend: true });
    }
  });
  return <Chart label={`Population over time: ${series.map((s) => s.name).join(", ")}`} height={height} data={data}
    layout={{ yaxis: { title: { text: "Population" }, type: log ? "log" : "linear", rangemode: "tozero" }, xaxis: { title: { text: "Census year" }, dtick: 10 } }} />;
}
