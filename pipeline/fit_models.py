"""Statistical analysis of railroad access and Texas town population change.

Model A  Descriptive comparison of growth by rail status / arrival era (bootstrap 95% CIs).
Model B  Multivariate OLS (HC3 and county-clustered SEs) and logit for persistence.
Model C  Two-way fixed-effects panel of 1890/1900/1910 counts around documented rail arrival,
         with explicit diagnostics on whether identifying variation exists; plus a nearest-
         neighbour matched comparison as the more defensible longitudinal design.
Robustness: thresholds, A-only data, outliers, regions, alternative outcomes, big-city exclusion,
            missing-data comparison.

Data rules: population values of quality A (verified across printings / visual check / official
digital counts) are used by default; quality B (single printing, OCR consensus) only where stated.
"""
from __future__ import annotations
import json, warnings
import numpy as np
import pandas as pd
import geopandas as gpd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from shapely.strtree import STRtree
from common import PROCESSED, METADATA, TX_CRS, WGS84

warnings.filterwarnings("ignore")
RNG = np.random.default_rng(20261117)
THR = 2.0


def load():
    t = pd.read_csv(PROCESSED / "towns.csv")
    m = pd.read_csv(PROCESSED / "town_rail_metrics.csv")
    o = pd.read_csv(PROCESSED / "population_observations.csv")
    d = t.merge(m, on="id")
    A = o[o.quality == "A"].pivot(index="id", columns="year", values="population")
    for y in A.columns:
        d[f"popA{y}"] = d.id.map(A[y])
    d["popA2020"], d["popA2010"] = d.pop2020, d.pop2010  # official digital counts
    # interstate distance (modern competing transport)
    ist = gpd.read_parquet(PROCESSED / "interstates_2020_tx.parquet")
    g = gpd.GeoDataFrame(d, geometry=gpd.points_from_xy(d.lon, d.lat), crs=WGS84).to_crs(TX_CRS)
    tree = STRtree(ist.geometry.values)
    idx = tree.nearest(g.geometry.values)
    d["dist_interstate_km"] = [g.geometry.iloc[i].distance(ist.geometry.iloc[j]) / 1000 for i, j in enumerate(idx)]
    d["served1911"] = (d.dist_1911 <= THR).astype(int)
    d["served1889"] = (d.dist_1889 <= THR).astype(int)
    d["served2020"] = (d.dist_2020 <= THR).astype(int)
    d["lost_rail"] = ((d.served1911 == 1) & (d.served2020 == 0)).astype(int)
    d["junction1911"] = (d.node_degree_1911 >= 3).astype(int)
    d["era"] = pd.cut(d.first_served, [0, 1872, 1881, 1889, 1911], labels=["by 1872", "1873-1881", "1882-1889", "1890-1911"]).astype(str)
    d.loc[d.first_served.isna(), "era"] = "not served by 1911"
    d["zone"] = np.select([d.lon > -96.0, d.lon > -98.5], ["East", "Central"], "West")
    d["x"] = (d.lon - d.lon.mean()); d["y"] = (d.lat - d.lat.mean())
    d["ln_pop1940"] = np.log(d.popA1940)
    d["g40_60"] = np.log(d.popA1960 / d.popA1940)
    d["g40_20"] = np.log(d.popA2020 / d.popA1940)
    d["g60_20"] = np.log(d.popA2020 / d.popA1960)
    d["ln_dist_int"] = np.log1p(d.dist_interstate_km)
    d["ln_hub"] = np.log1p(d.hub_net_km_1911)
    d["ln_dist1911"] = np.log1p(d.dist_1911)
    return d, o


def boot_ci(x, fn=np.mean, B=2000):
    x = np.asarray(x)
    x = x[np.isfinite(x)]
    if len(x) < 3:
        return [None, None]
    bs = [fn(RNG.choice(x, len(x))) for _ in range(B)]
    return [round(float(np.percentile(bs, 2.5)), 4), round(float(np.percentile(bs, 97.5)), 4)]


def describe(d, outcome, group):
    rows = []
    for k, g in d[d[outcome].notna()].groupby(group):
        x = g[outcome].values
        rows.append({"group": str(k), "n": int(len(x)), "mean": round(float(np.mean(x)), 4), "mean_ci": boot_ci(x),
                     "median": round(float(np.median(x)), 4), "median_ci": boot_ci(x, np.median),
                     "share_declined": round(float((x < 0).mean()), 4),
                     "p10": round(float(np.percentile(x, 10)), 4), "p90": round(float(np.percentile(x, 90)), 4)})
    return rows


def ols(d, formula, cluster=True, label=""):
    cols = [c for c in d.columns if c in formula]
    dd = d.dropna(subset=[c for c in cols if c in d.columns]).copy()
    m = smf.ols(formula, data=dd).fit(cov_type="HC3")
    mc = None
    if cluster and dd.county.nunique() > 20:
        mc = smf.ols(formula, data=dd).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(dd.county)[0]})
    res = {"label": label, "formula": formula, "n": int(m.nobs), "r2": round(float(m.rsquared), 4),
           "adj_r2": round(float(m.rsquared_adj), 4), "aic": round(float(m.aic), 1), "terms": []}
    for k in m.params.index:
        if k.startswith("C(zone)") or k == "Intercept":
            continue
        ci = m.conf_int().loc[k]
        term = {"term": k, "coef": round(float(m.params[k]), 4), "se_hc3": round(float(m.bse[k]), 4),
                "ci_low": round(float(ci[0]), 4), "ci_high": round(float(ci[1]), 4), "p_hc3": round(float(m.pvalues[k]), 4)}
        if mc is not None:
            cc = mc.conf_int().loc[k]
            term.update({"se_cluster": round(float(mc.bse[k]), 4), "ci_low_cluster": round(float(cc[0]), 4),
                         "ci_high_cluster": round(float(cc[1]), 4), "p_cluster": round(float(mc.pvalues[k]), 4)})
        res["terms"].append(term)
    # diagnostics
    infl = m.get_influence()
    cooks = infl.cooks_distance[0]
    from statsmodels.stats.diagnostic import het_breuschpagan
    from statsmodels.stats.stattools import jarque_bera
    bp = het_breuschpagan(m.resid, m.model.exog)
    jb = jarque_bera(m.resid)
    exog = pd.DataFrame(m.model.exog, columns=m.model.exog_names)
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    vif = {c: round(float(variance_inflation_factor(exog.values, i)), 2) for i, c in enumerate(exog.columns)
           if c != "Intercept" and not c.startswith("C(")}
    res["diagnostics"] = {"breusch_pagan_p": round(float(bp[1]), 4), "jarque_bera_p": round(float(jb[1]), 4),
                          "max_cooks_distance": round(float(cooks.max()), 4), "n_cooks_gt_4_over_n": int((cooks > 4 / m.nobs).sum()),
                          "vif": vif, "residual_sd": round(float(np.std(m.resid)), 4)}
    res["_fitted"] = (m, dd)
    return res


def logit(d, formula, label=""):
    dd = d.dropna(subset=[c for c in d.columns if c in formula]).copy()
    m = smf.logit(formula, data=dd).fit(disp=0, cov_type="HC1")
    res = {"label": label, "formula": formula, "n": int(m.nobs), "pseudo_r2": round(float(m.prsquared), 4), "terms": []}
    me = m.get_margeff(at="overall")
    mes = dict(zip(me.summary_frame().index, me.summary_frame()["dy/dx"]))
    for k in m.params.index:
        if k.startswith("C(zone)") or k == "Intercept":
            continue
        ci = m.conf_int().loc[k]
        res["terms"].append({"term": k, "coef": round(float(m.params[k]), 4), "se": round(float(m.bse[k]), 4),
                             "ci_low": round(float(ci[0]), 4), "ci_high": round(float(ci[1]), 4),
                             "p": round(float(m.pvalues[k]), 4), "avg_marginal_effect": round(float(mes.get(k, np.nan)), 4)})
    return res


def strip(r):
    return {k: v for k, v in r.items() if not k.startswith("_")}


def matched(d, outcome, treat="served1911", covs=("ln_pop1940", "x", "y"), B=1000):
    dd = d.dropna(subset=[outcome, *covs]).copy()
    X = dd[list(covs)].values
    S = np.cov(X.T)
    Si = np.linalg.pinv(S)
    T, C = dd[dd[treat] == 1], dd[dd[treat] == 0]
    if len(C) < 5 or len(T) < 5:
        return None
    Xt, Xc = T[list(covs)].values, C[list(covs)].values
    diffs, pairs = [], []
    for i in range(len(T)):
        dv = Xc - Xt[i]
        md = np.einsum("ij,jk,ik->i", dv, Si, dv)
        j = int(np.argmin(md))
        diffs.append(T[outcome].values[i] - C[outcome].values[j])
        pairs.append(float(md[j]))
    diffs = np.array(diffs)
    att = float(diffs.mean())
    bs = [RNG.choice(diffs, len(diffs)).mean() for _ in range(B)]
    bal = {}
    for k, c in enumerate(covs):
        bal[c] = {"treated_mean": round(float(Xt[:, k].mean()), 3), "control_pool_mean": round(float(Xc[:, k].mean()), 3)}
    return {"outcome": outcome, "treat": treat, "n_treated": int(len(T)), "n_control_pool": int(len(C)),
            "att": round(att, 4), "ci": [round(float(np.percentile(bs, 2.5)), 4), round(float(np.percentile(bs, 97.5)), 4)],
            "method": "1:1 nearest-neighbour Mahalanobis matching with replacement on " + ", ".join(covs) +
                      "; bootstrap CI over matched differences (does not account for matching uncertainty)",
            "balance": bal, "median_match_distance": round(float(np.median(pairs)), 3)}


def panel(d, o):
    """TWFE on 1890/1900/1910 counts (quality A or B). Treatment switches on when a town's first
    benchmark with track within 2 km is <= the census year; arrival benchmark 1911 is ambiguous
    relative to the 1910 census and those town-years are dropped."""
    p = o[o.year.isin([1890, 1900, 1910]) & o.quality.isin(["A", "B"])][["id", "year", "population"]].copy()
    p = p.merge(d[["id", "first_served", "county"]], on="id")
    p = p[~((p.first_served == 1911) & (p.year == 1910))]
    p["rail"] = ((p.first_served.notna()) & (p.first_served <= p.year)).astype(int)
    p["lnpop"] = np.log(p.population)
    cnt = p.groupby("id").size()
    p = p[p.id.isin(cnt[cnt >= 2].index)]
    switchers = p.groupby("id").rail.agg(lambda s: s.nunique() > 1)
    n_sw = int(switchers.sum())
    out = {"n_towns": int(p.id.nunique()), "n_obs": int(len(p)), "n_switchers": n_sw,
           "always_treated": int((p.groupby("id").rail.min() == 1).sum()),
           "never_treated": int((p.groupby("id").rail.max() == 0).sum())}
    if n_sw >= 5:
        m = smf.ols("lnpop ~ rail + C(id) + C(year)", data=p).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(p.id)[0]})
        ci = m.conf_int().loc["rail"]
        out.update({"coef_rail": round(float(m.params["rail"]), 4), "se": round(float(m.bse["rail"]), 4),
                    "ci": [round(float(ci[0]), 4), round(float(ci[1]), 4)], "p": round(float(m.pvalues["rail"]), 4)})
        out["switcher_ids"] = sorted(switchers[switchers].index.tolist())
    out["assessment"] = (
        "Identifying variation comes only from towns incorporated (and so enumerated as places) before rail "
        "arrival. Census place tables record towns only once incorporated, so pre-arrival observations are rare "
        "and selected; arrival dates are interval-censored between Atack benchmark maps. The estimate is "
        "reported as descriptive, not causal.")
    return out


def main():
    d, o = load()
    R = {"generated_by": "pipeline/fit_models.py", "served_threshold_km": THR}
    base = d[d.popA1940.notna()].copy()

    # ---------------- Model A
    R["model_a"] = {
        "title": "Descriptive comparison of long-run growth by historical rail access",
        "outcomes": {
            "g40_20": {"label": "ln(pop 2020 / pop 1940)", "by_served1911": describe(base, "g40_20", "served1911"),
                       "by_era": describe(base, "g40_20", "era"), "by_zone_served": describe(base.assign(zs=base.zone + " / " + base.served1911.map({1: 'served', 0: 'not served'})), "g40_20", "zs")},
            "g40_60": {"label": "ln(pop 1960 / pop 1940)", "by_served1911": describe(base, "g40_60", "served1911"),
                       "by_era": describe(base, "g40_60", "era")},
        },
        "persistence": [],
    }
    fr = d[(d.pop1910.notna()) | (d.popA1940.notna())]
    for k, g in fr.groupby("served1911"):
        R["model_a"]["persistence"].append({"group": int(k), "n": int(len(g)), "persisted_2020_share": round(float(g.persisted_2020.mean()), 4),
                                            "ci": boot_ci(g.persisted_2020.astype(float).values)})
    # difference in means with CI
    a = base[base.served1911 == 1].g40_20.dropna().values; b = base[base.served1911 == 0].g40_20.dropna().values
    bs = [RNG.choice(a, len(a)).mean() - RNG.choice(b, len(b)).mean() for _ in range(2000)]
    R["model_a"]["diff_mean_g40_20"] = {"served_minus_not": round(float(a.mean() - b.mean()), 4),
                                        "ci": [round(float(np.percentile(bs, 2.5)), 4), round(float(np.percentile(bs, 97.5)), 4)],
                                        "n_served": int(len(a)), "n_not": int(len(b))}

    # ---------------- Model B
    ctrl = "ln_pop1940 + x + y + I(x**2) + I(y**2) + x:y + C(zone)"
    b1 = ols(base, f"g40_20 ~ served1911 + {ctrl}", label="B1: growth 1940-2020 on rail access by 1911")
    b2 = ols(base, f"g40_20 ~ served1911 + ln_dist_int + {ctrl}", label="B2: B1 + distance to modern Interstate")
    b3 = ols(base, f"g40_20 ~ served1911 + served2020 + ln_dist_int + {ctrl}", label="B3: B2 + rail presence in 2020 (retention)")
    srv = base[base.served1911 == 1]
    b4 = ols(srv, f"g40_20 ~ ln_hub + junction1911 + betweenness_1911 + ln_dist_int + {ctrl}", label="B4: among rail-served towns, network position (1911)")
    b5 = ols(base, f"g40_60 ~ served1911 + {ctrl}", label="B5: growth 1940-1960 on rail access by 1911")
    lg = logit(fr.assign(persist=fr.persisted_2020.astype(int), ln_pop_base=np.log(fr.pop1910.fillna(fr.popA1940))),
               "persist ~ served1911 + ln_pop_base + x + y + C(zone)", label="B6: logit, persisted as a 2020 census place")
    R["model_b"] = {"title": "Multivariate regression", "models": [strip(r) for r in (b1, b2, b3, b4, b5)], "logit": lg,
                    "notes": "OLS with HC3 standard errors; county-clustered SEs reported alongside. Controls: ln 1940 population, quadratic in "
                             "longitude/latitude, coarse geographic zone (East < -96°, Central -96° to -98.5°, West). Distance to the 2020 "
                             "Interstate network is a post-treatment proxy for later transport access and may be endogenous."}

    # ---------------- Model C
    R["model_c"] = {"title": "Panel and matched comparison", "panel_1890_1910": panel(d, o),
                    "matched_g40_20": matched(base, "g40_20"), "matched_g40_60": matched(base, "g40_60")}

    # ---------------- Robustness
    rob = []
    for thr in (1.0, 5.0):
        dd = base.assign(served1911=(base.dist_1911 <= thr).astype(int))
        r = ols(dd, f"g40_20 ~ served1911 + {ctrl}", label=f"threshold {thr:g} km")
        rob.append({"check": f"Rail-access threshold {thr:g} km", **coef_of(r, "served1911")})
    r = ols(base, f"g40_20 ~ ln_dist1911 + {ctrl}", label="continuous distance")
    rob.append({"check": "Continuous ln(1 + km to 1911 track) instead of binary", **coef_of(r, "ln_dist1911")})
    m, dd = b1["_fitted"]
    cooks = m.get_influence().cooks_distance[0]
    r = ols(dd[cooks <= 4 / len(dd)], f"g40_20 ~ served1911 + {ctrl}", label="drop influential")
    rob.append({"check": "Drop influential observations (Cook's D > 4/n)", **coef_of(r, "served1911")})
    q = base.g40_20.quantile([0.01, 0.99]).values
    r = ols(base[(base.g40_20 > q[0]) & (base.g40_20 < q[1])], f"g40_20 ~ served1911 + {ctrl}", label="trim")
    rob.append({"check": "Trim top/bottom 1% of growth", **coef_of(r, "served1911")})
    r = ols(base[base.popA1940 < 50000], f"g40_20 ~ served1911 + {ctrl}", label="no big cities")
    rob.append({"check": "Exclude towns over 50,000 in 1940", **coef_of(r, "served1911")})
    for z in ("East", "Central", "West"):
        try:
            r = ols(base[base.zone == z], "g40_20 ~ served1911 + ln_pop1940 + x + y", label=z)
            rob.append({"check": f"Zone subsample: {z}", **coef_of(r, "served1911")})
        except Exception as e:  # noqa
            rob.append({"check": f"Zone subsample: {z}", "error": str(e)})
    r = ols(base, f"g60_20 ~ served1911 + {ctrl}", label="alt outcome")
    rob.append({"check": "Alternative outcome: growth 1960-2020", **coef_of(r, "served1911")})
    # include B-grade 1940 values
    oB = o[o.quality.isin(["A", "B"]) & (o.year == 1940)].set_index("id").population
    dB = d.assign(p40=d.id.map(oB)).dropna(subset=["p40"])
    dB = dB.assign(ln_pop1940=np.log(dB.p40), g40_20=np.log(dB.pop2020 / dB.p40))
    r = ols(dB, f"g40_20 ~ served1911 + {ctrl}", label="A+B")
    rob.append({"check": "Include single-printing (B) 1940 values", **coef_of(r, "served1911")})
    r = ols(base[base.served1889.notna()], f"g40_20 ~ served1889 + {ctrl}", label="1889 access")
    rob.append({"check": "Early access: served by 1889 benchmark", **coef_of(r, "served1889")})
    R["robustness"] = rob

    # missing-data comparison: towns with vs without an A-grade 1940 value
    d["has_A1940"] = d.popA1940.notna()
    R["missing_data"] = {
        "towns_total": int(len(d)), "with_A1940": int(d.has_A1940.sum()),
        "served1911_share_with": round(float(d[d.has_A1940].served1911.mean()), 4),
        "served1911_share_without": round(float(d[~d.has_A1940].served1911.mean()), 4),
        "median_pop2020_with": float(d[d.has_A1940].pop2020.median()),
        "median_pop2020_without": float(d[~d.has_A1940].pop2020.median()),
        "persisted_share_with": round(float(d[d.has_A1940].persisted_2020.mean()), 4),
        "persisted_share_without": round(float(d[~d.has_A1940].persisted_2020.mean()), 4)}
    R["sample"] = {"towns": int(len(d)), "base_A1940": int(len(base)), "g40_20_n": int(base.g40_20.notna().sum()),
                   "served1911_in_base": int(base.served1911.sum()), "not_served1911_in_base": int((1 - base.served1911).sum())}
    (PROCESSED / "models.json").write_text(json.dumps(R, indent=1, default=lambda x: None if x is None or (isinstance(x, float) and np.isnan(x)) else str(x)))
    d.drop(columns=["geometry"], errors="ignore").to_csv(PROCESSED / "analysis_dataset.csv", index=False)
    print(json.dumps({"sample": R["sample"], "diff": R["model_a"]["diff_mean_g40_20"],
                      "B1": [t for t in strip(b1)["terms"] if t["term"] == "served1911"],
                      "B3": [t for t in strip(b3)["terms"] if t["term"] in ("served1911", "served2020", "ln_dist_int")],
                      "B4": strip(b4)["terms"][:3], "logit": lg["terms"][:1], "panel": {k: v for k, v in R["model_c"]["panel_1890_1910"].items() if k != "switcher_ids"},
                      "matched": R["model_c"]["matched_g40_20"], "rob": rob}, indent=1, default=str))


def coef_of(r, term):
    t = [x for x in r["terms"] if x["term"] == term]
    if not t:
        return {"n": r["n"], "error": "term not estimable"}
    t = t[0]
    return {"n": r["n"], "coef": t["coef"], "ci_low": t["ci_low"], "ci_high": t["ci_high"], "p": t["p_hc3"]}


if __name__ == "__main__":
    main()
