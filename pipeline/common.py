"""Shared paths and helpers for the RailEffect research pipeline."""
from __future__ import annotations
import hashlib, json, datetime, pathlib, time
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
PROCESSED = ROOT / "data" / "processed"
METADATA = ROOT / "data" / "metadata"
WEB = ROOT / "public" / "data"
FIG = ROOT / "report" / "figures"
for p in (RAW, INTERIM, PROCESSED, METADATA, WEB, FIG):
    p.mkdir(parents=True, exist_ok=True)

# Texas-appropriate equal-area / distance CRS: NAD83 / Texas Centric Albers Equal Area (EPSG:3083)
TX_CRS = "EPSG:3083"
WGS84 = "EPSG:4326"

MANIFEST = METADATA / "acquisition_log.json"


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def log_acquisition(source_id: str, url: str, path: pathlib.Path, note: str = "") -> None:
    entries = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    entries[source_id + "::" + path.name] = {
        "source_id": source_id,
        "url": url,
        "local_path": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "accessed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "note": note,
    }
    MANIFEST.write_text(json.dumps(entries, indent=2, sort_keys=True))


def download(url: str, dest: pathlib.Path, source_id: str, note: str = "", retries: int = 4) -> pathlib.Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    for attempt in range(retries):
        try:
            with requests.get(url, stream=True, timeout=300) as r:
                r.raise_for_status()
                tmp = dest.with_suffix(dest.suffix + ".part")
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                tmp.rename(dest)
            log_acquisition(source_id, url, dest, note)
            return dest
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt * 3)
    return dest
