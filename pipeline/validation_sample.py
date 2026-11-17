"""Draw a reproducible random sample of A- and B-grade OCR values and render the source-row crops
for visual checking. Results of the check are recorded in data/metadata/validation_sample_results.csv."""
import json, pathlib
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw
from ocr_tables import render
from extract_census import SPECS
from common import PROCESSED, INTERIM, METADATA, RAW

OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "metadata" / "validation_crops"


def main(n=24, seed=7):
    OUT.mkdir(parents=True, exist_ok=True)
    o = pd.read_csv(PROCESSED / "population_observations.csv")
    o = o[o.sources.notna() & ~o.sources.astype(str).str.contains("visual")]
    spec = {s["id"]: s for s in SPECS}
    rows = []
    rng = np.random.default_rng(seed)
    for q in ("A", "B"):
        pool = o[o.quality == q]
        pick = pool.iloc[rng.choice(len(pool), size=min(n, len(pool)), replace=False)]
        for _, r in pick.iterrows():
            rd = json.loads(r.readings)[0]
            tbl = rd["table"]
            ocr = pd.read_csv(INTERIM / f"ocr_{tbl}.csv")
            hit = ocr[(ocr.page == rd["page"]) & (ocr.year == r.year) & (ocr.population == rd["value"])]
            if hit.empty:
                continue
            h = hit.iloc[0]
            rows.append({"sample_id": f"{q}{len(rows):02d}", "quality": q, "id": r.id, "year": int(r.year), "value": int(r.population),
                         "table": tbl, "pdf_page": int(rd["page"]), "panel": int(h.panel), "y500": int(h.y), "name_ocr": h.name_ocr})
    df = pd.DataFrame(rows)
    df.to_csv(METADATA / "validation_sample.csv", index=False)
    # contact sheets
    imgs = {}
    for q in ("A", "B"):
        sub = df[df.quality == q]
        crops = []
        for _, r in sub.iterrows():
            key = (r.table, r.pdf_page)
            if key not in imgs:
                imgs[key] = render(RAW / "census" / spec[r.table]["file"], r.pdf_page - 1, dpi=300)
            img = imgs[key]
            H, W = img.shape
            panels = spec[r.table]["panels"]
            pw = W / panels
            x0, x1 = int(max(0, r.panel * pw - 20)), int(min(W, (r.panel + 1) * pw + 20))
            y = int(r.y500 * 300 / 500)
            c = Image.fromarray(img[max(0, y - 24):y + 24, x0:x1]).convert("RGB")
            lab = Image.new("RGB", (c.width, 22), (255, 255, 255))
            ImageDraw.Draw(lab).text((4, 4), f"{r.sample_id}  year {r.year}  OCR value {r.value:,}", fill=(160, 40, 30))
            stack = Image.new("RGB", (c.width, c.height + 22), (255, 255, 255)); stack.paste(lab, (0, 0)); stack.paste(c, (0, 22))
            crops.append(stack)
        for k in range(0, len(crops), 12):
            part = crops[k:k + 12]
            w = max(p.width for p in part); hh = sum(p.height + 6 for p in part)
            sheet = Image.new("RGB", (w, hh), (255, 255, 255)); yy = 0
            for p in part:
                sheet.paste(p, (0, yy)); yy += p.height + 6
            sheet.save(OUT / f"sheet_{q}_{k // 12}.png")
    print(df.groupby("quality").size())


if __name__ == "__main__":
    main()
