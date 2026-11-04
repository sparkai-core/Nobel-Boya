"""Write a row-ordered word dump (displayed coordinates) for every page with a text layer."""
import sys
from pathlib import Path

import pymupdf
from paths import ROOT, FILES, resolve_pdf

OUT = ROOT / "work" / "rows"
OUT.mkdir(parents=True, exist_ok=True)
FILES_TO_DUMP = {
    "AR": "Qobu inzibati bina ve anbar 28.09.2026.pdf",
    "KS": "Qobu konstruksiya.pdf",
    "MEP": "Qobu kommunikasiya \xfcmumi.pdf",
}
SKIP_WORDS = {"İnvent", "Əvəzinə", "Razılaşdırılmışdır"}

for code in FILES_TO_DUMP:
    if len(sys.argv) > 1 and code not in sys.argv[1:]:
        continue
    for i, page in enumerate(pymupdf.open(resolve_pdf(code))):
        m = page.rotation_matrix
        items = []
        for w in page.get_text("words"):
            r = pymupdf.Rect(w[:4]) * m
            items.append((r, w[4]))
        items.sort(key=lambda it: (round(it[0].y0 / 4), it[0].x0))
        rows = []
        for r, t in items:
            if rows and abs(rows[-1][0] - r.y0) < 3.5:
                rows[-1][1].append((r.x0, t))
            else:
                rows.append([r.y0, [(r.x0, t)]])
        lines = []
        for y, ws in rows:
            ws.sort()
            lines.append(f"{y:6.1f} | " + "  ".join(f"{t}@{x:.0f}" for x, t in ws))
        (OUT / f"{code}_{i + 1:03d}.txt").write_text("\n".join(lines), encoding="utf-8")
print("done")
