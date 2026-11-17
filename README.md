# RailEffect

**Live site:** https://raileffect-fpv1.vercel.app

**Did railroads influence which Texas towns survived, grew, declined or disappeared?**

RailEffect is an open-source computational-history platform. It links Jeremy Atack's historical railroad GIS (1826–1911) to Texas town populations that this project digitised from scanned U.S. Census volumes (1910–1970), verified by agreement across independently printed volumes, and joined to official 2010/2020 counts. It then tests whether early rail access predicts later growth, with the analysis set up so that a null result can be reported.

* 974 towns located and analysed
* 5,147 Atack track segments in Texas across 11 benchmark maps (1861–1911), plus the 2020 network
* 5,162 population values of grade A or B; main regression sample n = 455
* Three model families (descriptive, multivariate regression, panel/matching) and 12 robustness checks
* Research report: [`report/raileffect_report.md`](report/raileffect_report.md)

> Current finding: rail-served towns grew faster from 1940 to 2020 in raw comparisons, but conditional on 1940 size and location the difference is not distinguishable from zero. Proximity to 1910 hub cities and to the later Interstate network is more strongly associated with growth. These are associations in a sample of already-incorporated towns, not causal estimates. See the report and `/lab` on the site.

## Site

| Route | Purpose |
|---|---|
| `/` | Research question and headline result |
| `/explorer` | MapLibre explorer of documented network snapshots, segment provenance, town search |
| `/towns`, `/towns/[id]` | Town index and profiles with page-level census citations |
| `/compare` | Two towns side by side |
| `/lab` | Model A/B/C results, diagnostics, robustness |
| `/findings` | Dashboard of computed statistics with filters |
| `/case-studies` | Rule-selected paired comparisons |
| `/methodology`, `/data` | Transparency portal, downloads, data dictionary, corrections |

The site is a static Next.js 15 (App Router, TypeScript, Tailwind CSS 4) build that reads `public/data`. No server-side Python runs on Vercel.

## Quick start (web)

```bash
npm ci
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e   # Playwright, desktop + mobile
```

## Reproducing the research pipeline

Requirements: Python 3.11+, `pip install -r pipeline/requirements.txt`, Tesseract 5 and poppler-utils.

```bash
make acquire    # download Census volumes, TIGER, GNIS, 2010/2020 counts, OCR models
cd pipeline && python3 acquire_railroads.py && cd ..   # Atack layer (see provenance)
make ocr        # OCR five census tables, reconcile, geolocate towns
make analysis   # accessibility metrics + statistical models
make web report # export site data, figures and report
make test       # pytest data validation + vitest
```

Order of scripts: `acquire_census.py → acquire_railroads.py → process_railroads.py → build_network.py → modern_population.py → build_gazetteer.py → run_ocr_all.sh (extract_census.py) → reconcile_population.py → build_towns.py → compute_accessibility.py → fit_models.py → export_web_data.py → make_report.py`. `validation_sample.py` draws the visual-check sample.

## Repository layout

```
pipeline/          Python research pipeline and tests (pipeline/tests)
data/processed/    Derived analytical tables (CSV/Parquet)
data/metadata/     Acquisition log, verification files, exclusions, summaries
public/data/       Web-ready JSON/GeoJSON;  public/downloads/ research downloads
report/            Research report and generated figures
src/               Next.js application;  tests/ unit (vitest) and e2e (Playwright)
docs/              Data provenance and known limitations
```

## Data provenance and licensing

See [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md). Code: MIT. Project-derived data: CC BY 4.0. Census, TIGER and GNIS inputs are U.S. public domain. Atack's railroad GIS is a third-party research dataset: raw and full-resolution derived geometries are **not** committed; the site displays simplified Texas geometry with attribution.

## Known limitations

See [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) and the Methodology page.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Historical corrections go through GitHub issue forms (*Data correction*, *Source contribution*).

No institutional affiliation, partnership or peer review is claimed.
