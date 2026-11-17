"""Automated research-data checks (run: pytest pipeline/tests)."""
import json, pathlib
import numpy as np
import pandas as pd
import geopandas as gpd
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
P, M, W = ROOT / "data" / "processed", ROOT / "data" / "metadata", ROOT / "public" / "data"


needs_segments = pytest.mark.skipif(not (P / "rail_segments.parquet").exists(), reason="Atack-derived geometry is not committed; run the pipeline")


@pytest.fixture(scope="module")
def towns():
    return json.loads((W / "towns.json").read_text())


def test_no_duplicate_town_ids(towns):
    ids = [t["id"] for t in towns]
    assert len(ids) == len(set(ids))


def test_coordinates_inside_texas_bbox(towns):
    for t in towns:
        assert 25.8 <= t["lat"] <= 36.6 and -106.7 <= t["lon"] <= -93.5, t["id"]


def test_coordinates_inside_texas_polygon():
    tx = gpd.read_parquet(P / "texas_boundary.parquet").to_crs(4326).geometry.iloc[0].buffer(0.02)
    d = pd.read_csv(P / "towns.csv")
    pts = gpd.points_from_xy(d.lon, d.lat)
    outside = [n for n, p in zip(d.name, pts) if not tx.contains(p)]
    assert not outside, outside[:10]


def test_population_values_possible(towns):
    for t in towns:
        for p in t["pops"]:
            if p["pop"] is not None and p["quality"] in ("A", "B"):
                assert 1 <= p["pop"] <= 3_000_000, (t["id"], p)


def test_every_observation_cites_a_source(towns):
    src = json.loads((W / "sources.json").read_text())["census_tables"]
    for t in towns:
        for p in t["pops"]:
            assert p["sources"], (t["id"], p["year"])
            for s in p["sources"]:
                assert s.replace("+visual", "") in src, s


def test_no_interpolated_years(towns):
    allowed = {1890, 1900, 1910, 1930, 1940, 1950, 1960, 1970, 2010, 2020}
    for t in towns:
        assert {p["year"] for p in t["pops"]} <= allowed


@needs_segments
def test_railroad_years_are_benchmarks():
    segs = gpd.read_parquet(P / "rail_segments.parquet")
    summ = json.loads((M / "railroad_processing_summary.json").read_text())
    assert set(segs.in_op_by.unique()) <= set(summ["benchmark_years"])
    assert segs.in_op_by.between(1826, 1911).all()


@needs_segments
def test_crs_is_projected_texas_albers():
    segs = gpd.read_parquet(P / "rail_segments.parquet")
    assert segs.crs.to_epsg() == 3083


@needs_segments
def test_geometries_valid():
    segs = gpd.read_parquet(P / "rail_segments.parquet")
    assert segs.geometry.is_valid.all() and (~segs.geometry.is_empty).all()
    assert (segs.length_km > 0).all()


def test_network_consistency():
    net = json.loads((M / "network_summary.json").read_text())["snapshots"]
    ys = sorted(net, key=int)
    for a, b in zip(ys, ys[1:]):
        assert net[b]["edges"] >= net[a]["edges"]          # cumulative snapshots never lose track
    assert net["1911"]["largest_component_share"] > 0.9


@needs_segments
def test_edges_reference_valid_nodes():
    segs = gpd.read_parquet(P / "rail_segments.parquet")
    n = len(np.load(P / "rail_nodes_xy.npy"))
    assert segs.node_u.between(0, n - 1).all() and segs.node_v.between(0, n - 1).all()


def test_sample_sizes_within_expected_ranges():
    s = json.loads((W / "summary.json").read_text())
    assert 900 <= s["towns_analyzed"] <= 1100
    assert 5000 <= s["rail_segments_texas"] <= 5300
    assert 400 <= s["towns_in_regression_sample"] <= 520


def test_regression_sanity():
    m = json.loads((W / "models.json").read_text())
    b1 = m["model_b"]["models"][0]
    assert b1["n"] == m["sample"]["g40_20_n"]
    t = next(x for x in b1["terms"] if x["term"] == "served1911")
    assert t["ci_low"] <= t["coef"] <= t["ci_high"]
    assert 0 <= b1["r2"] <= 1
    # unadjusted difference must equal the difference of group means
    g = {x["group"]: x for x in m["model_a"]["outcomes"]["g40_20"]["by_served1911"]}
    assert abs((g["1"]["mean"] - g["0"]["mean"]) - m["model_a"]["diff_mean_g40_20"]["served_minus_not"]) < 1e-3


def test_models_use_only_verified_values():
    d = pd.read_csv(P / "analysis_dataset.csv")
    o = pd.read_csv(P / "population_observations.csv")
    A = o[(o.quality == "A") & (o.year == 1940)].set_index("id").population
    sub = d[d.popA1940.notna()]
    assert (sub.id.map(A) == sub.popA1940).all()


def test_joins_respect_county():
    d = pd.read_csv(P / "towns.csv")
    gz = pd.read_csv(ROOT / "data" / "interim" / "gazetteer.csv", dtype={"gaz_id": str}) if (ROOT / "data" / "interim" / "gazetteer.csv").exists() else None
    if gz is None:
        pytest.skip("gazetteer not built")
    g = gz.set_index("gaz_id").county
    assert (d.gaz_id.astype(str).map(g) == d.county).all()


def test_exclusions_logged_with_reasons():
    e = pd.read_csv(M / "town_exclusions.csv")
    assert e.reason.notna().all() and len(e) > 0
