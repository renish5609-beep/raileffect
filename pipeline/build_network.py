"""Construct historical railroad network graphs from Atack segments.

Graph construction rules (documented in the Methodology page):
  * Coordinates are in NAD83 / Texas Centric Albers Equal Area (EPSG:3083), metres.
  * Each segment's two endpoints become nodes. Endpoints within SNAP_M metres of each other are
    merged into a single node (digitising tolerance). Nothing else creates a node: two lines
    that cross on the map without sharing an endpoint are NOT connected, because a map crossing
    is not evidence of a physical junction or interchange.
  * Edge weight = segment length in km (planar length in EPSG:3083).
  * Snapshot graph for benchmark year Y = edges with InOpBy <= Y (cumulative; Atack's data record
    openings, not abandonments, before 1911).
"""
from __future__ import annotations
import json
import numpy as np
import geopandas as gpd
import networkx as nx
from scipy.spatial import cKDTree
from common import PROCESSED, METADATA

SNAP_M = 150.0


def snap_endpoints(segs: gpd.GeoDataFrame):
    starts = np.array([ls.coords[0] for ls in segs.geometry])
    ends = np.array([ls.coords[-1] for ls in segs.geometry])
    pts = np.vstack([starts, ends])
    tree = cKDTree(pts)
    pairs = tree.query_pairs(SNAP_M)
    # union-find
    parent = list(range(len(pts)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    roots = np.array([find(i) for i in range(len(pts))])
    uniq, node_idx = np.unique(roots, return_inverse=True)
    node_xy = np.zeros((len(uniq), 2))
    np.add.at(node_xy, node_idx, pts)
    counts = np.bincount(node_idx)
    node_xy /= counts[:, None]
    n = len(segs)
    return node_idx[:n], node_idx[n:], node_xy


def build_graph(segs, u, v, node_xy, year=None):
    G = nx.MultiGraph()
    for i, (a, b) in enumerate(zip(u, v)):
        r = segs.iloc[i]
        if year is not None and r.in_op_by > year:
            continue
        if a == b:
            continue  # loop shorter than tolerance
        G.add_edge(int(a), int(b), key=r.segment_id, length_km=float(r.length_km), in_op_by=int(r.in_op_by))
    for nidx in G.nodes:
        G.nodes[nidx]["x"], G.nodes[nidx]["y"] = float(node_xy[nidx][0]), float(node_xy[nidx][1])
    return G


def simple_weighted(G: nx.MultiGraph) -> nx.Graph:
    H = nx.Graph()
    for a, b, d in G.edges(data=True):
        w = d["length_km"]
        if H.has_edge(a, b):
            H[a][b]["length_km"] = min(H[a][b]["length_km"], w)
        else:
            H.add_edge(a, b, length_km=w)
    return H


def crossing_audit(segs) -> dict:
    """Count map crossings that are NOT shared endpoints (these are deliberately not connected)."""
    sidx = segs.sindex
    crossings = 0
    for i, geom in enumerate(segs.geometry):
        for j in sidx.query(geom, predicate="crosses"):
            if j > i:
                crossings += 1
    return {"proper_crossings_without_shared_endpoint": int(crossings)}


def main():
    segs = gpd.read_parquet(PROCESSED / "rail_segments.parquet").reset_index(drop=True)
    u, v, node_xy = snap_endpoints(segs)
    segs["node_u"], segs["node_v"] = u, v
    segs.to_parquet(PROCESSED / "rail_segments.parquet")
    np.save(PROCESSED / "rail_nodes_xy.npy", node_xy)
    years = sorted(int(y) for y in segs.in_op_by.unique())
    stats = {}
    for y in years:
        G = simple_weighted(build_graph(segs, u, v, node_xy, y))
        comps = sorted(nx.connected_components(G), key=len, reverse=True)
        deg = dict(G.degree())
        stats[y] = {"nodes": G.number_of_nodes(), "edges": G.number_of_edges(),
                    "components": len(comps), "largest_component_nodes": len(comps[0]) if comps else 0,
                    "largest_component_share": round(len(comps[0]) / max(1, G.number_of_nodes()), 3) if comps else 0,
                    "junction_nodes_deg3plus": int(sum(1 for d in deg.values() if d >= 3)),
                    "dead_ends_deg1": int(sum(1 for d in deg.values() if d == 1)),
                    "track_km": round(sum(d["length_km"] for _, _, d in G.edges(data=True)), 1)}
    audit = crossing_audit(segs[segs.in_texas])
    out = {"snap_tolerance_m": SNAP_M, "crs": "EPSG:3083", "snapshots": stats, "audit": audit,
           "note": "Statistics cover all segments in the study bounding box (Texas plus adjacent areas)."}
    (METADATA / "network_summary.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
