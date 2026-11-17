"""Official 2010 and 2020 census counts for Texas places (Census Bureau bulk files; no API key needed)."""
import zipfile, io
import pandas as pd
from common import RAW, INTERIM, log_acquisition

D = RAW / "census_api"


def pl2020() -> pd.DataFrame:
    z = zipfile.ZipFile(D / "tx2020.pl.zip")
    geo_rows = []
    with z.open("txgeo2020.pl") as f:
        for line in io.TextIOWrapper(f, encoding="latin-1"):
            p = line.rstrip("\n").split("|")
            if p[2] == "160" and p[4] == "00":
                geo_rows.append({"LOGRECNO": p[7], "GEOID": p[8], "place_fips": p[8][-7:], "NAME": p[87], "FUNCSTAT": p[40] if len(p) > 40 else ""})
    geo = pd.DataFrame(geo_rows)
    keep = set(geo.LOGRECNO)
    rows = []
    with z.open("tx000012020.pl") as f:
        for line in io.TextIOWrapper(f, encoding="latin-1"):
            p = line.split("|", 6)
            if p[4] in keep:
                rows.append({"LOGRECNO": p[4], "pop2020": int(p[5])})
    return geo.merge(pd.DataFrame(rows), on="LOGRECNO")


def est2010() -> pd.DataFrame:
    d = pd.read_csv(D / "sub-est00int.csv", dtype=str, encoding="latin-1")
    d = d[(d.STATE == "48") & (d.SUMLEV == "162")]
    d["place_fips"] = "48" + d.PLACE
    return d[["place_fips", "NAME", "CENSUS2010POP"]].rename(columns={"CENSUS2010POP": "pop2010", "NAME": "name2010"})


if __name__ == "__main__":
    log_acquisition("census_pl_2020", "https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Texas/tx2020.pl.zip", D / "tx2020.pl.zip", "2020 Census Redistricting Data (P.L. 94-171), Texas")
    log_acquisition("census_intercensal_2000_2010_places", "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/cities/sub-est00int.csv", D / "sub-est00int.csv", "Intercensal estimates file; CENSUS2010POP column = official 2010 census count")
    a = pl2020()
    b = est2010()
    m = a.merge(b, on="place_fips", how="left")
    m.to_csv(INTERIM / "modern_place_population.csv", index=False)
    print(len(a), "places 2020;", m.pop2010.notna().sum(), "with 2010")
    print(m.head())
