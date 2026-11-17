"use client";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";

const Plot = dynamic(async () => {
  const Plotly = (await import("plotly.js-basic-dist-min")).default;
  const factory = (await import("react-plotly.js/factory")).default;
  return factory(Plotly);
}, { ssr: false, loading: () => <div className="h-full w-full grid place-items-center text-sm text-muted">Loading chart…</div> });

export const FONT = { family: "Inter Variable, system-ui, sans-serif", size: 12, color: "#24211d" };
export const COLORS = { served: "#a85a32", notServed: "#5b7262", ink: "#24211d", muted: "#8a7f6c", rail: "#8f2b21", slate: "#4a5866" };

export function Chart({ data, layout, height = 320, label }: { data: Data[]; layout?: Partial<Layout>; height?: number; label: string }) {
  return (
    <figure className="w-full" style={{ height }} aria-label={label} data-testid="chart">
      <Plot
        data={data}
        layout={{
          autosize: true, height, margin: { l: 56, r: 16, t: 16, b: 84 }, font: FONT,
          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: { gridcolor: "#e7dfcf", zerolinecolor: "#d6ccb8", ...(layout?.xaxis || {}) },
          yaxis: { gridcolor: "#e7dfcf", zerolinecolor: "#d6ccb8", ...(layout?.yaxis || {}) },
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
