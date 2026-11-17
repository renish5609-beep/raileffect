"""Railroad accessibility metrics for each geolocated town.

Inputs : data/processed/towns.csv (id, lat, lon, ...), rail_segments.parquet, rail_tiger2020_tx.parquet
Outputs: data/processed/town_rail_metrics.csv

Metrics (all distances in km, EPSG:3083):
  dist_<Y>        straight-line distance to the nearest Atack segment operating by benchmark Y
  dist_2020       distance to the nearest TIGER/Line 2020 rail feature (modern, different source)
  served_<Y>      dist_<Y> <= SERVED_KM (main threshold 2 km; robustness uses 1 and 5 km)
  first_served    first benchmark year with served == True; opening interval = (previous benchmark, first_served]
  hub_net_km_<Y>  shortest network distance (km) to the nearest regional hub, Y in {1889, 1911}; hubs are
                  places with a 1910 census count >= 10,000 (A/B quality). Town access = straight-line
                  distance to its nearest edge + along-edge distance to an endpoint + graph distance.
  betweenness_<Y> sampled, length-weighted betweenness of the better-connected endpoint of the town's
                  nearest edge (k=1500 sources, seed 42), normalised.
  node_degree_<Y> max graph degree of the nearest edge's endpoints (>=3 indicates a mapped junction).
  main_comp_<Y>   whether the town's nearest edge lies in the largest connected component.
Network metrics are only computed for towns within SERVED_KM of track in that snapshot.
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
import geopandas as gpd
import networkx as nx
from shapely.strtree import STRtree
from common import PROCESSED, METADATA, TX_CRS, WGS84
from build_network import build_graph, simple_weighted

SERVED_KM = 2.0
NET_YEARS = (1889, 1911)


def main():
    towns = pd.read_csv(PROCESSED / "towns.csv")
    tg = gpd.GeoDataFrame(towns, geometry=gpd.points_from_xy(towns.lon, towns.lat), crs=WGS84).to_crs(TX_CRS)
    segs = gpd.read_parquet(PROCESSED / "rail_segments.parquet").reset_index(drop=True)
    years = sorted(int(y) for y in segs.in_op_by.unique())
    out = pd.DataFrame({"id": towns.id})
    for y in years:
        sub = segs[segs.in_op_by <= y]
        tree = STRtree(sub.geometry.values)
        idx = tree.nearest(tg.geometry.values)
        d = np.array([tg.geometry.iloc[i].distance(sub.geometry.iloc[j]) for i, j in enumerate(idx)]) / 1000.0
        out[f"dist_{y}"] = d.round(3)
    modern = gpd.read_parquet(PROCESSED / "rail_tiger2020_tx.parquet")
    tree = STRtree(modern.geometry.values)
    idx = tree.nearest(tg.geometry.values)
    out["dist_2020"] = (np.array([tg.geometry.iloc[i].distance(modern.geometry.iloc[j]) for i, j in enumerate(idx)]) / 1000.0).round(3)

    def first_served(r, thr):
        for y in years:
            if r[f"dist_{y}"] <= thr:
                return y
        return np.nan
    for thr, tag in ((SERVED_KM, ""), (1.0, "_1km"), (5.0, "_5km")):
        out[f"first_served{tag}"] = out.apply(lambda r: first_served(r, thr), axis=1)
    prev = {y: (years[i - 1] if i else None) for i, y in enumerate(years)}
    out["opened_after"] = out.first_served.map(lambda y: prev.get(int(y)) if pd.notna(y) else np.nan)

    # ---- network metrics
    u, v = segs.node_u.values, segs.node_v.values
    node_xy = np.load(PROCESSED / "rail_nodes_xy.npy")
    hubs = towns[(towns.pop1910.fillna(0) >= 10000)]
    netinfo = {"hubs": hubs.name.tolist()}
    for y in NET_YEARS:
        MG = build_graph(segs, u, v, node_xy, y)
        G = simple_weighted(MG)
        comps = sorted(nx.connected_components(G), key=len, reverse=True)
        main = comps[0]
        sub = segs[(segs.in_op_by <= y) & (segs.node_u != segs.node_v)].reset_index(drop=True)
        tree = STRtree(sub.geometry.values)
        nearest = tree.nearest(tg.geometry.values)
        # hub source nodes: endpoints of hub towns' nearest edges (only hubs served in this snapshot)
        src = {}
        for i, t in tg.iterrows():
            if t.id in set(hubs.id):
                j = nearest[i]
                if t.geometry.distance(sub.geometry.iloc[j]) / 1000 <= SERVED_KM:
                    e = sub.iloc[j]
                    pos = e.geometry.project(t.geometry)
                    src[int(e.node_u)] = min(src.get(int(e.node_u), 1e9), pos / 1000)
                    src[int(e.node_v)] = min(src.get(int(e.node_v), 1e9), (e.geometry.length - pos) / 1000)
        # multi-source Dijkstra with initial offsets via a virtual super-source
        H = G.copy()
        for n, off in src.items():
            if n in H:
                H.add_edge("__hub__", n, length_km=off)
        dist = nx.single_source_dijkstra_path_length(H, "__hub__", weight="length_km") if src else {}
        bc = nx.betweenness_centrality(G, k=min(1500, G.number_of_nodes()), weight="length_km", seed=42, normalized=True)
        deg = dict(G.degree())
        hn, btw, dg, mc = [], [], [], []
        for i, t in tg.iterrows():
            j = nearest[i]
            e = sub.iloc[j]
            access = t.geometry.distance(e.geometry) / 1000
            if access > SERVED_KM:
                hn.append(np.nan); btw.append(np.nan); dg.append(np.nan); mc.append(np.nan)
                continue
            pos = e.geometry.project(t.geometry) / 1000
            L = e.geometry.length / 1000
            a, b = int(e.node_u), int(e.node_v)
            cand = [dist.get(a, np.inf) + pos, dist.get(b, np.inf) + (L - pos)]
            hd = min(cand) + access
            hn.append(round(hd, 2) if np.isfinite(hd) else np.nan)
            btw.append(round(max(bc.get(a, 0), bc.get(b, 0)), 6))
            dg.append(max(deg.get(a, 0), deg.get(b, 0)))
            mc.append(a in main)
        out[f"hub_net_km_{y}"] = hn
        out[f"betweenness_{y}"] = btw
        out[f"node_degree_{y}"] = dg
        out[f"main_comp_{y}"] = mc
        netinfo[str(y)] = {"hub_source_nodes": len(src), "nodes": G.number_of_nodes(), "edges": G.number_of_edges(),
                           "betweenness_k": min(1500, G.number_of_nodes())}
    out.to_csv(PROCESSED / "town_rail_metrics.csv", index=False)
    (METADATA / "accessibility_summary.json").write_text(json.dumps(netinfo, indent=1))
    print(out.describe().T[["count", "mean", "50%"]].to_string())


if __name__ == "__main__":
    main()
