"""OCR of ruled census tables.

Census statistical tables of 1910-1970 are printed in ruled columns. We render each page at
300 dpi, detect vertical rules and the header's bottom horizontal rule from pixel projections,
OCR each column strip separately with Tesseract (count columns: leader dots/dashes removed first), and
reassemble rows by vertical position. Every value keeps its OCR confidence and page reference.
"""
from __future__ import annotations
import subprocess, tempfile, pathlib, csv, io, re, os
import numpy as np
from PIL import Image

DPI = 300


def estimate_skew(img: np.ndarray, max_deg: float = 2.5, step: float = 0.05) -> float:
    """Angle (degrees) that maximises the sharpness (sum of squares) of the vertical ink projection,
    i.e. makes column rules and aligned digits vertical."""
    small = np.array(Image.fromarray(img).resize((img.shape[1] // 4, img.shape[0] // 4)))
    dark = Image.fromarray(((small < 160) * 255).astype(np.uint8))
    best, best_a = -1.0, 0.0
    for a in np.arange(-max_deg, max_deg + 1e-9, step):
        r = np.asarray(dark.rotate(a, resample=Image.BILINEAR, fillcolor=0), dtype=np.float32)
        prof = r.sum(axis=0)
        v = float((prof ** 2).sum())
        if v > best:
            best, best_a = v, float(a)
    return best_a


def estimate_shear(img: np.ndarray, max_deg: float = 2.0, step: float = 0.05) -> float:
    """Vertical shear (degrees) that makes text rows horizontal (maximises horizontal-projection
    sharpness). Handles scans whose rows tilt while ruled columns stay vertical."""
    small = np.array(Image.fromarray(img).resize((img.shape[1] // 4, img.shape[0] // 4)))
    dark = Image.fromarray(((small < 160) * 255).astype(np.uint8))
    best, best_a = -1.0, 0.0
    for a in np.arange(-max_deg, max_deg + 1e-9, step):
        k = np.tan(np.radians(a))
        r = np.asarray(dark.transform(dark.size, Image.AFFINE, (1, 0, 0, k, 1, 0), resample=Image.BILINEAR, fillcolor=0), dtype=np.float32)
        prof = r.sum(axis=1)
        v = float((prof ** 2).sum())
        if v > best:
            best, best_a = v, float(a)
    return best_a


_SKEW_CACHE: dict = {}


def render(pdf: pathlib.Path, page_index: int, dpi: int = DPI, deskew: bool = True) -> np.ndarray:
    img = _render_raw(pdf, page_index, dpi)
    if not deskew:
        return img
    key = (str(pdf), page_index)
    if key not in _SKEW_CACHE:
        _SKEW_CACHE[key] = estimate_skew(img if dpi <= 300 else _render_raw(pdf, page_index, 200))
    a = _SKEW_CACHE[key]
    if abs(a) >= 0.05:
        img = np.asarray(Image.fromarray(img).rotate(a, resample=Image.BICUBIC, fillcolor=255))
    skey = key + ("shear",)
    if skey not in _SKEW_CACHE:
        base = _render_raw(pdf, page_index, 200)
        if abs(a) >= 0.05:
            base = np.asarray(Image.fromarray(base).rotate(a, resample=Image.BICUBIC, fillcolor=255))
        _SKEW_CACHE[skey] = estimate_shear(base)
    sh = _SKEW_CACHE[skey]
    if abs(sh) >= 0.05:
        k = np.tan(np.radians(sh))
        im = Image.fromarray(img)
        img = np.asarray(im.transform(im.size, Image.AFFINE, (1, 0, 0, k, 1, 0), resample=Image.BICUBIC, fillcolor=255))
    return img


def _render_raw(pdf: pathlib.Path, page_index: int, dpi: int = DPI) -> np.ndarray:
    with tempfile.TemporaryDirectory() as td:
        out = pathlib.Path(td) / "pg"
        subprocess.run(["pdftoppm", "-f", str(page_index + 1), "-l", str(page_index + 1), "-r", str(dpi),
                        "-gray", str(pdf), str(out)], check=True)
        f = sorted(pathlib.Path(td).glob("pg*"))[0]
        return np.array(Image.open(f))


def _runs(mask: np.ndarray, min_len: int):
    """Return (start, end) of runs of True with length >= min_len."""
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    if start is not None and len(mask) - start >= min_len:
        out.append((start, len(mask)))
    return out


def longest_vertical_run(dark: np.ndarray) -> np.ndarray:
    """Per column, longest run of consecutive dark pixels (tolerates 1-2 px gaps via dilation)."""
    d = dark.copy()
    d[1:] |= dark[:-1]
    d[2:] |= dark[:-2]
    H, W = d.shape
    best = np.zeros(W, dtype=int)
    cur = np.zeros(W, dtype=int)
    for y in range(H):
        cur = np.where(d[y], cur + 1, 0)
        best = np.maximum(best, cur)
    return best


def detect_layout(img: np.ndarray):
    dark = img < 150
    H, W = dark.shape
    # horizontal rules: rows where a long horizontal run exists
    row_fill = dark.mean(axis=1)
    hrules = [int((a + b) / 2) for a, b in _runs(row_fill > 0.45, 1)]
    # vertical rules: columns with a long vertical run (>= 35% of page height)
    vrun = longest_vertical_run(dark)
    vr = vrun > 0.35 * H
    # merge nearby
    vrules = [int((a + b) / 2) for a, b in _runs(vr, 1)]
    merged = []
    for x in vrules:
        if merged and x - merged[-1] < 12:
            merged[-1] = (merged[-1] + x) // 2
        else:
            merged.append(x)
    return hrules, merged


TESSDATA = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw" / "tessdata"
ENGINES = {"default": [], "best": ["--tessdata-dir", str(TESSDATA / "best"), "--oem", "1"],
           "legacy": ["--tessdata-dir", str(TESSDATA / "legacy"), "--oem", "0"]}


def tesseract_tsv(img: np.ndarray, digits: bool = False, psm: int = 6, engine: str = "default"):
    cfg = ["--psm", str(psm)] + ENGINES[engine]
    if digits:
        cfg += ["-c", "tessedit_char_whitelist=0123456789,-()"]
    with tempfile.NamedTemporaryFile(suffix=".png") as tf:
        Image.fromarray(img).save(tf.name)
        try:
            res = subprocess.run(["tesseract", tf.name, "stdout", *cfg, "-c", "tessedit_create_tsv=1"], capture_output=True, text=True,
                                 timeout=120, env={**os.environ, "OMP_THREAD_LIMIT": "1"})
        except subprocess.TimeoutExpired:
            return []
    rows = list(csv.DictReader(io.StringIO(res.stdout), delimiter="\t", quoting=csv.QUOTE_NONE))
    words = []
    for r in rows:
        if r.get("level") != "5":
            continue
        t = (r.get("text") or "").strip()
        if not t:
            continue
        words.append({"text": t, "left": int(r["left"]), "top": int(r["top"]), "width": int(r["width"]),
                      "height": int(r["height"]), "conf": float(r["conf"]),
                      "line": (int(r["block_num"]), int(r["par_num"]), int(r["line_num"]))})
    return words


def lines_from_words(words, y_offset=0):
    """Group words into lines using tesseract's line ids; return list of dict(y, text, conf, words)."""
    groups = {}
    for w in words:
        groups.setdefault(w["line"], []).append(w)
    lines = []
    for ws in groups.values():
        ws.sort(key=lambda w: w["left"])
        ys = [w["top"] + w["height"] / 2 for w in ws]
        lines.append({"y": float(np.median(ys)) + y_offset, "top": min(w["top"] for w in ws) + y_offset,
                      "bottom": max(w["top"] + w["height"] for w in ws) + y_offset,
                      "text": " ".join(w["text"] for w in ws), "conf": float(np.mean([w["conf"] for w in ws])),
                      "words": ws})
    lines.sort(key=lambda l: l["y"])
    return lines


def remove_leaders(c: np.ndarray, max_h: int = 9, max_w: int = 14) -> np.ndarray:
    """Blank out small connected components (dot/dash leaders) so text OCR is clean and fast."""
    from scipy import ndimage
    lab, _ = ndimage.label(c < 160)
    out = c.copy()
    for i, s in enumerate(ndimage.find_objects(lab)):
        if s is None:
            continue
        if (s[0].stop - s[0].start) <= max_h and (s[1].stop - s[1].start) <= max_w:
            region = out[s]
            region[lab[s] == i + 1] = 255
    return out


def ocr_column(img, x0, x1, y0, y1, digits=False, upscale=1, engine="default", leader_h=12):
    crop = img[y0:y1, x0 + 3:x1 - 3]
    if not digits:
        crop = remove_leaders(crop, max_h=int(round(leader_h * 1.1)), max_w=int(round(leader_h * 1.5)))
    else:
        crop = remove_leaders(crop, max_h=leader_h, max_w=60)
    if upscale != 1:
        crop = np.array(Image.fromarray(crop).resize((crop.shape[1] * upscale, crop.shape[0] * upscale), Image.LANCZOS))
    ws = tesseract_tsv(crop, digits=False, engine=engine)  # whitelists degraded LSTM accuracy in tests
    if upscale != 1:
        for w in ws:
            for k in ("left", "top", "width", "height"):
                w[k] = w[k] // upscale
    return lines_from_words(ws, y_offset=y0)


NUM_RE = re.compile(r"^\d{1,3}(,\d{3})*$")


def parse_count(text: str):
    """Parse a census count string. Returns (value or None, well_formed: bool)."""
    t = text.replace(" ", "").strip(".")
    if not t or set(t) <= set("-()"):
        return None, True
    t = t.strip("()")
    if NUM_RE.match(t):
        return int(t.replace(",", "")), True
    digits = re.sub(r"[^0-9]", "", t)
    if digits:
        return int(digits), False
    return None, False


def find_vrules(img: np.ndarray, expected: int, x_margin: float = 0.03):
    """Detect vertical table rules as narrow, high-density column peaks. Tries several thresholds
    and returns the candidate set whose size equals `expected` (or None)."""
    from scipy.ndimage import maximum_filter1d
    H, W = img.shape
    for th in (200, 170, 220):
        dark = img < th
        cf = dark[int(H * 0.12):int(H * 0.92)].mean(axis=0)
        peaks = [i for i in range(W) if cf[i] == maximum_filter1d(cf, 25)[i]]
        for minfill in (0.5, 0.45, 0.4, 0.55, 0.35, 0.6):
            cand = []
            for i in peaks:
                if cf[i] < minfill or i < W * x_margin or i > W * (1 - x_margin):
                    continue
                side = max(cf[max(0, i - 9)], cf[min(W - 1, i + 9)])
                if side < cf[i] * 0.7:
                    cand.append(i)
            merged = []
            for x in cand:
                if merged and x - merged[-1] < 30:
                    continue
                merged.append(x)
            if len(merged) == expected:
                return merged
    return None


def ocr_ruled_table(img: np.ndarray, columns: list[str], panels: int, header_years: list[str],
                    rules: list[int] | None = None, y_start_frac: float = 0.0, y_end_frac: float = 0.97):
    """OCR a ruled multi-panel table. `columns` describes each panel's columns e.g.
    ['name','county','v1950','v1940']; count columns start with 'v'. Returns list of row dicts."""
    H, W = img.shape
    ncol = len(columns) * panels
    if rules is None:
        rules = find_vrules(img, ncol - 1)
    if rules is None:
        raise ValueError("rule detection failed")
    edges = [0] + rules + [W]
    y0 = int(H * y_start_frac)
    y1 = int(H * y_end_frac)
    out = []
    for p in range(panels):
        cols = {}
        for j, cname in enumerate(columns):
            k = p * len(columns) + j
            xa, xb = edges[k], edges[k + 1]
            digits = cname.startswith("v")
            cols[cname] = ocr_column(img, xa, xb, y0, y1, digits=digits)
        # body start: below the header year label in the count columns
        body_top = y0
        for cname in columns:
            if cname.startswith("v"):
                for ln in cols[cname]:
                    t = ln["text"].replace(" ", "")
                    if ln["y"] < y0 + (y1 - y0) * 0.3 and re.fullmatch(r"19\d\d|18\d\d|1,?9\d\d", t):
                        body_top = max(body_top, int(ln["bottom"]) + 4)
        for cname in cols:
            cols[cname] = [l for l in cols[cname] if l["y"] > body_top]
        # assemble rows anchored on name-column lines
        name_lines = cols["name"]
        for i, nl in enumerate(name_lines):
            row = {"panel": p, "y": nl["y"], "name_raw": nl["text"], "name_conf": nl["conf"]}
            half = max(10.0, (nl["bottom"] - nl["top"]) * 0.75)
            for cname in columns[1:]:
                match = [l for l in cols[cname] if abs(l["y"] - nl["y"]) <= half]
                if match:
                    m = min(match, key=lambda l: abs(l["y"] - nl["y"]))
                    row[cname + "_raw"] = m["text"]
                    row[cname + "_conf"] = m["conf"]
                else:
                    row[cname + "_raw"] = ""
                    row[cname + "_conf"] = None
            out.append(row)
    return out, rules


def column_profile(img: np.ndarray, th: int = 200):
    H, W = img.shape
    return (img < th)[int(H * 0.12):int(H * 0.92)].mean(axis=0)


def find_vrules_template(img: np.ndarray, template: list[int], template_width: int, search: int = 80, local: int = 14):
    """Locate rules by aligning a template (x positions on a reference page of width
    `template_width`) to this page's column-density profile, then refining each rule locally."""
    H, W = img.shape
    cf = column_profile(img)
    scale = W / template_width
    tpl = [int(x * scale) for x in template]
    best_s, best_v = 0, -1.0
    for s in range(-search, search + 1, 2):
        v = 0.0
        for x in tpl:
            a, b = max(0, x + s - 3), min(W, x + s + 4)
            v += float(cf[a:b].max()) if b > a else 0.0
        if v > best_v:
            best_s, best_v = s, v
    rules = []
    for x in tpl:
        c = x + best_s
        a, b = max(0, c - local), min(W, c + local + 1)
        rules.append(a + int(np.argmax(cf[a:b])))
    strength = float(np.mean([cf[r] for r in rules]))
    return rules, strength


def parse_first_count(text: str):
    """Extract the first well-formed census count from an OCR'd cell (leaders produce trailing junk)."""
    t = text.replace(" ", "")
    m = re.match(r"^[^0-9]{0,3}(\d{1,3}(?:,\d{3})+|\d{1,3})(?![0-9])", t)
    if m:
        return int(m.group(1).replace(",", "")), True
    m = re.search(r"\d[\d,]*", t)
    if m:
        s = m.group(0).strip(",")
        ok = bool(re.fullmatch(r"\d{1,3}(,\d{3})*", s))
        return int(s.replace(",", "")), ok
    return None, True


def find_vrules_morph(img: np.ndarray, th: int = 190, kernel: int = 60, min_frac: float = 0.25):
    """Vertical rules via binary opening with a tall 1-px kernel (removes glyphs, keeps line
    segments); columns whose surviving pixel count exceeds `min_frac` of the table height."""
    from scipy.ndimage import binary_opening, maximum_filter1d
    H, W = img.shape
    dark = img < th
    # allow slight skew: OR neighbouring columns before opening
    d = dark.copy()
    d[:, 1:] |= dark[:, :-1]
    d[:, :-1] |= dark[:, 1:]
    op = binary_opening(d, structure=np.ones((kernel, 1), dtype=bool))
    colsum = op.sum(axis=0) / H
    cs = maximum_filter1d(colsum, 5)
    rules = []
    for x in range(int(W * 0.02), int(W * 0.98)):
        if colsum[x] >= min_frac and colsum[x] == cs[x]:
            if rules and x - rules[-1] < 25:
                if colsum[x] > colsum[rules[-1]]:
                    rules[-1] = x
                continue
            rules.append(x)
    # vertical extent of the ruled body (rows covered by any rule)
    rows = op[:, rules].any(axis=1) if rules else np.zeros(H, bool)
    ys = np.where(rows)[0]
    extent = (int(ys.min()), int(ys.max())) if len(ys) else (0, H)
    return rules, colsum, extent




def find_gap_columns(img: np.ndarray, expected: int, y0: int, y1: int, thr: int = 150):
    """Fallback for tables printed without vertical rules: remove leader dots/dashes, take the
    column ink profile of the body, and return the centres of the `expected` widest blank gaps."""
    body = remove_leaders(img[y0:y1], max_h=9, max_w=60)
    prof = (body < thr).mean(axis=0)
    W = img.shape[1]
    blank = prof < 0.004
    gaps = []
    start = None
    for x in range(W):
        if blank[x] and start is None:
            start = x
        elif not blank[x] and start is not None:
            if start > W * 0.03 and x < W * 0.97:
                gaps.append((x - start, (start + x) // 2))
            start = None
    if len(gaps) < expected:
        return None
    best = sorted(gaps, reverse=True)[:expected]
    return sorted(c for _, c in best)


def ink_profile(img: np.ndarray, y0: int, y1: int, thr: int = 150) -> np.ndarray:
    body = remove_leaders(img[y0:y1], max_h=9, max_w=60)
    return (body < thr).mean(axis=0)


def align_template_rules(img: np.ndarray, ref_img: np.ndarray, ref_rules: list[int], search: int = 250):
    """Shift a reference page's column boundaries onto `img` by maximising the correlation of the
    two pages' leader-free ink profiles (pages share a layout; scans differ in offset)."""
    H = img.shape[0]
    a = ink_profile(img, int(H * 0.15), int(H * 0.9))
    Hr = ref_img.shape[0]
    b = ink_profile(ref_img, int(Hr * 0.15), int(Hr * 0.9))
    n = min(len(a), len(b))
    a, b = a[:n] - a[:n].mean(), b[:n] - b[:n].mean()
    best, bs = -1e9, 0
    for s in range(-search, search + 1, 2):
        if s >= 0:
            v = float((a[s:] * b[: n - s]).sum())
        else:
            v = float((a[: n + s] * b[-s:]).sum())
        if v > best:
            best, bs = v, s
    return [r + bs for r in ref_rules], bs
