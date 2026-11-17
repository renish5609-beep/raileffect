"use client";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";

const Plot = dynamic(async () => {
  const Plotly = (await import("plotly.js-basic-dist-min")).default;
  const factory = (await import("react-plotly.js/factory")).default;
  return factory(Plotly);
}, { ssr: false, loading: () => <div className="h-full w-full grid place-items-center text-sm text-muted">Loading chart…</div> });

export const FONT = { family: "Barlow, system-ui, sans-serif", size: 13, color: "#161b26" };
export const COLORS = { served: "#a3262a", notServed: "#71834f", ink: "#161b26", muted: "#5a616c", rail: "#a3262a", slate: "#2d5b88" };

export function Chart({ data, layout, height = 320, label }: { data: Data[]; layout?: Partial<Layout>; height?: number; label: string }) {
  return (
    <figure className="w-full" style={{ height }} aria-label={label} data-testid="chart">
      <Plot
        data={data}
        layout={{
          autosize: true, height, margin: { l: 56, r: 16, t: 16, b: 84 }, font: FONT,
          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: { gridcolor: "#dfe2d8", zerolinecolor: "#9aa196", linecolor: "#161b26", showline: true, ...(layout?.xaxis || {}) },
          yaxis: { gridcolor: "#dfe2d8", zerolinecolor: "#9aa196", ...(layout?.yaxis || {}) },
          legend: { orientation: "h", y: -0.32, yanchor: "top", ...(layout?.legend || {}) },
          ...Object.fromEntries(Object.entries(layout || {}).filter(([k]) => !["xaxis", "yaxis", "legend"].includes(k))),
        }}
        config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d"] }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </figure>
  );
}
