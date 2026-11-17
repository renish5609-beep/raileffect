"""Reference gazetteer used to geolocate historical census places.

Two public-domain sources, kept separate so every coordinate records where it came from:
  1. 2020 Census cartographic boundary places (TIGER/GENZ2020) - internal point of the 2020 place
     polygon + county by spatial join. Used for places that still exist as census places.
  2. USGS GNIS Domestic Names (Texas) - 'Populated Place' features, including those GNIS marks
     '(historical)'. Used for places with no 2020 census-place match.
"""
from __future__ import annotations
import re, unicodedata
import geopandas as gpd
import pandas as pd
from common import RAW, INTERIM, TX_CRS, WGS84


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = s.lower().replace("(historical)", "")
    s = re.sub(r"\b(city|town|village|cdp)\b$", "", s.strip())
    s = re.sub(r"\bst\.?\s", "saint ", s)
    s = re.sub(r"\bft\.?\s", "fort ", s)
    s = re.sub(r"\bmt\.?\s", "mount ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main():
    co = gpd.read_parquet(INTERIM.parent / "processed" / "texas_counties.parquet")
    pl = gpd.read_file("zip://" + str(RAW / "tiger" / "cb_2020_48_place_500k.zip")).to_crs(TX_CRS)
    pts = pl.copy()
    pts["geometry"] = pl.representative_point()
    pts = gpd.sjoin(pts, co[["NAME", "geometry"]].rename(columns={"NAME": "county"}), how="left", predicate="within")
    ll = pts.to_crs(WGS84)
    census = pd.DataFrame({
        "gaz_source": "census2020_place", "gaz_id": "48" + pl.PLACEFP, "name": pl.NAME, "lsad": pl.LSAD,
        "county": pts.county.values, "lat": ll.geometry.y.round(5), "lon": ll.geometry.x.round(5)})
    census["norm"] = census.name.map(norm)

    g = pd.read_csv(RAW / "gnis" / "Text" / "DomesticNames_TX.txt", sep="|", dtype=str, encoding="utf-8-sig")
    g = g[(g.feature_class == "Populated Place") & (g.state_name == "Texas")]
    gnis = pd.DataFrame({
        "gaz_source": "usgs_gnis", "gaz_id": "gnis-" + g.feature_id, "name": g.feature_name, "lsad": "",
        "county": g.county_name, "lat": g.prim_lat_dec.astype(float).round(5), "lon": g.prim_long_dec.astype(float).round(5),
        "gnis_historical": g.feature_name.str.contains(r"\(historical\)", regex=True)})
    gnis = gnis[(gnis.lat != 0) & gnis.lat.notna()]
    gnis["norm"] = gnis.name.map(norm)
    out = pd.concat([census, gnis], ignore_index=True)
    out.to_csv(INTERIM / "gazetteer.csv", index=False)
    print(len(census), "census places;", len(gnis), "GNIS populated places")


if __name__ == "__main__":
    main()
