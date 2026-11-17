"""Extract incorporated-place population counts from scanned U.S. Census volumes for Texas.

Every extracted value is an OCR reading of a printed census table. Values are kept with the
source table, PDF page, OCR confidence, and well-formedness flag, then reconciled across
volumes in `reconcile_population.py`. Nothing here is imputed or estimated.
"""
from __future__ import annotations
import json, re, sys, difflib, zipfile, io
from concurrent.futures import ProcessPoolExecutor
import numpy as np
import pandas as pd
from common import RAW, INTERIM, log_acquisition
from ocr_tables import render, find_vrules_morph, ocr_column, parse_first_count, find_gap_columns, align_template_rules

CENSUS = RAW / "census"
BASE = "https://www2.census.gov/library/publications/decennial/"

# ---------------------------------------------------------------------------------------
# Table specifications (all page indices are 0-based PDF page indices, verified by OCR of
# page headers; see data/metadata/census_tables.json for the human-readable registry)
# ---------------------------------------------------------------------------------------
SPECS = [
    {"id": "1900_T5", "file": "1900_volume-1-p8.pdf", "url": BASE + "1900/volume-1/volume-1-p8.pdf",
     "title": "Twelfth Census of the United States (1900), Vol. I (Population, Part 1), Table 5: Population of states and territories by minor civil divisions: 1890 and 1900 (Texas section)",
     "pages": list(range(34, 49)), "panels": 2, "columns": ["name", "v1900", "v1890"], "kind": "mcd"},
    {"id": "1910_T2", "file": "1910_volume-3_volume-3-p7.pdf", "url": BASE + "1910/volume-3/volume-3-p7.pdf",
     "title": "Thirteenth Census of the United States (1910), Vol. III (Population, Nebraska-Wyoming), Texas, Table 2: Population of incorporated places: 1910, 1900, and 1890",
     "pages": [26, 27], "panels": 2, "columns": ["name", "county", "v1910", "v1900", "v1890"], "kind": "placelist"},
    {"id": "1970_T6", "file": "00496492v1p45s1ch02.pdf", "url": BASE + "1970/population-volume-1/00496492v1p45s1ch02.pdf",
     "title": "1970 Census of Population, Vol. I (Characteristics of the Population), Part 45 Texas, Section 1, Chapter A, Table 6: Population of places: 1970 and 1960",
     "pages": [10, 11, 12, 13, 14, 15, 16], "panels": 2, "columns": ["name", "v1970", "v1960", "pct"], "kind": "placelist", "name_has_county": True},
    {"id": "1940_T5", "file": "c1940_ch09.pdf", "url": BASE + "1940/population-volume-1/33973538v1ch09.pdf",
     "title": "1940 Census, Vol. I (Number of Inhabitants), Texas, Table 5: Population of incorporated places: 1940 and 1930",
     "pages": [46, 47, 48], "panels": 3, "columns": ["name", "county", "v1940", "v1930"], "kind": "placelist"},
    {"id": "1950_T7", "file": "1950_population-volume-1_vol-01-46.pdf", "url": BASE + "1950/population-volume-1/vol-01-46.pdf",
     "title": "1950 Census, Vol. I (Number of Inhabitants), Texas (chapter 43), Table 7: Population of all incorporated places and of unincorporated places of 1,000 or more: 1950 and 1940",
     "pages": [28, 29, 30, 31], "panels": 3, "columns": ["name", "county", "v1950", "v1940"], "kind": "placelist"},
    {"id": "1960_T8", "file": "33255142v1p45ch02.pdf", "url": BASE + "1960/population-volume-1/33255142v1p45ch02.pdf",
     "title": "1960 Census, Vol. I (Characteristics of the Population), Part 45 Texas, Chapter A, Table 8: Population of all incorporated places and of unincorporated places of 1,000 or more: 1940 to 1960",
     "pages": [36, 37, 38, 39, 40], "panels": 2, "columns": ["name", "county", "v1960", "v1950", "v1940"], "kind": "placelist"},
]

LEADER_TAIL = re.compile(r"[\s._\-–—•·,:;'\"`~=|!_»«]+$")
LEADER_HEAD = re.compile(r"^[^A-Za-z(]+")


def tx_counties() -> list[str]:
    z = zipfile.ZipFile(RAW / "tiger" / "2020_Gaz_counties_national.zip")
    df = pd.read_csv(io.BytesIO(z.read(z.namelist()[0])), sep="\t", dtype=str)
    df.columns = [c.strip() for c in df.columns]
    names = df[df.USPS == "TX"].NAME.str.replace(" County", "", regex=False).tolist()
    return names


COUNTIES = None


def clean_name(s: str) -> str:
    s = s.replace("’", "'")
    # tesseract renders leader dots as runs like ". . ." or "___" or "-.-"; cut at the first leader run
    s = re.split(r"(?:[._\-–—•·]{2,}|\s[._\-–—•·:]\s|\s{2,}[.\-_])", s)[0]
    s = LEADER_TAIL.sub("", s)
    s = LEADER_HEAD.sub("", s)
    s = s.replace("*", "").strip()
    return s


def match_county(raw: str):
    global COUNTIES
    if COUNTIES is None:
        COUNTIES = tx_counties()
    c = clean_name(raw).strip("({[ )}]")
    if not c:
        return None, 0.0
    best = difflib.get_close_matches(c, COUNTIES, n=1, cutoff=0.6)
    if not best:
        return None, 0.0
    return best[0], difflib.SequenceMatcher(None, c, best[0]).ratio()


def split_name_county(raw: str):
    """1970 Table 6 prints 'Place name ....... County' in one unruled column."""
    global COUNTIES
    if COUNTIES is None:
        COUNTIES = tx_counties()
    s = raw.replace("’", "'")
    toks = re.findall(r"[A-Za-z][A-Za-z.'\-]*", s)
    best = (None, 0.0, len(toks))
    for n in (3, 2, 1):
        if len(toks) > n:
            cand = " ".join(toks[-n:])
            m = difflib.get_close_matches(cand, COUNTIES, n=1, cutoff=0.8)
            if m:
                sc = difflib.SequenceMatcher(None, cand, m[0]).ratio()
                if sc > best[1]:
                    best = (m[0], sc, len(toks) - n)
    county, sc, cut = best
    if county is None:
        return clean_name(s), None, 0.0
    name_part = " ".join(toks[:cut])
    return clean_name(name_part), county, sc


def find_rules(img, expected):
    for mf in (0.25, 0.2, 0.3, 0.15, 0.35, 0.12, 0.4, 0.1):
        r, cs, ext = find_vrules_morph(img, min_frac=mf)
        if len(r) == expected:
            return r, ext, mf
    return None, None, None


READ_VARIANTS = ("r500", "r500bin", "r300", "best500", "legacy500")


def track_assign(name_lines, val_lines, init_off: float, alpha: float = 0.3):
    """Assign value lines to name rows while tracking a slowly drifting vertical offset
    (page curvature / warp). Returns ({row_index: line}, initial_offset_used)."""
    if not name_lines or not val_lines:
        return {}, init_off
    ny = np.array([nl["y"] for nl in name_lines])
    row = float(np.median(np.diff(np.sort(ny)))) if len(ny) > 2 else 40.0
    off = init_off
    out = {}
    for vl in sorted(val_lines, key=lambda l: l["y"]):
        y = vl["y"] - off
        i = int(np.argmin(np.abs(ny - y)))
        res = vl["y"] - ny[i] - off
        if abs(res) <= 0.5 * row:
            if i not in out or abs(res) < out[i][1]:
                out[i] = (vl, abs(res))
            off = off + alpha * res
    return {k: v[0] for k, v in out.items()}, init_off


def initial_offset(name_lines, val_lines, around: float, n_first: int = 14):
    """Best constant offset for the first lines of a column, searched within +-0.6 row of `around`."""
    if len(name_lines) < 3 or len(val_lines) < 3:
        return around
    ny = np.sort(np.array([l["y"] for l in name_lines]))
    row = float(np.median(np.diff(ny)))
    ly = np.sort(np.array([l["y"] for l in val_lines]))[:n_first]
    best, bo = 1e18, around
    for off in np.arange(around - 0.6 * row, around + 0.6 * row + 0.5, 1.0):
        yy = ly - off
        idx = np.clip(np.searchsorted(ny, yy), 1, len(ny) - 1)
        res = np.minimum(np.abs(ny[idx] - yy), np.abs(ny[idx - 1] - yy))
        c = float(np.minimum(res, 0.5 * row).sum())
        if c < best:
            best, bo = c, float(off)
    return bo


def process_page(args):
    spec, page = args
    pdf = CENSUS / spec["file"]
    hi = render(pdf, page, dpi=500)
    lo = render(pdf, page, dpi=300)
    k = 500 / 300
    H, W = hi.shape
    cols = spec["columns"]
    ncol = len(cols) * spec["panels"]
    rules = None
    for mf in (0.25, 0.2, 0.3, 0.15, 0.35, 0.12, 0.4, 0.1, 0.08, 0.06):
        r, cs, ext = find_vrules_morph(hi, min_frac=mf, kernel=100)
        if len(r) == ncol - 1:
            rules, mfu = r, mf
            break
        if len(r) == ncol and r[-1] > 0.88 * W:  # outer right border printed as a rule
            rules, mfu = r[:-1], mf
            break
    if rules is None:  # keep the strongest peaks when a low threshold over-detects
        r, cs, ext = find_vrules_morph(hi, min_frac=0.06, kernel=100)
        if len(r) > ncol - 1:
            rules, mfu = sorted(sorted(r, key=lambda x: -cs[x])[: ncol - 1]), "top-k"
    if rules is None and spec.get("template_page") is not None and spec["template_page"] != page:
        ref = render(pdf, spec["template_page"], dpi=500)
        for mf in (0.25, 0.2, 0.15, 0.1):
            rr, cs2, ext2 = find_vrules_morph(ref, min_frac=mf, kernel=100)
            if len(rr) == ncol - 1:
                rules, shift = align_template_rules(hi, ref, rr)
                mfu = f"template(p{spec['template_page']}, shift {shift})"
                ext = (int(H * 0.08), int(H * 0.95))
                break
    if rules is None:
        H0 = hi.shape[0]
        ya, yb = int(H0 * 0.12), int(H0 * 0.93)
        rules = find_gap_columns(hi, ncol - 1, ya, yb)
        mfu = "gap"
        ext = (int(H0 * 0.06), int(H0 * 0.95))
    if rules is None:
        return {"spec": spec["id"], "page": page, "status": "rule_detection_failed", "rows": []}
    edges = [0] + rules + [W]
    y0, y1 = ext[0], min(H, ext[1] + 8)
    hib = np.where(hi < 140, 0, 255).astype(np.uint8)
    rows = []
    for p in range(spec["panels"]):
        colocr = {}
        for j, cname in enumerate(cols):
            kk = p * len(cols) + j
            xa, xb = edges[kk], edges[kk + 1]
            if cname.startswith("v") or cname == "pct":
                variants = {
                    "r500": ocr_column(hi, xa, xb, y0, y1, digits=True),
                    "r500bin": ocr_column(hib, xa, xb, y0, y1, digits=True),
                    "best500": ocr_column(hi, xa, xb, y0, y1, digits=True, engine="best"),
                    "legacy500": ocr_column(hi, xa, xb, y0, y1, digits=True, engine="legacy"),
                }
                lo_lines = ocr_column(lo, int(xa / k), int(xb / k), int(y0 / k), int(y1 / k), digits=True, leader_h=7)
                for l in lo_lines:
                    l["y"] *= k; l["top"] *= k; l["bottom"] *= k
                variants["r300"] = lo_lines
                colocr[cname] = variants
            else:
                colocr[cname] = ocr_column(hi, xa, xb, y0, y1, digits=False)
        # header cut: below the year label in value columns
        body_top = y0
        for cname in cols:
            if cname.startswith("v"):
                for ln in colocr[cname]["r500"]:
                    t = ln["text"].strip(" |.:;'\"")
                    if ln["y"] < y0 + (y1 - y0) * 0.15 and re.fullmatch(r"1[89]\d\d", t):
                        body_top = max(body_top, int(ln["bottom"]) + 4)
        name_lines = [l for l in colocr["name"] if l["y"] > body_top]

        # per-column initial offsets, chained left-to-right (adjacent columns have similar offsets)
        inits, around = {}, 0.0
        for cname in cols[1:]:
            base = colocr[cname]["r500"] if isinstance(colocr[cname], dict) else colocr[cname]
            base = [l for l in base if l["y"] > body_top]
            around = initial_offset(name_lines, base, around)
            inits[cname] = around
        assigned = {}
        for cname in cols[1:]:
            if isinstance(colocr[cname], dict):
                assigned[cname] = {v: track_assign(name_lines, [l for l in ls if l["y"] > body_top], inits[cname])[0] for v, ls in colocr[cname].items()}
            else:
                assigned[cname] = track_assign(name_lines, [l for l in colocr[cname] if l["y"] > body_top], inits[cname])[0]
        for i, nl in enumerate(name_lines):
            row = {"spec": spec["id"], "page": page, "panel": p, "y": round(nl["y"]), "name_raw": nl["text"],
                   "name_conf": round(nl["conf"], 1)}
            for cname in cols[1:]:
                a = assigned[cname]
                if isinstance(a, dict) and set(a.keys()) == set(READ_VARIANTS):
                    for v in READ_VARIANTS:
                        m = a[v].get(i)
                        row[f"{cname}_{v}"] = m["text"] if m else ""
                else:
                    m = a.get(i)
                    row[cname + "_raw"] = m["text"] if m else ""
            rows.append(row)
    return {"spec": spec["id"], "page": page, "status": "ok", "rule_min_frac": mfu, "rows": rows}


def vote(readings: list[str]):
    """Majority vote over OCR readings of one printed count.
    Returns (value, n_agree, n_readings_with_number, well_formed, all_values)."""
    vals = []
    wf = []
    for t in readings:
        v, ok = parse_first_count(t or "")
        if v is not None:
            vals.append(v)
            wf.append(ok)
    if not vals:
        return None, 0, 0, True, []
    counts = {}
    for v in vals:
        counts[v] = counts.get(v, 0) + 1
    best = max(counts.items(), key=lambda kv: (kv[1], -vals.index(kv[0])))
    return best[0], best[1], len(vals), all(wf), vals


PLACE_RE = re.compile(r"^(?!(?:precinct|ward|justice|beat|district|town ?ship|part of)\b)([A-Z][A-Za-z.' -]{1,40}?)\s+(city|town|village)\b", re.I)
COUNTY_RE = re.compile(r"^([A-Z][A-Z .']{2,30}?)\s+C[O0]UNTY")


def postprocess_mcd(rows: list[dict], spec: dict) -> pd.DataFrame:
    """MCD tables list precincts with the incorporated places they contain. Keep only place
    lines ('X city' / 'X town' / 'X village'), assigning the county from the latest heading."""
    vcols = [c for c in spec["columns"] if c.startswith("v")]
    out, county, in_texas = [], None, spec["id"] != "1900_T5"
    for r in rows:
        raw = r["name_raw"].replace("’", "'")
        txt = clean_name(raw)
        if spec["id"] == "1900_T5" and re.search(r"T\W?E\W?X\W?A\W?S", raw.upper()):
            in_texas = True
        m = COUNTY_RE.match(re.sub(r"[^A-Za-z .']", "", raw).strip().upper())
        if m:
            c, _ = match_county(m.group(1).title())
            county = c or county
            continue
        if not in_texas:
            continue
        pm = PLACE_RE.match(txt)
        if not pm or "including" in txt.lower():
            continue
        name = pm.group(1).strip() + " " + pm.group(2).lower()
        partial = bool(re.search(r"(?i)part of|\(part", raw))
        for vc in vcols:
            reads = [r.get(f"{vc}_{x}", "") for x in READ_VARIANTS]
            v, agree, nread, ok, _ = vote(reads)
            grade = "none" if v is None else ("unanimous" if agree == 5 else "majority" if agree >= 3 else "plurality")
            out.append({"source_table": spec["id"], "page": r["page"] + 1, "panel": r["panel"], "y": r["y"],
                        "name_ocr": r["name_raw"], "name": name, "county_ocr": "", "county": county,
                        "county_match": 1.0 if county else 0.0, "unincorporated": False, "partial": partial,
                        "year": int(vc[1:]), "readings": "|".join(str(x) for x in reads), "population": v,
                        "votes": agree, "n_readings": nread, "within_volume_grade": grade,
                        "well_formed": ok, "name_conf": r["name_conf"]})
    return pd.DataFrame(out)


def postprocess(rows: list[dict], spec: dict) -> pd.DataFrame:
    if spec.get("kind") == "mcd":
        return postprocess_mcd(rows, spec)
    vcols = [c for c in spec["columns"] if c.startswith("v")]
    out = []
    pending_prefix = ""
    for r in rows:
        name = clean_name(r["name_raw"])
        county, cscore = match_county(r.get("county_raw", ""))
        if spec.get("name_has_county"):
            name, county, cscore = split_name_county(r["name_raw"])
        vals = {}
        for vc in vcols:
            reads = [r.get(f"{vc}_{x}", "") for x in READ_VARIANTS]
            v, agree, nread, ok, allv = vote(reads)
            vals[vc] = (v, ok, agree, nread, "|".join(str(x) for x in reads))
        has_val = any(v[0] is not None for v in vals.values())
        if not has_val and not county:
            # likely the first line of a wrapped name ("Cedar Bayou-Stewart" / "Heights (uninc.)")
            pending_prefix = (pending_prefix + " " + name).strip()
            continue
        if pending_prefix and name and name[0].islower() is False and not county and has_val:
            name = pending_prefix + " " + name
        elif pending_prefix and not has_val:
            pass
        pending_prefix = ""
        if not name:
            continue
        uninc = bool(re.search(r"(?i)\(un", r["name_raw"]))
        name = re.sub(r"\s*\((?i:unin[a-z.,]*|uninc.*)\)?", "", name).strip()
        for vc, (v, ok, agree, nread, raw) in vals.items():
            # within-volume grade: unanimous / majority (>=3 of 5) / plurality / none
            grade = "none" if v is None else ("unanimous" if agree == 5 else "majority" if agree >= 3 else "plurality")
            out.append({"source_table": spec["id"], "page": r["page"] + 1, "panel": r["panel"], "y": r["y"],
                        "name_ocr": r["name_raw"], "name": name, "county_ocr": r.get("county_raw", ""),
                        "county": county, "county_match": round(cscore, 2), "unincorporated": uninc,
                        "year": int(vc[1:]), "readings": raw, "population": v, "votes": agree, "n_readings": nread,
                        "within_volume_grade": grade,
                        "well_formed": ok, "name_conf": r["name_conf"]})
    return pd.DataFrame(out)


def main(ids=None):
    specs = [s for s in SPECS if ids is None or s["id"] in ids]
    for s in specs:
        log_acquisition("census_" + s["id"], s["url"], CENSUS / s["file"], s["title"])
    jobs = [(s, p) for s in specs for p in s["pages"]]
    with ProcessPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(process_page, jobs))
    frames = []
    pagelog = []
    for s in specs:
        rows = [row for res in results if res["spec"] == s["id"] for row in res["rows"]]
        pagelog += [{k: res[k] for k in ("spec", "page", "status")} | {"rows": len(res["rows"])} for res in results if res["spec"] == s["id"]]
        df = postprocess(rows, s)
        df.to_csv(INTERIM / f"ocr_{s['id']}.csv", index=False)
        frames.append(df)
        print(s["id"], "rows", len(df), "places", df.name.nunique())
    (INTERIM / ("ocr_pagelog_" + "_".join(x["id"] for x in specs) + ".json")).write_text(json.dumps(pagelog, indent=1))
    print(json.dumps(pagelog))


if __name__ == "__main__":
    main(sys.argv[1:] or None)
