"""Find printed values on a sheet and return their evidence box in displayed (rotated) PDF points."""
from functools import lru_cache
from pathlib import Path
import re

import pymupdf
from paths import ROOT, FILES, resolve_pdf


class NotFound(Exception):
    pass


@lru_cache(maxsize=None)
def doc(code):
    return pymupdf.open(resolve_pdf(code))


@lru_cache(maxsize=None)
def words(code, page_no):
    page = doc(code)[page_no - 1]
    m = page.rotation_matrix
    out = []
    for w in page.get_text("words"):
        r = pymupdf.Rect(w[:4]) * m
        out.append((r, w[4]))
    return out


def page_size(code, page_no):
    r = doc(code)[page_no - 1].rect
    return round(r.width, 1), round(r.height, 1)


def _norm(t):
    return t.strip().rstrip(",;:").replace("\u00a0", "")


def locate(code, page_no, value, labels=(), dy=6.5, x_range=None, y_range=None, pad=2.5):
    """Return (box, quote) for `value` printed in the same row as every label.

    Raises NotFound when the value or a label is missing, so no number enters the data
    unless it is printed on the cited sheet.
    """
    ws = words(code, page_no)
    cands = [(r, t) for r, t in ws if _norm(t) == value]
    if x_range:
        cands = [(r, t) for r, t in cands if x_range[0] <= r.x0 <= x_range[1]]
    if y_range:
        cands = [(r, t) for r, t in cands if y_range[0] <= r.y0 <= y_range[1]]
    if not cands:
        raise NotFound(f"{code} p{page_no}: value {value!r} not printed")
    best = None
    for r, t in cands:
        cy = (r.y0 + r.y1) / 2
        found = []
        for lab in labels:
            pool = [
                (rr, tt)
                for rr, tt in ws
                if lab.lower() in tt.lower() and abs((rr.y0 + rr.y1) / 2 - cy) <= dy
            ]
            if not pool:
                break
            pool.sort(key=lambda it: abs(it[0].x0 - r.x0))
            found.append(pool[0][0])
        if len(found) != len(labels):
            continue
        score = sum(abs(f.x0 - r.x0) for f in found)
        if best is None or score < best[0]:
            best = (score, r, found)
    if best is None:
        raise NotFound(f"{code} p{page_no}: {value!r} not in a row with {labels}")
    _, r, found = best
    box = pymupdf.Rect(r)
    for f in found:
        box |= f
    box = pymupdf.Rect(box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad)
    cy = (r.y0 + r.y1) / 2
    row = [(rr, tt) for rr, tt in ws if abs((rr.y0 + rr.y1) / 2 - cy) <= max(4.0, dy * 0.6)]
    row = [(rr, tt) for rr, tt in row if rr.x1 >= box.x0 - 40 and rr.x0 <= box.x1 + 40]
    row.sort(key=lambda it: it[0].x0)
    quote = re.sub(r"\s+", " ", " ".join(tt for _, tt in row)).strip()
    return [round(box.x0, 1), round(box.y0, 1), round(box.x1, 1), round(box.y1, 1)], quote


def region_text(code, page_no, box):
    rect = pymupdf.Rect(*box)
    ws = [(r, t) for r, t in words(code, page_no) if r.intersects(rect)]
    ws.sort(key=lambda it: (round(it[0].y0 / 4), it[0].x0))
    return " ".join(t for _, t in ws)
