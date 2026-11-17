"use client";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";

const Plot = dynamic(async () => {
  const Plotly = (await import("plotly.js-basic-dist-min")).default;
  const factory = (await import("react-plotly.js/factory")).default;
  return factory(Plotly);
}, { ssr: false, loading: () => <div className="h-full w-full grid place-items-center text-sm text-muted">Loading chart…</div> });

export const FONT = { family: "Barlow, system-ui, sans-serif", size: 13, color: "#161b26" };
// Categorical order validated with the dataviz skill's validate_palette.js against the ledger surface (#f4f5f0):
// lightness band, chroma floor, CVD (protan ΔE 20.3) and normal-vision separation, contrast all PASS.
export const COLORS = { served: "#a3262a", notServed: "#638f2f", ink: "#161b26", muted: "#5a616c", rail: "#a3262a", slate: "#2463a6" };
export const SURFACE = "#f4f5f0";
/** Ordinal ink ramp (one hue, dark = more certain) for verification grades; status colours are not reused. */
export const GRADE = { A: "#2b3445", B: "#8b919a", C: "#c9cdc2" };
/** Marker spec: >= 8px, 2px surface ring so dots stay legible where they cross lines. */
export const marker = (color: string, size = 9) => ({ color, size, symbol: "circle" as const, line: { color: SURFACE, width: 2 } });

export function Chart({ data, layout, height = 320, label }: { data: Data[]; layout?: Partial<Layout>; height?: number; label: string }) {
  return (
    <figure className="w-full" style={{ height }} aria-label={label} data-testid="chart">
      <Plot
        data={data}
        layout={{
          autosize: true, height, margin: { l: 56, r: 16, t: 16, b: 84 }, font: FONT,
          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
          barcornerradius: 4, bargap: 0.45,
          hoverlabel: { bgcolor: "#161b26", bordercolor: "#161b26", font: { family: FONT.family, color: "#f4f5f0", size: 13 } },
          xaxis: { gridcolor: "#e2e5dc", gridwidth: 1, zerolinecolor: "#9aa196", linecolor: "#161b26", showline: true, ticks: "", tickfont: { color: "#5a616c" }, ...(layout?.xaxis || {}) },
          yaxis: { gridcolor: "#e2e5dc", gridwidth: 1, zerolinecolor: "#9aa196", tickfont: { color: "#5a616c" }, separatethousands: true, ...(layout?.yaxis || {}) },
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
