"""Reconcile OCR readings of census tables into a longitudinal town population database.

Quality grades (explicit, rule-based):
  A  verified   - the same count is read from two independently printed census volumes
                  (the voted value of one printing appears among the OCR readings of another), or
                  it is an official machine-readable count (2010, 2020).
  B  consensus  - single printing, at least 4 of 5 OCR readings agree on the value.
  C  uncertain  - single printing with weaker agreement, or printings disagree. Kept for
                  transparency, excluded from statistical models by default.
Nothing is interpolated. A year with no printed count for a place is simply absent.
"""
from __future__ import annotations
import json, re, glob
import numpy as np
import pandas as pd
from build_gazetteer import norm
from common import INTERIM, PROCESSED, METADATA

SUFFIX_RE = re.compile(r"\s+(c\S{1,3}[ty]|t\S{1,2}[nw]|v\S{2,5}e|ci\S*|to\S*)$", re.I)


def place_key(name: str) -> str:
    """Keep the leading run of word tokens (letters, apostrophes, periods, hyphens); drop OCR junk,
    footnote digits and the trailing city/town/village suffix (including common OCR misreadings)."""
    n = re.sub(r"\(.*?\)?", "", str(name)).replace("’", "'")
    toks = []
    for t in n.split():
        if re.fullmatch(r"[A-Za-z][A-Za-z.'\-]*", t) and not re.search(r"[a-z][A-Z]", t[1:]):
            toks.append(t)
        else:
            break
    while toks and (len(toks[-1].strip(".")) <= 1 or re.fullmatch(r"(?i)(c\S{1,3}[ty]|t\S{1,2}[nw]|v\S{2,5}e|ci\S*|a[il]y|city|town|village)", toks[-1])):
        if len(toks) == 1:
            break
        toks.pop()
    return norm(" ".join(toks))


def candidates(readings: str) -> set[int]:
    out = set()
    for t in str(readings).split("|"):
        m = re.search(r"\d[\d,\s]*", t)
        if m:
            s = re.sub(r"[^0-9]", "", m.group(0))
            if s:
                out.add(int(s))
    return out


def load_ocr() -> pd.DataFrame:
    frames = []
    for f in sorted(glob.glob(str(INTERIM / "ocr_*_T*.csv"))):
        d = pd.read_csv(f)
        if len(d):
            frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    d = d[d.name.notna()].copy()
    if "partial" not in d:
        d["partial"] = False
    d["partial"] = d["partial"].fillna(False).astype(bool)
    d["key"] = d.name.map(place_key)
    d = d[d.key.str.len() >= 3]
    return d


def canonicalize(d: pd.DataFrame) -> pd.DataFrame:
    """Snap each OCR key to a gazetteer name in the same county (difflib ratio >= 0.84);
    without a county, accept only an exact unique statewide match."""
    import difflib
    gz = pd.read_csv(INTERIM / "gazetteer.csv")
    by_c = {c: sorted(set(g.norm.dropna())) for c, g in gz.groupby("county")}
    all_names = gz.norm.value_counts()
    canon, how = [], []
    for k, c in zip(d.key, d.county):
        if isinstance(c, str) and c in by_c:
            names = by_c[c]
            if k in names:
                canon.append(k); how.append("exact_in_county"); continue
            m = difflib.get_close_matches(k, names, n=1, cutoff=0.84)
            if m:
                canon.append(m[0]); how.append("fuzzy_in_county"); continue
        if k in all_names.index and all_names[k] == 1:
            canon.append(k); how.append("exact_unique_statewide"); continue
        canon.append(k); how.append("unmatched")
    d["key_raw"] = d.key
    d["key"] = canon
    d["key_how"] = how
    return d


def resolve_identities(d: pd.DataFrame) -> pd.DataFrame:
    d = canonicalize(d)
    """Assign a place identity (key + county). County OCR is fuzzy-matched to the 254 Texas counties;
    where a table row lacks a county, use the unique county seen for that key elsewhere."""
    county_by_key = d[d.county.notna()].groupby("key").county.agg(lambda s: s.value_counts().index[0])
    d["county_final"] = d.county.fillna(d.key.map(county_by_key))
    d["pid"] = d.key.str.replace(" ", "-") + "--" + d.county_final.fillna("unknown").str.lower().str.replace(" ", "-")
    return d


def reconcile(d: pd.DataFrame):
    rows, conflicts = [], []
    for (pid, year), g in d.groupby(["pid", "year"]):
        g = g[~g.unincorporated.fillna(False)]
        if g.empty:
            continue
        printings = []
        for tbl, gg in g.groupby("source_table"):
            r = gg.sort_values("votes", ascending=False).iloc[0]
            printings.append({"table": tbl, "page": int(r.page), "value": None if pd.isna(r.population) else int(r.population),
                              "votes": int(r.votes), "cands": candidates(r.readings), "readings": str(r.readings),
                              "partial": bool(r.partial)})
        vals = [p for p in printings if p["value"] is not None]
        if not vals:
            continue
        chosen, quality, note = None, "C", ""
        if len(vals) >= 2:
            support = {}
            for p in vals:
                for q in vals:
                    if q is p:
                        continue
                    if p["value"] in q["cands"]:
                        support[p["value"]] = support.get(p["value"], 0) + p["votes"] + 1
            if support:
                chosen = max(support.items(), key=lambda kv: kv[1])[0]
                quality, note = "A", f"agrees across {sum(1 for p in vals if chosen in p['cands'] or p['value']==chosen)} printings"
            else:
                best = max(vals, key=lambda p: p["votes"])
                chosen, quality, note = best["value"], "C", "printings disagree"
                conflicts.append({"pid": pid, "year": int(year), "printings": [{k: v for k, v in p.items() if k != "cands"} for p in vals]})
        else:
            p = vals[0]
            chosen = p["value"]
            quality = "B" if p["votes"] >= 4 else "C"
            note = f"single printing; {p['votes']}/5 OCR readings agree"
        if chosen is not None and (chosen <= 0 or chosen > 2_000_000):
            quality, note = "C", note + "; implausible value"
        if any(p["partial"] for p in printings):
            quality, note = "C", note + "; partial (place split across counties)"
        rows.append({"pid": pid, "year": int(year), "population": chosen, "quality": quality, "note": note,
                     "sources": ";".join(sorted(p["table"] for p in vals)),
                     "readings": json.dumps([{"table": p["table"], "page": p["page"], "value": p["value"]} for p in vals])})
    return pd.DataFrame(rows), conflicts


def apply_visual_verification(obs: pd.DataFrame, d: pd.DataFrame) -> pd.DataFrame:
    """Visual transcriptions (data/metadata/visual_verification.csv) are an independent reading of
    the printed page; where present they set the value and grade it A."""
    vv = pd.read_csv(METADATA / "visual_verification.csv")
    vv["key"] = vv.name.map(norm)
    pid_by = d.drop_duplicates("pid").set_index(["key", "county_final"]).pid
    n = 0
    for _, r in vv.iterrows():
        pid = pid_by.get((r.key, r.county))
        if pid is None:
            continue
        m = (obs.pid == pid) & (obs.year == r.year)
        prev = obs.loc[m, "population"].iloc[0] if m.any() else None
        note = "visually verified against page image" + ("" if prev == r.population else f" (OCR consensus read {prev})")
        row = {"pid": pid, "year": int(r.year), "population": int(r.population), "quality": "A", "note": note,
               "sources": r.source_table + "+visual", "readings": json.dumps([{"table": r.source_table, "page": None if pd.isna(r.pdf_page) else int(r.pdf_page), "value": int(r.population)}])}
        obs = pd.concat([obs[~m], pd.DataFrame([row])], ignore_index=True)
        n += 1
    print("visual verifications applied:", n)
    return obs


def neighbour_check(obs: pd.DataFrame) -> pd.DataFrame:
    """Demote B values that are wildly inconsistent with both adjacent observations of the same place
    (typical of a misassigned table cell): < 0.2x or > 5x both neighbours."""
    obs = obs.sort_values(["pid", "year"]).copy()
    for pid, g in obs.groupby("pid"):
        g = g[g.population.notna()].sort_values("year")
        v, q, idx = g.population.values.astype(float), g.quality.values, g.index
        for i in range(len(v)):
            if q[i] != "B":
                continue
            nb = [v[j] for j in (i - 1, i + 1) if 0 <= j < len(v) and q[j] in ("A", "B")]
            if nb and all(v[i] < 0.2 * x or v[i] > 5 * x for x in nb) and max(nb) >= 200:
                obs.loc[idx[i], "quality"] = "C"
                obs.loc[idx[i], "note"] = obs.loc[idx[i], "note"] + "; demoted: inconsistent with adjacent censuses"
    return obs


def flag_jumps(obs: pd.DataFrame) -> pd.DataFrame:
    """Flag (do not alter) implausible decade-to-decade jumps among A/B observations."""
    obs = obs.sort_values(["pid", "year"]).copy()
    obs["jump_flag"] = False
    for pid, g in obs[obs.quality.isin(["A", "B"])].groupby("pid"):
        g = g.sort_values("year")
        v = g.population.values.astype(float)
        for i in range(1, len(v)):
            r = v[i] / max(1.0, v[i - 1])
            if (r > 12 or r < 1 / 12) and min(v[i], v[i - 1]) > 50:
                obs.loc[g.index[i], "jump_flag"] = True
    obs.loc[obs.jump_flag & (obs.quality == "B"), "quality"] = "C"
    obs.loc[obs.jump_flag, "note"] = obs.loc[obs.jump_flag, "note"] + "; flagged: >12x change from previous census"
    return obs


def main():
    d = resolve_identities(load_ocr())
    obs, conflicts = reconcile(d)
    obs = apply_visual_verification(obs, d)
    obs = neighbour_check(obs)
    obs = flag_jumps(obs)
    names = d.groupby("pid").agg(name=("name", lambda s: s.value_counts().index[0]), county=("county_final", "first"),
                                 key=("key", "first"))
    obs = obs.merge(names, left_on="pid", right_index=True)
    obs.to_csv(PROCESSED / "population_observations_ocr.csv", index=False)
    (METADATA / "ocr_conflicts.json").write_text(json.dumps(conflicts, indent=1, default=int))
    summ = obs.groupby(["year", "quality"]).size().unstack(fill_value=0)
    print(summ)
    print("places:", obs.pid.nunique(), "conflicts:", len(conflicts))


if __name__ == "__main__":
    main()
