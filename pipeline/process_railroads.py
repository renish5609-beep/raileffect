"""Process historical (Atack 1826-1911) and modern (TIGER 2020) railroad geometries for Texas.

Outputs
  data/processed/rail_segments.parquet  - one row per Atack segment intersecting the study bbox
  data/processed/rail_tiger2020_tx.parquet - TIGER/Line 2020 rail features in Texas (+10 km)
  data/processed/texas_boundary.parquet, texas_counties.parquet
Snapshots: Atack's `InOpBy` is the benchmark year of the source map on which a segment first
appears as operating. A segment with InOpBy = Y is therefore known to be operating by Y and
(for Y > first benchmark) NOT shown on the previous benchmark map, so its opening date is
interval-censored in (previous benchmark, Y]. Network snapshots are cumulative sets InOpBy <= Y
and are only produced for benchmark years (no interpolated years).
"""
from __future__ import annotations
import json
import geopandas as gpd
import pandas as pd
from shapely.validation import make_valid
from common import RAW, PROCESSED, METADATA, TX_CRS, WGS84


def load_boundaries():
    st = gpd.read_file("zip://" + str(RAW / "tiger" / "cb_2020_us_state_500k.zip"))
    tx = st[st.STUSPS == "TX"].to_crs(TX_CRS)
    co = gpd.read_file("zip://" + str(RAW / "tiger" / "cb_2020_us_county_500k.zip"))
    co = co[co.STATEFP == "48"].to_crs(TX_CRS)
    return tx, co


def main():
    tx, co = load_boundaries()
    tx[["NAME", "geometry"]].to_parquet(PROCESSED / "texas_boundary.parquet")
    co[["GEOID", "NAME", "geometry"]].to_parquet(PROCESSED / "texas_counties.parquet")
    texas = tx.geometry.iloc[0]

    d = json.loads((RAW / "atack" / "rr1826_1911_texas_bbox.geojson").read_text())
    g = gpd.GeoDataFrame.from_features(d["features"], crs=WGS84).to_crs(TX_CRS)
    n0 = len(g)
    issues = []
    g["geometry"] = [make_valid(x) if x is not None and not x.is_valid else x for x in g.geometry]
    empty = g.geometry.is_empty | g.geometry.isna()
    for _, r in g[empty].iterrows():
        issues.append({"FID": int(r.FID), "reason": "empty or null geometry"})
    g = g[~empty].copy()
    g = g.explode(index_parts=False).reset_index(drop=True)
    g = g[g.geom_type == "LineString"].copy()
    g["length_km"] = g.length / 1000.0
    zero = g.length_km < 0.001
    for _, r in g[zero].iterrows():
        issues.append({"FID": int(r.FID), "reason": "zero-length segment"})
    g = g[~zero].copy()
    g["in_texas"] = g.intersects(texas)
    g["texas_km"] = g.geometry.intersection(texas).length / 1000.0
    g["rr_name"] = g.RRname.fillna("").str.strip()
    g["in_op_by"] = g.InOpBy.astype(int)
    years = sorted(g.in_op_by.unique())
    prev = {y: (years[i - 1] if i > 0 else None) for i, y in enumerate(years)}
    g["opened_after"] = g.in_op_by.map(prev)
    g["segment_id"] = ["atk-" + str(int(f)) + "-" + str(i) for i, f in enumerate(g.FID)]
    g = g[["segment_id", "FID", "FIDAll", "rr_name", "in_op_by", "opened_after", "track", "Gauge", "Edited",
           "length_km", "in_texas", "texas_km", "geometry"]]
    g.to_parquet(PROCESSED / "rail_segments.parquet")

    tex = g[g.in_texas]
    summary = {
        "source_features_in_bbox": n0,
        "segments_after_cleaning": int(len(g)),
        "segments_intersecting_texas": int(len(tex)),
        "texas_track_km_by_benchmark": {int(y): round(float(tex[tex.in_op_by <= y].texas_km.sum()), 1) for y in years},
        "new_texas_segments_by_benchmark": {int(y): int((tex.in_op_by == y).sum()) for y in years},
        "segments_with_operator_name": int((tex.rr_name != "").sum()),
        "benchmark_years": [int(y) for y in years],
        "excluded": issues,
    }

    # Modern TIGER/Line 2020 rail features (all MTFCC R1011 railroad features: main, spur, yard)
    rails = gpd.read_file("zip://" + str(RAW / "tiger" / "tl_2020_us_rails.zip"))
    rails = rails.to_crs(TX_CRS)
    buf = texas.buffer(10_000)
    rails = rails[rails.intersects(buf)].copy()
    rails["length_km"] = rails.length / 1000.0
    rails[["LINEARID", "FULLNAME", "MTFCC", "length_km", "geometry"]].to_parquet(PROCESSED / "rail_tiger2020_tx.parquet")
    summary["tiger2020_features"] = int(len(rails))
    summary["tiger2020_km"] = round(float(rails.length_km.sum()), 1)
    (METADATA / "railroad_processing_summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if k != "excluded"}, indent=1), "excluded:", len(issues))


if __name__ == "__main__":
    main()
