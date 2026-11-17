"use client";
import { Chart, COLORS, marker } from "./Chart";
import type { PopObs } from "@/lib/types";

const PALETTE = [COLORS.served, COLORS.slate, COLORS.notServed];

export default function PopChart({ series, log = false, height = 300 }: { series: { name: string; pops: PopObs[] }[]; log?: boolean; height?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];
  series.forEach((s, i) => {
    const c = PALETTE[i % PALETTE.length];
    const A = s.pops.filter((p) => p.quality === "A" && p.pop != null);
    data.push({ x: A.map((p) => p.year), y: A.map((p) => p.pop), name: `${s.name} (verified)`, type: "scatter", mode: "lines+markers",
      line: { color: c, width: 2, shape: "linear" }, marker: marker(c), hovertemplate: "%{x}: %{y:,} (verified)<extra>" + s.name + "</extra>" });
    for (const [q, sym] of [["B", "circle-open"], ["C", "x"]] as const) {
      const P = s.pops.filter((p) => p.quality === q && p.pop != null);
      if (P.length) data.push({ x: P.map((p) => p.year), y: P.map((p) => p.pop), name: `${s.name} (${q === "B" ? "single printing" : "uncertain"})`, type: "scatter", mode: "markers",
        marker: { size: 10, color: c, symbol: sym, line: { color: c, width: 2 } }, showlegend: true, hovertemplate: `%{x}: %{y:,} (${q === "B" ? "single printing" : "uncertain"})<extra>${s.name}</extra>` });
    }
  });
  return <Chart label={`Population over time: ${series.map((s) => s.name).join(", ")}`} height={height} data={data}
    layout={{ hovermode: "x unified", yaxis: { title: { text: "Population" }, type: log ? "log" : "linear", rangemode: "tozero", tickformat: log ? "~s" : ",~s" }, xaxis: { title: { text: "Census year" }, dtick: 10, showspikes: true, spikemode: "across", spikethickness: 1, spikecolor: "#5a616c", spikedash: "solid" } }} />;
}
