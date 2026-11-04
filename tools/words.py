"""Print words inside a region of a sheet, in displayed (rotated) coordinates, grouped into rows.

usage: words.py CODE PAGE [x0 y0 x1 y1]
"""
import io
import sys
from pathlib import Path

import pymupdf
from paths import ROOT, FILES, resolve_pdf

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

if len(sys.argv) < 3:
    print("usage: python words.py CODE PAGE [x0 y0 x1 y1]")
    sys.exit(1)

code, page_no = sys.argv[1], int(sys.argv[2])
page = pymupdf.open(resolve_pdf(code))[page_no - 1]
region = pymupdf.Rect(*map(float, sys.argv[3:7])) if len(sys.argv) >= 7 else page.rect
m = page.rotation_matrix
items = []
for w in page.get_text("words"):
    r = pymupdf.Rect(w[:4]) * m
    if r.intersects(region):
        items.append((r, w[4]))
items.sort(key=lambda it: (round(it[0].y0 / 4), it[0].x0))
rows = []
for r, t in items:
    if rows and abs(rows[-1][0] - r.y0) < 3.5:
        rows[-1][1].append((r.x0, t))
    else:
        rows.append([r.y0, [(r.x0, t)]])
for y, ws in rows:
    ws.sort()
    print(f"{y:6.1f} | " + "  ".join(f"{t}@{x:.0f}" for x, t in ws))
