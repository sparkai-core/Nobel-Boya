"""Render every sheet to WebP for the viewer (full size and thumbnail)."""
import io
import sys
from pathlib import Path

import pymupdf
from PIL import Image
from paths import ROOT, FILES, resolve_pdf

OUT = ROOT / "app" / "public" / "sheets"
OUT.mkdir(parents=True, exist_ok=True)

FULL_ZOOM = 2.0
THUMB_W = 360


def main():
    only = set(sys.argv[1:])
    for code, name in FILES.items():
        if only and code not in only:
            continue
        doc = pymupdf.open(resolve_pdf(code))
        for i, page in enumerate(doc):
            full = OUT / f"{code}-{i + 1}.webp"
            thumb = OUT / f"{code}-{i + 1}.t.webp"
            if full.exists() and thumb.exists():
                continue
            pix = page.get_pixmap(matrix=pymupdf.Matrix(FULL_ZOOM, FULL_ZOOM), alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            img.save(full, "WEBP", quality=82, method=4)
            t = img.copy()
            t.thumbnail((THUMB_W, THUMB_W))
            t.save(thumb, "WEBP", quality=78)
            print(code, i + 1, flush=True)


if __name__ == "__main__":
    main()
