"""Export validated, application-ready artifacts to public/data and public/downloads.

Every headline number shown on the website is computed here from the analytical data."""
from __future__ import annotations
import json, math, re, shutil
import numpy as np
import pandas as pd
import geopandas as gpd
from common import PROCESSED, METADATA, WEB, ROOT, TX_CRS, WGS84
from extract_census import SPECS

DL = ROOT / "public" / "downloads"
DL.mkdir(parents=True, exist_ok=True)
THR = 2.0
TABLES = {s["id"]: {"title": s["title"], "url": s["url"]} for s in SPECS}
TABLES["official_2010"] = {"title": "U.S. Census Bureau, 2010 Census count (CENSUS2010POP), intercensal city file sub-est00int.csv",
                           "url": "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/cities/sub-est00int.csv"}
TABLES["official_2020"] = {"title": "U.S. Census Bureau, 2020 Census Redistricting Data (P.L. 94-171), Texas, table P1",
                           "url": "https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Texas/tx2020.pl.zip"}


def clean(v):
    if v is None:
        return None
    if isinstance(v, (np.floating, float)):
        return None if (math.isnan(v) or math.isinf(v)) else round(float(v), 4)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def write(name, obj):
    (WEB / name).write_text(json.dumps(obj, separators=(",", ":"), default=clean))


def geo_exports():
    segs = gpd.read_parquet(PROCESSED / "rail_segments.parquet")
    tx = segs[segs.in_texas].copy()
    tx["geometry"] = tx.geometry.simplify(25)
    tx = tx.to_crs(WGS84)
    feats = []
    for _, r in tx.iterrows():
        coords = [[round(x, 5), round(y, 5)] for x, y in r.geometry.coords]
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                      "properties": {"id": r.segment_id, "y": int(r.in_op_by), "a": None if pd.isna(r.opened_after) else int(r.opened_after),
                                     "rr": r.rr_name or "", "km": round(float(r.length_km), 2), "fid": int(r.FID)}})
    (WEB / "rail_atack.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))
    m = gpd.read_parquet(PROCESSED / "rail_tiger2020_tx.parquet")
    m["geometry"] = m.geometry.simplify(40)
    m = m.to_crs(WGS84)
    mf = []
    for _, r in m.iterrows():
        geoms = [r.geometry] if r.geometry.geom_type == "LineString" else list(r.geometry.geoms)
        for gg in geoms:
            mf.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[round(x, 5), round(y, 5)] for x, y in gg.coords]},
                       "properties": {"n": r.FULLNAME or "", "km": round(float(r.length_km), 2)}})
    (WEB / "rail_tiger2020.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": mf}, separators=(",", ":")))
    co = gpd.read_parquet(PROCESSED / "texas_counties.parquet")
    co["geometry"] = co.geometry.simplify(400)
    co = co.to_crs(WGS84)
    (WEB / "counties.geojson").write_text(co[["NAME", "geometry"]].to_json(drop_id=True))
    return segs, tx


def main():
    segs, txsegs = geo_exports()
    d = pd.read_csv(PROCESSED / "analysis_dataset.csv")
    o = pd.read_csv(PROCESSED / "population_observations.csv")
    models = json.loads((PROCESSED / "models.json").read_text())
    netsum = json.loads((METADATA / "network_summary.json").read_text())
    rsum = json.loads((METADATA / "railroad_processing_summary.json").read_text())
    years = sorted(int(y) for y in segs.in_op_by.unique())

    towns = []
    for _, t in d.iterrows():
        obs = o[o.id == t.id].sort_values("year")
        pops = []
        for _, r in obs.iterrows():
            readings = json.loads(r.readings) if isinstance(r.readings, str) else []
            pops.append({"year": int(r.year), "pop": clean(r.population), "status": "observed", "quality": r.quality,
                         "sources": [s for s in str(r.sources).split(";") if s], "readings": readings, "note": r.note})
        for y, col, src in ((2010, "pop2010", "official_2010"), (2020, "pop2020", "official_2020")):
            if pd.notna(t[col]):
                pops.append({"year": y, "pop": int(t[col]), "status": "observed", "quality": "A", "sources": [src], "readings": [],
                             "note": "official machine-readable census count"})
        rail = [{"year": y, "dist_km": clean(t[f"dist_{y}"]), "served": bool(t[f"dist_{y}"] <= THR)} for y in years if y >= 1861]
        rail.append({"year": 2020, "dist_km": clean(t.dist_2020), "served": bool(t.dist_2020 <= THR)})
        fs = None if pd.isna(t.first_served) else int(t.first_served)
        A = {p["year"]: p["pop"] for p in pops if p["quality"] == "A" and p["pop"]}
        peak = max(A.items(), key=lambda kv: kv[1]) if A else None
        flags = []
        if t.coord_source == "census2020_place":
            flags.append("coordinates from 2020 census place internal point (no GNIS match)")
        if not t.persisted_2020:
            flags.append("not a census place in 2020 (may have disincorporated, merged, or been renamed)")
        if t.gnis_historical:
            flags.append("GNIS lists this populated place as historical")
        towns.append({
            "id": t.id, "name": t["name"], "county": t.county, "lat": round(t.lat, 5), "lon": round(t.lon, 5),
            "coord_source": t.coord_source, "gaz_id": str(t.gaz_id), "coord_match": t.coord_match,
            "census2020_place": None if pd.isna(t.census2020_place) else str(int(t.census2020_place)) if str(t.census2020_place).replace('.0','').isdigit() else str(t.census2020_place),
            "pops": pops, "pop2010": clean(t.pop2010), "pop2020": clean(t.pop2020), "rail": rail,
            "first_served_benchmark": fs,
            "arrival_interval": None if fs is None else [None if pd.isna(t.opened_after) else int(t.opened_after), fs],
            "served_2020": bool(t.dist_2020 <= THR),
            "metrics": {"hub_net_km_1911": clean(t.hub_net_km_1911), "betweenness_1911": clean(t.betweenness_1911),
                        "node_degree_1911": clean(t.node_degree_1911), "main_component_1911": None if pd.isna(t.main_comp_1911) else bool(t.main_comp_1911 in (True, "True", 1)),
                        "hub_net_km_1889": clean(t.hub_net_km_1889), "dist_interstate_km": clean(t.dist_interstate_km)},
            "outcomes": {"growth_1940_1960": clean(t.g40_60), "growth_1940_2020": clean(t.g40_20), "growth_1960_2020": clean(t.g60_20),
                         "persisted_2020": bool(t.persisted_2020), "peak_year": peak[0] if peak else None,
                         "declined_from_peak_pct": None if not peak or 2020 not in A else round(100 * (1 - A[2020] / peak[1]), 1)},
            "zone": t.zone, "era": t.era, "flags": flags,
        })
    write("towns.json", towns)
    tdir = WEB / "towns"
    tdir.mkdir(exist_ok=True)
    for t in towns:
        (tdir / f"{t['id']}.json").write_text(json.dumps(t, separators=(",", ":"), default=clean))
    idx = []
    for t in towns:
        A = {p["year"]: p["pop"] for p in t["pops"] if p["quality"] in ("A",)}
        idx.append({"id": t["id"], "name": t["name"], "county": t["county"], "lat": t["lat"], "lon": t["lon"],
                    "firstServed": t["first_served_benchmark"], "served1911": any(r["year"] == 1911 and r["served"] for r in t["rail"]),
                    "served2020": t["served_2020"], "pop1910": A.get(1910), "pop1940": A.get(1940), "pop1960": A.get(1960),
                    "pop2020": t["pop2020"], "g4020": t["outcomes"]["growth_1940_2020"], "zone": t["zone"], "era": t["era"],
                    "persisted": t["outcomes"]["persisted_2020"]})
    write("towns_index.json", idx)

    # ---------------- case studies (selected by documented, data-driven rules)
    cases = select_cases(d)
    write("case_studies.json", cases)

    # ---------------- summary
    q = o.groupby(["year", "quality"]).size().unstack(fill_value=0)
    obs_ab = int(o[o.quality.isin(["A", "B"])].shape[0])
    summary = {
        "towns_analyzed": len(towns),
        "towns_in_regression_sample": models["model_b"]["models"][0]["n"],
        "candidate_census_identities": int(json.loads((METADATA / "town_build_summary.json").read_text())["candidate_identities"]),
        "rail_segments_texas": int(rsum["segments_intersecting_texas"]),
        "rail_segments_study_area": int(rsum["segments_after_cleaning"]),
        "rail_segments_with_operator": int(rsum["segments_with_operator_name"]),
        "benchmark_years": [y for y in years if y >= 1861],
        "texas_track_km_by_benchmark": rsum["texas_track_km_by_benchmark"],
        "tiger2020_features": rsum["tiger2020_features"], "tiger2020_km": rsum["tiger2020_km"],
        "population_observations_total": int(len(o)) + int(d.pop2010.notna().sum() + d.pop2020.notna().sum()),
        "population_observations_ab": obs_ab + int(d.pop2010.notna().sum() + d.pop2020.notna().sum()),
        "observations_by_year_quality": {str(int(y)): {k: int(v) for k, v in r.items()} for y, r in q.iterrows()},
        "official_counts": {"2010": int(d.pop2010.notna().sum()), "2020": int(d.pop2020.notna().sum())},
        "served1911_share": round(float((d.dist_1911 <= THR).mean()), 4),
        "served2020_share": round(float((d.dist_2020 <= THR).mean()), 4),
        "lost_rail_by_2020": int(((d.dist_1911 <= THR) & (d.dist_2020 > THR)).sum()),
        "persisted_2020": int(d.persisted_2020.sum()),
        "network": netsum["snapshots"], "network_audit": netsum["audit"], "snap_tolerance_m": netsum["snap_tolerance_m"],
        "missing": {str(y): round(1 - float(d[f"pop{y}"].notna().mean()), 4) for y in (1890, 1900, 1910, 1930, 1940, 1950, 1960, 1970)},
        "missing_A": {str(y): round(1 - float(d[f"popA{y}"].notna().mean()), 4) if f"popA{y}" in d else None for y in (1890, 1900, 1910, 1940, 1950, 1960)},
        "headline": {"diff_mean_g40_20": models["model_a"]["diff_mean_g40_20"],
                     "b1_served1911": [t for t in models["model_b"]["models"][0]["terms"] if t["term"] == "served1911"][0],
                     "panel_switchers": models["model_c"]["panel_1890_1910"]["n_switchers"]},
        "zones": d.zone.value_counts().to_dict(),
        "validation": json.loads((METADATA / "validation_summary.json").read_text()),
        "visual_verified": int(len(pd.read_csv(METADATA / "visual_verification.csv"))),
        "hubs": json.loads((METADATA / "accessibility_summary.json").read_text())["hubs"],
        "growth_hist": hist(d, "g40_20"),
        "arrival_counts": d.first_served.value_counts().sort_index().rename(lambda x: str(int(x))).to_dict(),
    }
    write("summary.json", summary)
    write("models.json", models)
    write("sources.json", sources())

    # ---------------- downloads
    cols = ["id", "name", "county", "lat", "lon", "coord_source", "gaz_id", "census2020_place", "persisted_2020", "zone",
            "first_served", "opened_after", "era", "served1911", "served2020", "lost_rail", "dist_1872", "dist_1881", "dist_1889",
            "dist_1898", "dist_1911", "dist_2020", "hub_net_km_1889", "hub_net_km_1911", "betweenness_1911", "node_degree_1911",
            "dist_interstate_km", "popA1890", "popA1900", "popA1910", "popA1940", "popA1950", "popA1960", "pop2010", "pop2020",
            "g40_60", "g40_20", "g60_20"]
    d[[c for c in cols if c in d]].to_csv(DL / "raileffect_towns_analysis.csv", index=False)
    oo = o.merge(d[["id", "name", "county"]], on="id", suffixes=("_ocr", ""))
    oo[["id", "name", "county", "year", "population", "quality", "note", "sources", "readings"]].to_csv(DL / "raileffect_population_observations.csv", index=False)
    s = gpd.read_parquet(PROCESSED / "rail_segments.parquet")
    s = s[s.in_texas]
    pd.DataFrame({"segment_id": s.segment_id, "atack_fid": s.FID, "in_op_by": s.in_op_by, "opened_after": s.opened_after,
                  "rr_name": s.rr_name, "length_km": s.length_km.round(3), "node_u": s.node_u, "node_v": s.node_v}).to_csv(DL / "raileffect_network_edges_texas.csv", index=False)
    shutil.copy(METADATA / "town_exclusions.csv", DL / "raileffect_town_exclusions.csv")
    shutil.copy(PROCESSED / "models.json", DL / "raileffect_model_results.json")
    print("towns", len(towns), "cases", len(cases))


def hist(d, col, bins=np.arange(-2.5, 4.01, 0.25)):
    out = {}
    for k, g in d.groupby(d.served1911.map({1: "served", 0: "not_served"})):
        x = g[col].dropna().clip(bins[0], bins[-1] - 1e-9)
        c, _ = np.histogram(x, bins=bins)
        out[k] = c.tolist()
    out["bins"] = [round(float(b), 2) for b in bins]
    return out


def select_cases(d):
    """Case-study selection rules (stated on the site):
    1. Same-county pair founded/served in the same benchmark interval, similar 1910 size, divergent later growth.
    2. Pair within 60 km with similar A-grade 1940 population, one rail-served by 1911 and one not.
    3. Pair within 60 km, both served by 1911, similar 1940 population, one retaining track within 2 km in 2020 and one not.
    4. Pair within 80 km, similar 1940 population, earliest (by 1872) vs latest (1890-1911) arrival.
    Among eligible pairs the pair with the smallest relative difference in baseline population is chosen."""
    from math import radians, sin, cos, asin, sqrt

    def km(a, b):
        la1, lo1, la2, lo2 = map(radians, (a.lat, a.lon, b.lat, b.lon))
        h = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
        return 6371 * 2 * asin(sqrt(h))
    base = d[d.popA1940.notna() & d.g40_20.notna()]

    def best_pair(A, B, maxkm, popcol="popA1940"):
        best = None
        for _, a in A.iterrows():
            for _, b in B.iterrows():
                if a.id == b.id:
                    continue
                dist = km(a, b)
                if dist > maxkm:
                    continue
                rel = abs(math.log(a[popcol] / b[popcol]))
                if best is None or rel < best[0]:
                    best = (rel, a, b, dist)
        return best
    cases = []
    p = best_pair(base[base.served1911 == 1], base[base.served1911 == 0], 60)
    if p: cases.append(case_obj("served-vs-unserved", "A rail-served town and a nearby town without track by 1911", p, "rule 2"))
    s = base[base.served1911 == 1]
    p = best_pair(s[s.served2020 == 1], s[s.served2020 == 0], 60)
    if p: cases.append(case_obj("kept-vs-lost-track", "Two railroad towns: one kept its track, one lost it", p, "rule 3"))
    p = best_pair(base[base.era == "by 1872"], base[base.era == "1890-1911"], 80)
    if p: cases.append(case_obj("early-vs-late", "Early versus late railroad arrival", p, "rule 4"))
    g = d[d.county == "Grayson"]
    a, b = g[g.name == "Denison"], g[g.name == "Sherman"]
    if len(a) and len(b):
        cases.insert(0, case_obj("denison-sherman", "Denison and Sherman: neighbouring Grayson County towns served in the same interval",
                                 (0, a.iloc[0], b.iloc[0], km(a.iloc[0], b.iloc[0])), "rule 1"))
    return cases


def case_obj(cid, title, p, rule):
    _, a, b, dist = p

    def side(t):
        return {"id": t.id, "name": t["name"], "county": t.county, "first_served": None if pd.isna(t.first_served) else int(t.first_served),
                "served1911": int(t.served1911), "served2020": int(t.served2020), "dist_1911": clean(t.dist_1911), "dist_2020": clean(t.dist_2020),
                "pop1910": clean(t.popA1910), "pop1940": clean(t.popA1940), "pop1960": clean(t.popA1960), "pop2020": clean(t.pop2020),
                "g40_20": clean(t.g40_20), "hub_net_km_1911": clean(t.hub_net_km_1911), "dist_interstate_km": clean(t.dist_interstate_km),
                "node_degree_1911": clean(t.node_degree_1911)}
    return {"id": cid, "title": title, "selection_rule": rule, "distance_km": round(dist, 1), "a": side(a), "b": side(b)}


def sources():
    return {
        "census_tables": TABLES,
        "railroads": {
            "atack": {"citation": "Atack, Jeremy. 2016. Historical Geographic Information Systems (GIS) database of U.S. Railroads for 1826-1911 (file RR1826-1911Modified050916, revised May 2016).",
                      "original_page": "https://my.vanderbilt.edu/jeremyatack/data-downloads/",
                      "documentation": "https://cdn.vanderbilt.edu/t2-my/my-prd/wp-content/uploads/sites/133/2021/02/Creating-Historical-Transportation-Shapefiles-RevisedFeb2021.pdf",
                      "retrieved_from": "https://services1.arcgis.com/4yjifSiIG17X0gW4/ArcGIS/rest/services/RR1826_1911Modified0509161/FeatureServer/0",
                      "archive": "ICPSR 36353, doi:10.3886/ICPSR36353.v1 (Atack, Historical Transportation of Navigable Rivers, Canals, and Railroads in the United States)",
                      "note": "The Vanderbilt download page was not reachable from the build environment; features were read from a public ArcGIS Online copy of the same file (78,832 features, identical attribute schema). Users should obtain the original from the author's page for reuse; this project redistributes only simplified Texas geometries for display, with attribution."},
            "tiger2020": {"citation": "U.S. Census Bureau. TIGER/Line Shapefiles 2020: Rails (tl_2020_us_rails).", "url": "https://www2.census.gov/geo/tiger/TIGER2020/RAILS/"},
        },
        "gazetteers": {
            "gnis": {"citation": "U.S. Geological Survey, Geographic Names Information System, Domestic Names (Texas).", "url": "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_TX_Text.zip"},
            "census_places": {"citation": "U.S. Census Bureau, 2020 Cartographic Boundary Files: Places, Texas.", "url": "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_48_place_500k.zip"},
            "interstates": {"citation": "U.S. Census Bureau, TIGER/Line 2020 Primary Roads.", "url": "https://www2.census.gov/geo/tiger/TIGER2020/PRIMARYROADS/tl_2020_us_primaryroads.zip"},
        },
        "archival_maps": [
            {"title": "Railroad map of the state of Texas", "date": "1873", "holder": "Library of Congress, Geography and Map Division", "url": "https://www.loc.gov/item/2001622095/"},
            {"title": "Gray's railroad map of Texas", "date": "1877", "holder": "Library of Congress, Geography and Map Division", "url": "https://www.loc.gov/item/2003627049/"},
            {"title": "The railroad system of Texas on September 1st, 1883", "date": "1883", "holder": "Library of Congress, Geography and Map Division", "url": "https://www.loc.gov/item/2001622093/"},
            {"title": "Bissell's railway junction point map of Texas", "date": "1891", "holder": "Library of Congress, Geography and Map Division", "url": "https://www.loc.gov/item/2001622051/"},
            {"title": "Texas railroads", "date": "1900", "holder": "Library of Congress, Geography and Map Division", "url": "https://www.loc.gov/item/98688561/"},
            {"title": "Railroad map of Texas, 1926", "date": "1926", "holder": "Library of Congress, Geography and Map Division", "url": "https://www.loc.gov/item/2004629147/"},
            {"title": "Texas State Library and Archives Commission, map 00383 (1881 railroad map)", "date": "1881", "holder": "TSLAC", "url": "https://www.tsl.texas.gov/apps/arc/maps/maplookup/00383", "note": "Link supplied in the project brief; not accessible from the build environment and not digitized here."},
            {"title": "Texas State Library and Archives Commission, map 01038 (1908 railroad map)", "date": "1908", "holder": "TSLAC", "url": "https://www.tsl.texas.gov/apps/arc/maps/maplookup/01038", "note": "Link supplied in the project brief; not accessible from the build environment and not digitized here."},
            {"title": "Texas State Library and Archives Commission, map 01208 (1932 railroad map)", "date": "1932", "holder": "TSLAC", "url": "https://www.tsl.texas.gov/apps/arc/maps/index.php/maplookup/01208", "note": "Link supplied in the project brief; not accessible from the build environment and not digitized here."},
        ],
        "not_used": [
            {"source": "University of Nebraska-Lincoln, Railroads and the Making of Modern America GIS", "reason": "Host railroads.unl.edu was not reachable from the build environment; its national snapshots end in 1870/1861, before most Texas construction."},
            {"source": "IPUMS NHGIS", "reason": "Requires registration and an API key; no key was available. NHGIS does not publish incorporated-place counts for 1890-1970 as a harmonized time series in any case."},
            {"source": "Texas Almanac, TSHA Handbook of Texas, UNT Portal to Texas History, Wikipedia", "reason": "Not reachable from the build environment under its network policy. Town pages link to Handbook and Portal searches as further reading only; no facts were taken from them."},
            {"source": "Twelfth Census (1900) Vol. I Table 5 (minor civil divisions)", "reason": "OCR extraction attempted; place rows inside precinct listings could not be parsed reliably, so the table is not used."},
        ],
    }


if __name__ == "__main__":
    main()
