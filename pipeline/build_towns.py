"""Build the analytical town table: geolocate reconciled census places and attach modern counts.

Town inclusion criteria (documented in Methodology):
  1. Listed as an incorporated place in at least one digitized census table (1910-1970);
     places marked unincorporated '(U)' are excluded.
  2. At least one population observation of quality A or B.
  3. Geolocated by an exact normalised-name match within the same county to either a 2020 Census
     place (preferred) or a USGS GNIS populated place. Fuzzy OCR names were snapped to gazetteer
     spellings during reconciliation; anything else is excluded and logged with a reason.
"""
from __future__ import annotations
import json, re
import numpy as np
import pandas as pd
from common import INTERIM, PROCESSED, METADATA

YEARS = [1890, 1900, 1910, 1930, 1940, 1950, 1960, 1970]


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    obs = pd.read_csv(PROCESSED / "population_observations_ocr.csv")
    gz = pd.read_csv(INTERIM / "gazetteer.csv", dtype={"gaz_id": str})
    modern = pd.read_csv(INTERIM / "modern_place_population.csv", dtype={"place_fips": str})
    good = obs[obs.quality.isin(["A", "B"])]
    places = obs.groupby("pid").agg(key=("key", "first"), county=("county", "first"), ocr_name=("name", "first")).reset_index()
    places["n_ab"] = places.pid.map(good.groupby("pid").size()).fillna(0).astype(int)
    excluded = []
    rows = []
    for _, p in places.iterrows():
        if p.n_ab == 0:
            excluded.append({"pid": p.pid, "name": p.ocr_name, "county": p.county, "reason": "no observation of quality A or B"})
            continue
        if not isinstance(p.county, str):
            excluded.append({"pid": p.pid, "name": p.ocr_name, "county": None, "reason": "county could not be read"})
            continue
        cand = gz[(gz.norm == p.key) & (gz.county == p.county)]
        c20 = cand[cand.gaz_source == "census2020_place"]
        gn = cand[cand.gaz_source == "usgs_gnis"]
        # Coordinates: GNIS populated-place point (historic town centre) preferred, because 2020
        # place polygons of large cities extend far beyond the historic townsite; the 2020 census
        # place is still used to link 2010/2020 counts.
        if len(gn):
            gn = gn.sort_values("gnis_historical")  # prefer a current GNIS feature
            g = gn.iloc[0]; how = "USGS GNIS populated place, exact name in county"
        elif len(c20):
            g = c20.iloc[0]; how = "2020 Census place internal point, exact name in county (no GNIS match)"
        else:
            excluded.append({"pid": p.pid, "name": p.ocr_name, "county": p.county, "reason": "no gazetteer match in county"})
            continue
        place = c20.iloc[0].gaz_id if len(c20) else None
        rows.append({"pid": p.pid, "name": (c20.iloc[0]["name"] if len(c20) else g["name"]).replace(" (historical)", ""),
                     "county": p.county, "lat": g.lat, "lon": g.lon,
                     "coord_source": g.gaz_source, "gaz_id": g.gaz_id, "coord_match": how, "census2020_place": place,
                     "gnis_historical": bool(g.get("gnis_historical")) if g.gaz_source == "usgs_gnis" else False})
    towns = pd.DataFrame(rows)
    # de-duplicate: two OCR identities snapping to the same gazetteer feature are merged downstream
    towns["id"] = (towns.name.map(slug) + "-" + towns.county.map(slug))
    dup = towns[towns.duplicated("id", keep=False)]
    pid_map = {pid: tid for pid, tid in zip(towns.pid, towns.id)}
    towns = towns.drop_duplicates("id")
    m = modern.set_index("place_fips")
    towns["pop2020"] = towns.census2020_place.map(m.pop2020)
    towns["pop2010"] = towns.census2020_place.map(pd.to_numeric(m.pop2010, errors="coerce"))

    # long observation table keyed by town id; when merged identities give two values, keep the better grade
    o = obs[obs.pid.isin(pid_map)].copy()
    o["id"] = o.pid.map(pid_map)
    o["qrank"] = o.quality.map({"A": 0, "B": 1, "C": 2})
    o = o.sort_values(["id", "year", "qrank"]).drop_duplicates(["id", "year"])
    o = o.drop(columns=["qrank"])
    o.to_csv(PROCESSED / "population_observations.csv", index=False)

    wide = o[o.quality.isin(["A", "B"])].pivot(index="id", columns="year", values="population")
    qual = o.pivot(index="id", columns="year", values="quality")
    for y in YEARS:
        towns[f"pop{y}"] = towns.id.map(wide[y]) if y in wide else np.nan
        towns[f"q{y}"] = towns.id.map(qual[y]) if y in qual else None
    towns["persisted_2020"] = towns.census2020_place.notna()
    towns.to_csv(PROCESSED / "towns.csv", index=False)
    pd.DataFrame(excluded).to_csv(METADATA / "town_exclusions.csv", index=False)
    summary = {"candidate_identities": int(len(places)), "towns_included": int(len(towns)), "excluded": int(len(excluded)),
               "exclusion_reasons": pd.DataFrame(excluded).reason.value_counts().to_dict() if excluded else {},
               "merged_duplicate_identities": int(len(dup)),
               "coord_sources": towns.coord_source.value_counts().to_dict(),
               "persisted_2020": int(towns.persisted_2020.sum())}
    (METADATA / "town_build_summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1))
    print(towns[[f"pop{y}" for y in YEARS] + ["pop2010", "pop2020"]].notna().sum())


if __name__ == "__main__":
    main()
