"""Dump every page's text and ruled tables so the schedules can be read and checked by hand."""
import json
import sys
from pathlib import Path

import pymupdf
from paths import ROOT, FILES, resolve_pdf

OUT = ROOT / "work" / "text"
OUT.mkdir(parents=True, exist_ok=True)


def main():
    only = set(sys.argv[1:])
    for code in FILES:
        if only and code not in only:
            continue
        doc = pymupdf.open(resolve_pdf(code))
        for i, page in enumerate(doc):
            lines = [f"### {code} p{i + 1}  {page.rect.width:.0f}x{page.rect.height:.0f}"]
            lines.append(page.get_text("text", sort=True))
            try:
                tables = page.find_tables()
                for t_i, tab in enumerate(tables.tables):
                    lines.append(f"--- table {t_i} bbox={[round(v) for v in tab.bbox]} rows={tab.row_count} cols={tab.col_count}")
                    for row in tab.extract():
                        lines.append(" | ".join("" if c is None else str(c).replace("\n", " ") for c in row))
            except Exception as exc:  # table finder fails on some vector-heavy pages
                lines.append(f"--- table error {exc}")
            (OUT / f"{code}_{i + 1:03d}.txt").write_text("\n".join(lines), encoding="utf-8")
        print(code, len(doc))


if __name__ == "__main__":
    main()
