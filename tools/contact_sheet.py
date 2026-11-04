"""Tile sheet thumbnails into one labelled image for a quick visual index.

usage: contact_sheet.py CODE FIRST LAST [cols]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "app" / "public" / "sheets"
code, first, last = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
tiles = [Image.open(SHEETS / f"{code}-{n}.t.webp") for n in range(first, last + 1)]
w = max(t.width for t in tiles)
h = max(t.height for t in tiles) + 18
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "white")
draw = ImageDraw.Draw(sheet)
for i, t in enumerate(tiles):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(t, (x, y + 18))
    draw.text((x + 4, y + 2), f"{code} p{first + i}", fill="red")
out = ROOT / "work" / "crops" / f"contact_{code}_{first}_{last}.png"
sheet.save(out)
print(out)
