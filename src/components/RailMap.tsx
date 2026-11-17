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
};

const BASEMAP_URL = "https://tiles.openfreemap.org/styles/positron";

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#efe9dc" } }],
};

async function loadBaseStyle(): Promise<{ style: StyleSpecification | string; basemap: boolean }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(BASEMAP_URL, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("basemap");
    return { style: (await r.json()) as StyleSpecification, basemap: true };
  } catch {
    return { style: FALLBACK_STYLE, basemap: false };
  }
}

export default function RailMap({ year, towns, selectedTownId, onTownClick, onSegmentClick, operatorFilter = "",
  showModern = false, height = "70vh", interactive = true, focus }: Props) {
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
      const { style, basemap } = await loadBaseStyle();
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
          map.addLayer({ id: "counties-line", type: "line", source: "counties", paint: { "line-color": "#8a7f6c", "line-width": 0.4, "line-opacity": basemap ? 0.45 : 0.7 } });
          map.addSource("modern", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "modern-line", type: "line", source: "modern", layout: { visibility: "none" }, paint: { "line-color": "#4a5866", "line-width": 1.1, "line-opacity": 0.8 } });
          map.addSource("rail", { type: "geojson", data: "/data/rail_atack.geojson" });
          map.addLayer({ id: "rail-future", type: "line", source: "rail", paint: { "line-color": "#b8ad99", "line-width": 0.6, "line-opacity": 0.35, "line-dasharray": [2, 2] } });
          map.addLayer({ id: "rail-old", type: "line", source: "rail", paint: { "line-color": "#24211d", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 9, 2.4] } });
          map.addLayer({ id: "rail-new", type: "line", source: "rail", paint: { "line-color": "#a85a32", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 3.4] } });
          map.addLayer({ id: "rail-hit", type: "line", source: "rail", paint: { "line-color": "#000", "line-width": 10, "line-opacity": 0 } });
          map.addSource("towns", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "towns-pt", type: "circle", source: "towns", paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["==", ["get", "sel"], 1], 7, 2.6], 10, ["case", ["==", ["get", "sel"], 1], 11, 6]],
            "circle-color": ["case", ["==", ["get", "sel"], 1], "#8f2b21", ["==", ["get", "served"], 1], "#f5f0e6", "#5b7262"],
            "circle-stroke-color": ["case", ["==", ["get", "sel"], 1], "#fff", "#24211d"],
            "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 2, 1],
          } });
          map.addLayer({ id: "towns-label", type: "symbol", source: "towns", minzoom: 7, layout: {
            "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true,
            ...(basemap ? { "text-font": ["Noto Sans Regular"] } : {}) },
            paint: { "text-color": "#24211d", "text-halo-color": "#fbf8f2", "text-halo-width": 1.2 } });
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
  }, [interactive]);

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
    <div className="relative w-full rounded-lg overflow-hidden border border-rule bg-sand" style={{ height }}>
      <div ref={ref} className="absolute inset-0" data-testid="rail-map" data-ready={ready ? "1" : "0"} aria-label="Interactive map of historical Texas railroads and towns" role="region" />
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-muted text-sm" aria-live="polite">Loading map and railroad layers…</div>
      )}
      {error && <div role="alert" className="absolute top-3 left-3 right-3 bg-rail text-cream text-sm px-3 py-2 rounded">{error}</div>}
      {basemap === false && ready && (
        <div className="absolute bottom-2 left-2 bg-cream/90 text-[11px] text-muted px-2 py-1 rounded">Reference basemap unavailable — showing county boundaries only.</div>
      )}
    </div>
  );
}
