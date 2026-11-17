"use client";
import maplibregl, { type StyleSpecification, type MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

export type MapTown = { id: string; name: string; county: string; lat: number; lon: number; served1911?: boolean; pop1910?: number | null; firstServed?: number | null };

type Props = {
  year: number | "2020";             // benchmark year or "2020" (TIGER)
  towns: MapTown[];
  selectedTownId?: string | null;
  onTownClick?: (id: string) => void;
  onSegmentClick?: (props: Record<string, unknown>) => void;
  operatorFilter?: string;           // filter Atack segments by RR name ("" = all)
  showModern?: boolean;
  height?: string;
  interactive?: boolean;
  focus?: { lon: number; lat: number; zoom?: number } | null;
  theme?: "paper" | "night";
};

const BASEMAP_URL = "https://tiles.openfreemap.org/styles/positron";

const PALETTES = {
  paper: { bg: "#e4e7dd", county: "#9aa196", old: "#161b26", now: "#a3262a", future: "#8b9186", modern: "#2d5b88", served: "#f4f5f0", unserved: "#71834f", stroke: "#161b26", label: "#161b26", halo: "#f4f5f0" },
  night: { bg: "#1d2431", county: "#353d4c", old: "#c9cdc2", now: "#e0544c", future: "#4a5262", modern: "#6f9ccc", served: "#eceee6", unserved: "#8fa36a", stroke: "#161b26", label: "#eceee6", halo: "#161b26" },
};
const fallbackStyle = (bg: string): StyleSpecification => ({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": bg } }] });

async function loadBaseStyle(theme: "paper" | "night"): Promise<{ style: StyleSpecification | string; basemap: boolean }> {
  if (theme === "night") return { style: fallbackStyle(PALETTES.night.bg), basemap: false };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(BASEMAP_URL, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("basemap");
    return { style: (await r.json()) as StyleSpecification, basemap: true };
  } catch {
    return { style: fallbackStyle(PALETTES.paper.bg), basemap: false };
  }
}

export default function RailMap({ year, towns, selectedTownId, onTownClick, onSegmentClick, operatorFilter = "",
  showModern = false, height = "70vh", interactive = true, focus, theme = "paper" }: Props) {
  const P = PALETTES[theme];
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef({ onTownClick, onSegmentClick });
  cb.current = { onTownClick, onSegmentClick };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { style, basemap } = await loadBaseStyle(theme);
      if (cancelled || !ref.current) return;
      setBasemap(basemap);
      const map = new maplibregl.Map({
        container: ref.current, style, center: [-99.2, 31.2], zoom: 4.9, minZoom: 4, maxZoom: 13,
        attributionControl: { compact: true, customAttribution: "Railroads: J. Atack (2016); boundaries: U.S. Census Bureau TIGER/Line" },
        interactive,
      });
      mapRef.current = map;
      if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => { if (String(e.error?.message || "").includes("data/")) setError("Could not load research data layer."); });
      map.on("load", async () => {
        try {
          map.addSource("counties", { type: "geojson", data: "/data/counties.geojson" });
          map.addLayer({ id: "counties-line", type: "line", source: "counties", paint: { "line-color": P.county, "line-width": 0.5, "line-opacity": basemap ? 0.5 : 0.8 } });
          map.addSource("modern", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "modern-line", type: "line", source: "modern", layout: { visibility: "none" }, paint: { "line-color": P.modern, "line-width": 1.2, "line-opacity": 0.85 } });
          map.addSource("rail", { type: "geojson", data: "/data/rail_atack.geojson" });
          map.addLayer({ id: "rail-future", type: "line", source: "rail", paint: { "line-color": P.future, "line-width": 0.8, "line-opacity": 0.5, "line-dasharray": [2, 2] } });
          map.addLayer({ id: "rail-old", type: "line", source: "rail", paint: { "line-color": P.old, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 9, 3] } });
          map.addLayer({ id: "rail-new", type: "line", source: "rail", paint: { "line-color": P.now, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2.6, 9, 4.5] } });
          map.addLayer({ id: "rail-hit", type: "line", source: "rail", paint: { "line-color": "#000", "line-width": 10, "line-opacity": 0 } });
          map.addSource("towns", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "towns-pt", type: "circle", source: "towns", paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["==", ["get", "sel"], 1], 7, 1.8], 10, ["case", ["==", ["get", "sel"], 1], 11, 6]],
            "circle-color": ["case", ["==", ["get", "sel"], 1], P.now, ["==", ["get", "served"], 1], P.served, P.unserved],
            "circle-stroke-color": ["case", ["==", ["get", "sel"], 1], "#ffffff", P.stroke],
            "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 2, 0.6],
          } });
          map.addLayer({ id: "towns-label", type: "symbol", source: "towns", minzoom: 7, layout: {
            "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true,
            ...(basemap ? { "text-font": ["Noto Sans Regular"] } : {}) },
            paint: { "text-color": P.label, "text-halo-color": P.halo, "text-halo-width": 1.2 } });
          map.on("click", "towns-pt", (e) => {
            const f = e.features?.[0] as MapGeoJSONFeature | undefined;
            if (f) cb.current.onTownClick?.(String(f.properties.id));
          });
          map.on("click", "rail-hit", (e) => {
            if (map.queryRenderedFeatures(e.point, { layers: ["towns-pt"] }).length) return;
            const f = e.features?.[0];
            if (f) cb.current.onSegmentClick?.(f.properties as Record<string, unknown>);
          });
          for (const l of ["towns-pt", "rail-hit"]) {
            map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""));
          }
          setReady(true);
        } catch {
          setError("Map layers failed to initialise.");
        }
      });
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, theme]);

  // year + operator filters
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const modern = year === "2020";
    const y = modern ? 1911 : year;
    const op = operatorFilter ? ["==", ["get", "rr"], operatorFilter] : true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (expr: any) => (operatorFilter ? ["all", expr, op] : expr) as any;
    map.setFilter("rail-old", f(["<", ["get", "y"], y]));
    map.setFilter("rail-new", f(["==", ["get", "y"], y]));
    map.setFilter("rail-hit", f(["<=", ["get", "y"], y]));
    map.setFilter("rail-future", f([">", ["get", "y"], y]));
    for (const l of ["rail-old", "rail-new", "rail-hit"]) map.setLayoutProperty(l, "visibility", modern ? "none" : "visible");
    map.setLayoutProperty("rail-future", "visibility", modern ? "none" : "visible");
    const showM = modern || showModern;
    map.setLayoutProperty("modern-line", "visibility", showM ? "visible" : "none");
    if (showM) {
      const src = map.getSource("modern") as maplibregl.GeoJSONSource;
      // lazy-load the modern network only when requested
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(src as any)._loadedModern) { src.setData("/data/rail_tiger2020.geojson"); (src as any)._loadedModern = true; }
    }
  }, [ready, year, operatorFilter, showModern]);

  // towns
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("towns") as maplibregl.GeoJSONSource;
    src.setData({
      type: "FeatureCollection",
      features: towns.map((t) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [t.lon, t.lat] },
        properties: { id: t.id, name: t.name, sel: t.id === selectedTownId ? 1 : 0,
          served: typeof year === "number" ? (t.firstServed != null && t.firstServed <= year ? 1 : 0) : (t.served1911 ? 1 : 0) },
      })),
    });
  }, [ready, towns, selectedTownId, year]);

  useEffect(() => {
    if (ready && focus && mapRef.current) mapRef.current.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom ?? 8.5, duration: 900 });
  }, [ready, focus]);

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: P.bg }}>
      <div ref={ref} className="absolute inset-0" style={{ position: "absolute", width: "100%", height: "100%" }} data-testid="rail-map" data-ready={ready ? "1" : "0"} aria-label="Interactive map of historical Texas railroads and towns" role="region" />
      {!ready && !error && (
        <div className="ui absolute inset-0 grid place-items-center text-sm" style={{ color: P.future }} aria-live="polite">Loading the railroad layers</div>
      )}
      {error && <div role="alert" className="absolute top-3 left-3 right-3 bg-rail text-cream text-sm px-3 py-2 rounded">{error}</div>}
      {basemap === false && ready && theme === "paper" && (
        <div className="ui absolute bottom-2 left-2 bg-paper/90 text-[12px] text-muted px-2 py-1 rounded-sm">Reference basemap unavailable. Showing county boundaries.</div>
      )}
    </div>
  );
}
