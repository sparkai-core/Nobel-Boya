"""Draw every hand-set evidence box onto its sheet render and tile the crops for a visual check."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "app" / "src" / "data" / "qobu.json").read_text(encoding="utf-8"))
sheets = {s["id"]: s for s in data["sheets"]}
srcs = []
for it in data["items"]:
    for s in it["src"]:
        if s["how"] == "image":
            srcs.append((it["id"], s))
for c in data["checks"]:
    for s in c["sources"]:
        if s["how"] == "image":
            srcs.append((c["id"], s))
seen = set()
tiles = []
for owner, s in srcs:
    key = (s["sheet"], tuple(s["box"]))
    if key in seen:
        continue
    seen.add(key)
    sh = sheets[s["sheet"]]
    img = Image.open(ROOT / "app" / "public" / "sheets" / f"{s['sheet']}.webp").convert("RGB")
    k = img.width / sh["w"]
    x0, y0, x1, y1 = [v * k for v in s["box"]]
    pad = 40 * k
    crop = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))
    d = ImageDraw.Draw(crop)
    ox, oy = max(0, x0 - pad), max(0, y0 - pad)
    d.rectangle([x0 - ox, y0 - oy, x1 - ox, y1 - oy], outline=(214, 63, 40), width=3)
    crop.thumbnail((520, 220))
    canvas = Image.new("RGB", (540, 250), "white")
    canvas.paste(crop, (10, 22))
    ImageDraw.Draw(canvas).text((10, 4), f"{owner} {s['sheet']} {s['quote'][:60]}", fill=(0, 0, 0))
    tiles.append(canvas)
cols = 3
rows = (len(tiles) + cols - 1) // cols
for part in range(0, rows, 6):
    chunk = tiles[part * cols:(part + 6) * cols]
    r = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 540, r * 250), (230, 230, 230))
    for i, t in enumerate(chunk):
        sheet.paste(t, ((i % cols) * 540, (i // cols) * 250))
    out = ROOT / "work" / "crops" / f"verify_{part // 6}.png"
    sheet.save(out)
    print(out, len(chunk))
