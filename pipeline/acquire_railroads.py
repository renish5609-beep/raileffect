"""Acquire Atack's historical railroad GIS (RR1826-1911Modified050916) for the Texas region.

Source: Jeremy Atack, "Historical Geographic Information Systems (GIS) database of U.S. Railroads"
(May 2016 revision, file RR1826-1911Modified050916). The original distribution page
(https://my.vanderbilt.edu/jeremyatack/data-downloads/) was not reachable from the build
environment, so features are retrieved from a public ArcGIS Online re-host of the same file
(service "RR1826_1911Modified0509161"). Fidelity check: the hosted layer has 78,832 features
and the same attribute schema (track, VxCount, Gauge, RRname, InOpBy, ExactDate, FIDAll, Edited)
as the original shapefile. The raw responses are cached under data/raw/atack/ (not redistributed).
"""
from __future__ import annotations
import json
import requests
from common import RAW, log_acquisition

SERVICE = ("https://services1.arcgis.com/4yjifSiIG17X0gW4/ArcGIS/rest/services/"
           "RR1826_1911Modified0509161/FeatureServer/0")
# Texas bounding box with a ~0.5 degree buffer (lon/lat, WGS84) so cross-border connections are retained
BBOX = (-107.2, 25.3, -93.0, 37.0)


def main() -> None:
    out_dir = RAW / "atack"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "rr1826_1911_texas_bbox.geojson"
    meta = requests.get(SERVICE, params={"f": "pjson"}, timeout=60).json()
    total = requests.get(SERVICE + "/query", params={"where": "1=1", "returnCountOnly": "true", "f": "json"}, timeout=60).json()["count"]
    geom = {"xmin": BBOX[0], "ymin": BBOX[1], "xmax": BBOX[2], "ymax": BBOX[3], "spatialReference": {"wkid": 4326}}
    base = {"where": "1=1", "geometry": json.dumps(geom), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "outSR": 4326, "f": "geojson",
            "orderByFields": "FID"}
    n = requests.get(SERVICE + "/query", params={**base, "returnCountOnly": "true", "f": "json"}, timeout=60).json()["count"]
    feats = []
    offset = 0
    while offset < n:
        r = requests.get(SERVICE + "/query", params={**base, "resultOffset": offset, "resultRecordCount": 2000}, timeout=300)
        r.raise_for_status()
        batch = r.json()["features"]
        if not batch:
            break
        feats.extend(batch)
        offset += len(batch)
        print(f"  fetched {offset}/{n}")
    fc = {"type": "FeatureCollection", "features": feats,
          "metadata": {"service": SERVICE, "service_total_features": total, "bbox": BBOX,
                       "fields": [f["name"] for f in meta.get("fields", [])]}}
    out.write_text(json.dumps(fc))
    log_acquisition("atack_rr_1826_1911", SERVICE + "/query", out,
                    f"Texas bbox extract, {len(feats)} of {total} national features")
    print("wrote", out, len(feats), "features; national total", total)


if __name__ == "__main__":
    main()
