# Data provenance

Every downloaded input is recorded in `data/metadata/acquisition_log.json` with URL, access time (UTC), byte size and SHA-256.

| Input | Source | Terms | In repository |
|---|---|---|---|
| Railroad GIS 1826–1911 | Atack, J. (2016) RR1826-1911Modified050916; author page https://my.vanderbilt.edu/jeremyatack/data-downloads/ ; ICPSR 36353. Retrieved from a public ArcGIS Online copy of the identical layer (78,832 features) because the author page was unreachable from the build environment. | Research dataset, cite the author | No raw/full-resolution data. Simplified (25 m) Texas display geometry in `public/data/rail_atack.geojson`, edge attribute table without geometry in downloads. |
| 1910 Vol. III Table 2; 1940 Vol. I Table 5; 1950 Vol. I Table 7; 1960 Vol. I Pt 45 Table 8; 1970 Vol. I Pt 45 Table 6 | U.S. Census Bureau, www2.census.gov/library/publications/decennial/ | Public domain | OCR outputs (derived) only |
| 2010, 2020 counts | Census intercensal city file; 2020 PL 94-171 Texas | Public domain | Derived counts |
| TIGER/Line 2020 rails, primary roads; 2020 cartographic places, counties, state | U.S. Census Bureau | Public domain | Derived Texas extracts |
| GNIS Domestic Names, Texas | USGS | Public domain | Derived coordinates |
| Tesseract models | tesseract-ocr/tessdata_best, tessdata (GitHub) | Apache-2.0 | No |
| Historical railroad maps (LOC 1873–1926; TSLAC 1881/1908/1932) | Library of Congress; Texas State Library | See holders | Links only; not digitised |

Sources examined but not used (UNL Railroads and the Making of Modern America GIS, IPUMS NHGIS, Texas Almanac, Handbook of Texas, Portal to Texas History, Wikipedia) are listed with reasons on the Methodology page and in `public/data/sources.json`.

## Population grades
* Grade A: the same count read from two independent printings; or visually verified against the page image (`data/metadata/visual_verification.csv`); or official digital count.
* Grade B: single printing, ≥4 of 5 OCR readings agree.
* Grade C: everything else. Retained for transparency; excluded from models.

Validation sample (seed 7): `data/metadata/validation_sample_results.csv`, summary in `validation_summary.json`.
