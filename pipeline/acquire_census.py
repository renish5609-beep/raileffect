"""Download every public Census Bureau file the pipeline uses (scanned volumes, TIGER, gazetteers,
2010/2020 counts, Tesseract models) into data/raw, logging URL, time and SHA-256."""
from common import RAW, download

B = "https://www2.census.gov/library/publications/decennial/"
FILES = {
    "census/1910_volume-3_volume-3-p7.pdf": B + "1910/volume-3/volume-3-p7.pdf",
    "census/c1940_ch09.pdf": B + "1940/population-volume-1/33973538v1ch09.pdf",
    "census/1950_population-volume-1_vol-01-46.pdf": B + "1950/population-volume-1/vol-01-46.pdf",
    "census/33255142v1p45ch02.pdf": B + "1960/population-volume-1/33255142v1p45ch02.pdf",
    "census/00496492v1p45s1ch02.pdf": B + "1970/population-volume-1/00496492v1p45s1ch02.pdf",
    "census/1900_volume-1-p8.pdf": B + "1900/volume-1/volume-1-p8.pdf",
    "tiger/cb_2020_us_state_500k.zip": "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip",
    "tiger/cb_2020_us_county_500k.zip": "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_500k.zip",
    "tiger/cb_2020_48_place_500k.zip": "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_48_place_500k.zip",
    "tiger/2020_Gaz_counties_national.zip": "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.zip",
    "tiger/tl_2020_us_rails.zip": "https://www2.census.gov/geo/tiger/TIGER2020/RAILS/tl_2020_us_rails.zip",
    "tiger/tl_2020_us_primaryroads.zip": "https://www2.census.gov/geo/tiger/TIGER2020/PRIMARYROADS/tl_2020_us_primaryroads.zip",
    "census_api/tx2020.pl.zip": "https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Texas/tx2020.pl.zip",
    "census_api/sub-est00int.csv": "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/cities/sub-est00int.csv",
    "gnis/DomesticNames_TX_Text.zip": "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_TX_Text.zip",
    "tessdata/best/eng.traineddata": "https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/eng.traineddata",
    "tessdata/legacy/eng.traineddata": "https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/eng.traineddata",
}

if __name__ == "__main__":
    import zipfile
    for rel, url in FILES.items():
        p = download(url, RAW / rel, "acquire_census", "")
        print("ok", rel)
    z = RAW / "gnis" / "DomesticNames_TX_Text.zip"
    zipfile.ZipFile(z).extractall(RAW / "gnis")
