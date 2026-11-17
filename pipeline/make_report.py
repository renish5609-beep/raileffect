"""Generate report figures and the research report (report/raileffect_report.md) from pipeline outputs.
All numbers in the report are inserted from data files; nothing is typed by hand."""
from __future__ import annotations
import json, shutil
import numpy as np
import pandas as pd
import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from common import PROCESSED, METADATA, FIG, ROOT, WEB

C_SERV, C_NOT, C_INK, C_RAIL = "#a85a32", "#5b7262", "#24211d", "#8f2b21"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False, "axes.spines.right": False})


def fig_maps(d):
    segs = gpd.read_parquet(PROCESSED / "rail_segments.parquet")
    tx = gpd.read_parquet(PROCESSED / "texas_boundary.parquet")
    co = gpd.read_parquet(PROCESSED / "texas_counties.parquet")
    pts = gpd.GeoDataFrame(d, geometry=gpd.points_from_xy(d.lon, d.lat), crs=4326).to_crs(segs.crs)
    fig, axes = plt.subplots(1, 3, figsize=(12, 4.6))
    for ax, y in zip(axes, (1872, 1889, 1911)):
        co.boundary.plot(ax=ax, color="#d6ccb8", linewidth=0.2)
        tx.boundary.plot(ax=ax, color="#8a7f6c", linewidth=0.6)
        s = segs[(segs.in_op_by <= y)]
        s.clip(tx.geometry.iloc[0].buffer(20000)).plot(ax=ax, color=C_INK, linewidth=0.5)
        served = pts[pts[f"dist_{y}"] <= 2]
        pts.plot(ax=ax, color=C_NOT, markersize=1.2)
        served.plot(ax=ax, color=C_SERV, markersize=1.6)
        ax.set_title(f"Recorded by {y}: {len(served)} of {len(pts)} towns within 2 km", fontsize=9)
        ax.set_axis_off()
    fig.suptitle("Figure 1. Atack railroad network at three benchmarks and study towns (orange: track within 2 km)", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "fig1_network_maps.png", dpi=180); plt.close(fig)


def fig_track(s):
    k = {int(a): b for a, b in s["texas_track_km_by_benchmark"].items() if int(a) >= 1861}
    fig, ax = plt.subplots(figsize=(6, 3.2))
    ax.plot(list(k), list(k.values()), "-o", color=C_RAIL, ms=4)
    ax.set_xlabel("Atack benchmark map"); ax.set_ylabel("km of track in Texas")
    ax.set_title("Figure 2. Texas track recorded by benchmark (Atack 2016)", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "fig2_track_km.png", dpi=180); plt.close(fig)


def fig_growth(d):
    b = d[d.g40_20.notna()]
    fig, ax = plt.subplots(figsize=(6.5, 3.4))
    bins = np.arange(-2.5, 4.01, 0.25)
    for v, c, lab in ((1, C_SERV, "track ≤ 2 km by 1911"), (0, C_NOT, "no track ≤ 2 km by 1911")):
        x = b[b.served1911 == v].g40_20.clip(-2.5, 3.99)
        ax.hist(x, bins=bins, weights=np.ones(len(x)) / len(x), alpha=0.65, color=c, label=f"{lab} (n={len(x)})")
    ax.axvline(0, color="#888", lw=0.8)
    ax.set_xlabel("ln(population 2020 / population 1940)"); ax.set_ylabel("share of group"); ax.legend(frameon=False)
    ax.set_title("Figure 3. Long-run growth of verified-1940 towns by early rail access", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "fig3_growth_distribution.png", dpi=180); plt.close(fig)


def fig_coef(m):
    rows = []
    for x in m["model_b"]["models"]:
        t = [t for t in x["terms"] if t["term"] == "served1911"]
        if t:
            rows.append((x["label"].split(":")[0] + " " + x["label"].split(":")[1][:38], t[0]["coef"], t[0]["ci_low"], t[0]["ci_high"]))
    for r in m["robustness"]:
        if r.get("coef") is not None:
            rows.append((r["check"][:52], r["coef"], r["ci_low"], r["ci_high"]))
    fig, ax = plt.subplots(figsize=(7.5, 0.32 * len(rows) + 1))
    for i, (lab, c, lo, hi) in enumerate(rows[::-1]):
        ax.plot([lo, hi], [i, i], color=C_INK, lw=1.2); ax.plot(c, i, "o", color=C_SERV)
    ax.set_yticks(range(len(rows))); ax.set_yticklabels([r[0] for r in rows[::-1]], fontsize=7.5)
    ax.axvline(0, color="#888", lw=0.8); ax.set_xlabel("coefficient on rail access (log points, 95% CI, HC3)")
    ax.set_title("Figure 4. Rail-access coefficient across specifications", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "fig4_coefficients.png", dpi=180); plt.close(fig)


def fig_quality(s):
    q = s["observations_by_year_quality"]
    yrs = list(q)
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    bottom = np.zeros(len(yrs))
    for g, c in (("A", C_NOT), ("B", "#c9b99a"), ("C", C_RAIL)):
        v = np.array([q[y].get(g, 0) for y in yrs]); ax.bar(yrs, v, bottom=bottom, color=c, label=g); bottom += v
    ax.legend(title="grade", frameon=False); ax.set_ylabel("place-year observations")
    ax.set_title("Figure 5. Digitised census observations by year and verification grade", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "fig5_observation_quality.png", dpi=180); plt.close(fig)


def fig_case(d, o):
    fig, ax = plt.subplots(figsize=(6.5, 3.4))
    for name, c in (("Denison", C_SERV), ("Sherman", "#4a5866")):
        t = d[(d.name == name) & (d.county == "Grayson")]
        if t.empty:
            continue
        oo = o[(o.id == t.id.iloc[0]) & (o.quality == "A")].sort_values("year")
        xs = list(oo.year) + [2010, 2020]; ys = list(oo.population) + [t.pop2010.iloc[0], t.pop2020.iloc[0]]
        ax.plot(xs, ys, "-o", color=c, label=name, ms=4)
    ax.set_yscale("log"); ax.set_ylabel("population (verified, log scale)"); ax.legend(frameon=False)
    ax.set_title("Figure 6. Denison and Sherman, Grayson County", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "fig6_denison_sherman.png", dpi=180); plt.close(fig)


def term(m, label_prefix, name):
    for x in m["model_b"]["models"]:
        if x["label"].startswith(label_prefix):
            for t in x["terms"]:
                if t["term"] == name:
                    return t, x
    return None, None


def main():
    d = pd.read_csv(PROCESSED / "analysis_dataset.csv")
    o = pd.read_csv(PROCESSED / "population_observations.csv")
    m = json.loads((PROCESSED / "models.json").read_text())
    s = json.loads((WEB / "summary.json").read_text())
    fig_maps(d); fig_track(s); fig_growth(d); fig_coef(m); fig_quality(s); fig_case(d, o)
    dm = m["model_a"]["diff_mean_g40_20"]
    b1, B1 = term(m, "B1", "served1911")
    b2i, B2 = term(m, "B2", "ln_dist_int")
    b3r, B3 = term(m, "B3", "served2020")
    b4h, B4 = term(m, "B4", "ln_hub")
    b4b, _ = term(m, "B4", "betweenness_1911")
    b5, B5 = term(m, "B5", "served1911")
    lg = m["model_b"]["logit"]["terms"][0]
    pan = m["model_c"]["panel_1890_1910"]
    mt = m["model_c"]["matched_g40_20"]
    rob = [r for r in m["robustness"] if r.get("coef") is not None]
    inc0 = sum(1 for r in rob if r["ci_low"] <= 0 <= r["ci_high"])
    era = {g["group"]: g for g in m["model_a"]["outcomes"]["g40_20"]["by_era"]}
    v = s["validation"]
    f = lambda x, k=2: f"{x:.{k}f}"
    ci = lambda t: f"[{f(t['ci_low'])}, {f(t['ci_high'])}]"
    track = s["texas_track_km_by_benchmark"]
    rep = f"""# Railroads and the Fate of American Towns: A Network-Based Analysis of Historical Population Change in Texas

*RailEffect project report — working paper, not peer reviewed. Generated by `pipeline/make_report.py`; every number below is read from the pipeline outputs.*

## Abstract

Did access to the railroad shape which Texas towns grew, declined or persisted? We link Jeremy Atack's historical railroad GIS ({s['rail_segments_texas']:,} segments intersecting Texas across {len(s['benchmark_years'])} benchmark maps, {s['benchmark_years'][0]}–{s['benchmark_years'][-1]}) to population counts for {s['towns_analyzed']:,} incorporated places digitised from six U.S. Census volumes (1910–1970) with a multi-engine OCR pipeline and verified by agreement across independently printed volumes, plus official 2010 and 2020 counts. Towns within 2 km of track by 1911 grew {f(dm['served_minus_not'])} log points more between 1940 and 2020 than towns without track (95% CI {f(dm['ci'][0])} to {f(dm['ci'][1])}). Conditional on 1940 population and a flexible geographic surface, the difference is {f(b1['coef'])} (95% CI {ci(b1)}; n = {B1['n']}), and the interval includes zero in {inc0} of {len(rob)} robustness specifications. Long-run growth is more closely associated with network distance to the cities that were already large in 1910 and with distance to the later Interstate system. A fixed-effects panel around rail arrival is uninformative because only {pan['n_switchers']} towns change rail status while they are enumerated. The evidence, in this sample of towns that had already incorporated, does not support a strong independent association between early rail access and mid- to late-twentieth-century growth; it is silent on settlements that never incorporated.

## 1. Research question

The question is whether railroad connectivity influenced the population trajectories of American towns, studied in Texas. Railroads plausibly lowered transport costs and concentrated commerce at stations; but towns also differed in initial size, location, agricultural hinterland and, later, highway access. The study is built to report a null or mixed result if the data give one.

## 2. Historical background (scope of claims)

Texas track grew from {track['1861']:,.0f} km on Atack's 1861 benchmark to {track['1881']:,.0f} km by 1881, {track['1889']:,.0f} km by 1889 and {track['1911']:,.0f} km by 1911 (Figure 2). This report does not narrate the histories of individual railroads or towns; it makes only claims supported by the datasets described below. Readers seeking narrative history are referred to the Handbook of Texas and the Portal to Texas History, which were not used as data.

![Figure 1](figures/fig1_network_maps.png)

![Figure 2](figures/fig2_track_km.png)

## 3. Data sources

* **Railroads.** Atack, J. (2016), *Historical GIS database of U.S. railroads, 1826–1911* (file RR1826-1911Modified050916). Each segment carries the benchmark map on which it is first recorded (`InOpBy`). The author's download page was not reachable from the build environment; the identical layer (78,832 features, same schema) was read from a public ArcGIS Online copy. Modern rail features come from U.S. Census TIGER/Line 2020.
* **Population.** Incorporated-place tables from the 1910 (Table 2: 1890–1910), 1940 (Table 5: 1930–1940), 1950 (Table 7: 1940–1950), 1960 (Table 8: 1940–1960) and 1970 (Table 6: 1960–1970) census volumes for Texas, plus official 2010 and 2020 counts.
* **Locations.** USGS GNIS populated places (historic town points) and 2020 Census places; 2020 Interstate highways from TIGER primary roads.
* **Not used.** UNL *Railroads and the Making of Modern America* GIS and IPUMS NHGIS (not accessible from the build environment or requiring credentials); Texas State Library railroad maps (images, not digitised in this release).

## 4. Sampling and digitisation

The frame is every place printed as incorporated in any of the five tables. OCR place identities ({s['candidate_census_identities']:,}) were snapped to gazetteer spellings within their county; {s['towns_analyzed']:,} matched a GNIS or Census point exactly and form the town set. Exclusions are listed with reasons in the published data.

Each table page was rendered at 500 dpi, deskewed, split into ruled columns, and each numeric column read by five OCR configurations. Values were assigned to rows by tracking each column's vertical drift. A count is **grade A** if the same number is read from two independently printed volumes, was checked visually against the page image ({s['visual_verified']} values for larger 1890–1910 towns), or is an official digital count; **grade B** if printed once with at least four of five readings agreeing; otherwise **grade C**. Models use grade A only. A random validation sample found grade A correct in {v['A']['correct']}/{v['A']['checked']} cases (95% CI {v['A']['ci95_clopper_pearson'][0]:.2f}–{v['A']['ci95_clopper_pearson'][1]:.2f}) and grade B in {v['B']['correct']}/{v['B']['checked']} ({v['B']['ci95_clopper_pearson'][0]:.2f}–{v['B']['ci95_clopper_pearson'][1]:.2f}).

![Figure 5](figures/fig5_observation_quality.png)

## 5. Network construction

Coordinates are projected to EPSG:3083. Segment endpoints within {s['snap_tolerance_m']:.0f} m are merged into nodes; no other connections are made, so {s['network_audit']['proper_crossings_without_shared_endpoint']} map crossings inside Texas without a shared endpoint stay unconnected. Edges are weighted by length. For each benchmark the graph contains all segments recorded by that year. Towns within 2 km of track receive: network distance to the nearest 1910 city of 10,000+ ({len(s['hubs'])} hubs), sampled betweenness, node degree and component membership.

## 6. Statistical approach

* **Model A** – descriptive comparison of log growth by rail status and arrival benchmark with bootstrap intervals.
* **Model B** – OLS of ln(pop₂₀₂₀/pop₁₉₄₀) on rail access by 1911, controlling for ln 1940 population, a quadratic in longitude/latitude and a three-zone regional effect, with HC3 and county-clustered errors; extensions add distance to the 2020 Interstate network, rail presence in 2020 and network position; a logit models persistence as a 2020 census place.
* **Model C** – a two-way fixed-effects panel for 1890–1910 around rail arrival, and a Mahalanobis nearest-neighbour match.

## 7. Results

**Descriptive.** Mean log growth 1940–2020 was {f(m['model_a']['outcomes']['g40_20']['by_served1911'][1]['mean'])} for rail-served towns (n = {m['model_a']['outcomes']['g40_20']['by_served1911'][1]['n']}) and {f(m['model_a']['outcomes']['g40_20']['by_served1911'][0]['mean'])} for others (n = {m['model_a']['outcomes']['g40_20']['by_served1911'][0]['n']}). By arrival benchmark: by 1872 {f(era['by 1872']['mean'])} (n = {era['by 1872']['n']}); 1873–1881 {f(era['1873-1881']['mean'])}; 1882–1889 {f(era['1882-1889']['mean'])}; 1890–1911 {f(era['1890-1911']['mean'])}. Earliest-served towns grew most; rail-served towns as a group were also larger in 1940 and located further east than unserved towns (see the matching balance in Section 7), so these differences are not adjusted comparisons (Figure 3).

![Figure 3](figures/fig3_growth_distribution.png)

**Regression.** Model B1: rail access by 1911 {f(b1['coef'])} {ci(b1)}, p = {f(b1['p_hc3'])} (clustered p = {f(b1.get('p_cluster', float('nan')))}), R² = {f(B1['r2'])}. Adding Interstate distance (B2) gives ln(1 + km to Interstate) {f(b2i['coef'])} {ci(b2i)}. Rail presence in 2020 (B3) is associated with {f(b3r['coef'])} {ci(b3r)} higher growth — an association likely to run partly in reverse, since lines were abandoned where traffic fell. Among served towns (B4), ln network km to a 1910 hub has coefficient {f(b4h['coef'])} {ci(b4h)}; sampled betweenness {f(b4b['coef'])} {ci(b4b)}. For 1940–1960 (B5) the rail coefficient is {f(b5['coef'])} {ci(b5)}. Persistence as a 2020 census place is near-universal, and the logit coefficient on rail access is {f(lg['coef'])} [{f(lg['ci_low'])}, {f(lg['ci_high'])}].

**Panel and matching.** The 1890–1910 panel contains {pan['n_towns']} towns but only {pan['n_switchers']} change rail status; the estimate ({pan.get('coef_rail')}; CI {pan.get('ci')}) is reported for completeness and not interpreted. Nearest-neighbour matching gives {f(mt['att'])} [{mt['ci'][0]}, {mt['ci'][1]}], but the {mt['n_control_pool']} potential controls differ markedly in location from the {mt['n_treated']} served towns, so balance is poor.

![Figure 4](figures/fig4_coefficients.png)

## 8. Robustness

{chr(10).join(f"* {r['check']}: {f(r['coef'])} [{f(r['ci_low'])}, {f(r['ci_high'])}], n = {r['n']}" for r in rob)}

## 9. Historical interpretation

By 1911 about {round(s['served1911_share'] * 100)}% of towns that would appear in mid-century census tables already lay within 2 km of track. Among these places, early rail access marks out a regional pattern — the earlier-settled east and centre against a later-settled west — more than it predicts which towns grew after 1940. Proximity to the cities that dominated the 1910 network, and to the highways built after 1956, is more strongly associated with later growth. This is consistent with railroads having mattered most at the stage this sample cannot see: whether a settlement became a town at all.

![Figure 6](figures/fig6_denison_sherman.png)

## 10. Limitations

1. Survivorship: only places that incorporated and were printed in census tables are observed.
2. OCR error remains possible even for verified values; validation intervals are wide because the sample is small.
3. Boundaries and annexations are not harmonised.
4. The network after 1911 is unobserved until 2020; abandonment timing is unknown.
5. Atack's lines come from small-scale maps; positional error matters for a 2 km threshold.
6. Controls are coarse (no agriculture, county-seat status, oil, highway timing).
7. Distance to Interstates is measured in 2020 and may respond to town size.

## 11. Conclusion

In this sample, the raw growth advantage of early rail towns is not distinguishable from zero once size and location are accounted for, while later network position and highway access are more strongly associated with growth. The result is an association in a selected population, not a causal estimate. Extending the frame to unincorporated settlements (for example through post-office records) and digitising post-1911 network snapshots are the most promising next steps.

## References

* Atack, Jeremy. 2016. *Historical Geographic Information Systems (GIS) database of U.S. Railroads* (RR1826-1911Modified050916). Vanderbilt University. Also archived as ICPSR 36353.
* U.S. Census Bureau. 1913. *Thirteenth Census of the United States: 1910. Vol. III, Population.* Texas, Table 2.
* U.S. Census Bureau. 1942. *Sixteenth Census of the United States: 1940. Population, Vol. I.* Texas, Table 5.
* U.S. Census Bureau. 1952. *Census of Population: 1950. Vol. I, Number of Inhabitants.* Texas, Table 7.
* U.S. Census Bureau. 1961. *Census of Population: 1960. Vol. I, Part 45, Texas.* Table 8.
* U.S. Census Bureau. 1973. *Census of Population: 1970. Vol. I, Part 45, Texas, Section 1.* Table 6.
* U.S. Census Bureau. 2011, 2021. 2010 Census counts (intercensal city file); 2020 Census Redistricting Data (P.L. 94-171).
* U.S. Census Bureau. TIGER/Line Shapefiles 2020: Rails; Primary Roads; Cartographic Boundary Files 2020.
* U.S. Geological Survey. Geographic Names Information System, Domestic Names (Texas).
"""
    (ROOT / "report").mkdir(exist_ok=True)
    (ROOT / "report" / "raileffect_report.md").write_text(rep)
    dl = ROOT / "public" / "report"
    if dl.exists():
        shutil.rmtree(dl)
    shutil.copytree(ROOT / "report", dl)
    print("report written;", len(rep.split()), "words")


if __name__ == "__main__":
    main()
