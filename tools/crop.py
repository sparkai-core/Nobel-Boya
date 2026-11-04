"""Render a region of one sheet at high zoom for reading by eye.

usage: crop.py CODE PAGE [x0 y0 x1 y1] [zoom]   (coordinates in PDF points)
"""
import sys
from pathlib import Path

import pymupdf
from paths import ROOT, FILES, resolve_pdf

OUT = ROOT / "work" / "crops"
OUT.mkdir(parents=True, exist_ok=True)

if len(sys.argv) < 3:
    print("usage: python crop.py CODE PAGE [x0 y0 x1 y1] [zoom]")
    sys.exit(1)

code, page_no = sys.argv[1], int(sys.argv[2])
doc = pymupdf.open(resolve_pdf(code))
page = doc[page_no - 1]
args = sys.argv[3:]
clip = None
zoom = 1.4
if len(args) >= 4:
    clip = pymupdf.Rect(*map(float, args[:4]))
    zoom = float(args[4]) if len(args) > 4 else 3.0
elif args:
    zoom = float(args[0])
pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, alpha=False)
name = f"{code}_{page_no}" + ("_" + "_".join(a.split(".")[0] for a in args[:4]) if clip else "") + ".png"
pix.save(OUT / name)
print(OUT / name, pix.width, pix.height, "rotation", page.rotation)
