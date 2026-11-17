"""Engine behaviour on drawings it has never seen: English, Azerbaijani, rotated, image-only, calculation sheets."""
import json
import os
from pathlib import Path

import pymupdf
import pytest

import takeoff_engine as T

ROOT = Path(__file__).resolve().parents[2]


def analyse(pdf_bytes, page=0):
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    return T.analyse_page(doc[page], "S-1"), doc


def value_rect(doc, page_no, text):
    page = doc[page_no]
    hits = page.search_for(text)
    assert hits, text
    return [r * page.rotation_matrix for r in hits]


def contains(box, rect):
    x0, y0, x1, y1 = box
    return x0 <= rect.x0 + 0.5 and y0 <= rect.y0 + 0.5 and x1 >= rect.x1 - 0.5 and y1 >= rect.y1 - 0.5


ENGLISH_SPEC = [
    (60, 60, "MATERIAL SPECIFICATION", 14),
    (60, 100, "No.", 9), (100, 100, "Description", 9), (420, 100, "Unit", 9), (480, 100, "Qty", 9),
    (60, 120, "1", 9), (100, 120, "Cable N2XH 3x2.5 mm2", 9), (420, 120, "m", 9), (480, 120, "250", 9),
    (60, 140, "2", 9), (100, 140, "LED luminaire 2x36W IP44", 9), (420, 140, "nr", 9), (480, 140, "26", 9),
    (60, 160, "3", 9), (100, 160, "PVC conduit 20 mm", 9), (420, 160, "m", 9), (480, 160, "120", 9),
    (60, 180, "4", 9), (100, 180, "Distribution board 24 way", 9), (420, 180, "set", 9), (480, 180, "1", 9),
    (900, 780, "Drawn", 8), (950, 780, "J. Smith", 8), (900, 795, "Checked", 8), (1100, 795, "Sheet 3", 8),
]


def test_english_spec_table_rows_and_boxes(pdf_factory):
    (res, meta), doc = analyse(pdf_factory([ENGLISH_SPEC]))
    got = {(f.label, f.unit, f.qty) for f in res.found}
    assert got == {
        ("Cable N2XH 3x2.5 mm2", "m", 250.0),
        ("LED luminaire 2x36W IP44", "ədəd", 26.0),
        ("PVC conduit 20 mm", "m", 120.0),
        ("Distribution board 24 way", "dəst", 1.0),
    }
    for f in res.found:
        rect = [r for r in value_rect(doc, 0, f.sources[0]["value"]) if abs(r.y0 - f.row_cy) < 12][0]
        assert contains(f.sources[0]["box"], rect)


@pytest.mark.parametrize("rotation", [0, 90, 270])
def test_rotated_sheet_boxes_follow_the_displayed_page(pdf_factory, rotation):
    items = [(80, 80, "FOUNDATION F1", 14), (80, 140, "Concrete volume C30 = 24.60 m3", 10),
             (80, 400, "Notes:", 9), (80, 420, "V = 100 m3 tank capacity", 9),
             (80, 440, "Minimum cover shall be 1.50 m", 9)]
    pdf = pdf_factory([items], rotation=rotation)
    (res, meta), doc = analyse(pdf)
    assert [(f.unit, f.qty) for f in res.found] == [("m³", 24.6)]
    f = res.found[0]
    assert f.kind == "concrete"
    rect = value_rect(doc, 0, "24.60")[0]
    assert contains(f.sources[0]["box"], rect)
    pw, ph = doc[0].rect.width, doc[0].rect.height
    x0, y0, x1, y1 = f.sources[0]["box"]
    assert 0 <= x0 < x1 <= pw and 0 <= y0 < y1 <= ph


def test_superscript_units(pdf_factory):
    from conftest import _FONT, add_unicode_font
    doc = pymupdf.open()
    page = doc.new_page(width=800, height=600)
    add_unicode_font(page)
    line = "Monolit d/b döşəmə tavası 1109.10 m"
    page.insert_text((60, 100), line, fontsize=10, fontname="U")
    page.insert_text((60 + _FONT.text_length(line, fontsize=10) + 0.5, 96), "2", fontsize=6, fontname="U")
    page.insert_text((60, 160), "Material: Beton B15 - 166.37 m3", fontsize=10, fontname="U")
    (res, meta), _ = analyse(doc.tobytes())
    conc = [f for f in res.found if f.kind == "concrete"]
    assert [(f.qty, f.unit) for f in conc] == [(166.37, "m³")]
    assert any(a["role"] == "area" and a["value"] == "1109.10" for a in conc[0].attach)


def test_calculation_sheets_are_not_billed(pdf_factory):
    items = [(60, 60, "HEAT LOSS CALCULATION", 14), (60, 100, "Surface", 9), (200, 100, "Area", 9), (300, 100, "m2", 9),
             (60, 120, "Floor", 9), (200, 120, "1", 9), (60, 140, "External wall", 9), (200, 140, "3.3", 9),
             (60, 160, "Concrete slab 24.0 m3", 9)]
    (res, meta), _ = analyse(pdf_factory([items]))
    assert res.found == [] and meta.get("calc")


def test_image_only_sheet_reports_no_text_layer():
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=400)
    page.draw_rect(pymupdf.Rect(50, 50, 300, 200), color=(0, 0, 0))
    (res, meta), _ = analyse(doc.tobytes())
    assert res.text_layer is False and res.found == []


def test_nothing_is_invented_for_a_sheet_without_quantities(pdf_factory, tmp_path):
    pdf = pdf_factory([[(60, 60, "GROUND FLOOR PLAN", 14), (60, 100, "Living room", 9), (200, 120, "6000", 8)]])
    data = T.process_uploaded_drawing_package(pdf, "plan.pdf", "Villa", asset_dir="t-empty")
    assert data["items"] == []
    assert any(g["en"] == "No quantities found" for g in data["gaps"])


CONSUMPTION = [
    (500, 60, "Polad sərfi cədvəli, kq (21 ədəd üçün)", 10),
    (300, 90, "Elementin", 8), (430, 90, "A-I (A240)", 8), (640, 90, "A500C", 8), (800, 90, "Yekun", 8), (860, 90, "Beton", 8),
    (300, 100, "markası", 8), (860, 100, "B25", 8),
    (400, 115, "Ø8", 8), (450, 115, "Ø10", 8), (500, 115, "Cəmi:", 8), (580, 115, "Ø16", 8), (640, 115, "Ø18", 8), (720, 115, "Cəmi:", 8),
    (300, 135, "Sütun Ms-1", 8), (400, 135, "100.0", 8), (450, 135, "48.7", 8), (500, 135, "148.7", 8),
    (580, 135, "500.0", 8), (640, 135, "465.6", 8), (720, 135, "965.6", 8), (800, 135, "1114.3", 8), (860, 135, "32.55", 8), (895, 135, "m3", 8),
    (300, 155, "Rigel MR-1", 8), (400, 155, "50.0", 8), (450, 155, "-", 8), (500, 155, "50.0", 8),
    (580, 155, "300.0", 8), (640, 155, "-", 8), (720, 155, "400.0", 8), (800, 155, "450.0", 8), (860, 155, "8.80", 8), (895, 155, "m3", 8),
    (300, 300, "Material: Beton B25 - 1.55 m3", 8),
]


def test_consumption_table_reads_classes_concrete_and_flags_bad_sums(pdf_factory):
    (res, meta), doc = analyse(pdf_factory([CONSUMPTION]))
    got = sorted((f.kind, f.bar or "", f.qty) for f in res.found)
    assert got == sorted([
        ("rebar", "A240", 148.7), ("rebar", "A500C", 965.6), ("concrete", "", 32.55),
        ("rebar", "A240", 50.0), ("rebar", "A500C", 400.0), ("concrete", "", 8.8),
    ])  # the per-element "1.55 m3" is not billed twice
    arith = [c for c in res.checks if c["kind"] == "arithmetic"]
    assert len(arith) == 1 and arith[0]["printed"] == 400.0 and arith[0]["expected"] == 300.0
    labels = {f.label for f in res.found}
    assert "Sütun Ms-1" in labels and "Rigel MR-1" in labels


def test_full_package_writes_project_scoped_images(pdf_factory):
    pdf = pdf_factory([ENGLISH_SPEC, CONSUMPTION])
    data = T.process_uploaded_drawing_package(pdf, "AR.pdf", "Test", asset_dir="proj-a")
    assert all(s["img"].startswith("proj-a/") for s in data["sheets"])
    for s in data["sheets"]:
        assert (T.SHEETS_DIR / f"{s['img']}.webp").is_file()
        assert (T.SHEETS_DIR / f"{s['img']}.t.webp").is_file()
    assert not (T.SHEETS_DIR / "AR-1.webp").exists()  # nothing written outside the project folder
    ids = [i["id"] for i in data["items"]]
    assert len(ids) == len(set(ids))
    for it in data["items"]:
        assert it["rate"] in data["rates"]
        assert it["src"] and len(it["src"][0]["box"]) == 4
    assert {c["id"] for c in data["checks"]} and all(c.get("title") and c.get("kind") for c in data["checks"])


QOBU = {"KS": "Qobu konstruksiya.pdf", "MEP": "Qobu kommunikasiya ümumi.pdf", "AR": "Qobu inzibati bina ve anbar 28.09.2026.pdf"}


@pytest.mark.skipif(not (ROOT / "drawings" / QOBU["KS"]).exists(), reason="reference drawings not present")
def test_reference_project_recall():
    """Quantities hand-verified on the Qobu package must be found on the same sheet with the same value and unit."""
    gt = json.loads((ROOT / "app" / "src" / "data" / "qobu.json").read_text(encoding="utf-8"))
    unit = {"ədəd": "no", "m³": "m3", "m²": "m2", "dəst": "set", "komp": "set"}
    found = {}
    for code, fn in QOBU.items():
        doc = pymupdf.open(ROOT / "drawings" / fn)
        for i, page in enumerate(doc):
            res, _ = T.analyse_page(page, f"{code}-{i + 1}")
            found[(code, i + 1)] = res.found
    hit = total = 0
    for it in gt["items"]:
        if it["method"] != "schedule":
            continue
        code, pg = it["src"][0]["sheet"].split("-")
        total += 1
        hit += any(abs(f.qty - it["qty"]) <= max(0.01, 0.005 * it["qty"]) and unit.get(f.unit, f.unit) == unit.get(it["unit"], it["unit"])
                   for f in found.get((code, int(pg)), []))
    assert hit / total >= 0.95, f"recall {hit}/{total}"


LEGACY_SHEET = [
    # steel table in a legacy font: "Ъями" = Cəmi, "Йекун" = Yekun, "Елементин маркасы" = Elementin markası, split "Ø 8"
    (100, 420, "Bir element üçün polad sərfi cədvəli", 9),
    (300, 470, "Йекун", 8), (110, 480, "Елементин", 8), (110, 490, "маркасы", 8),
    (250, 500, "А240", 8), (410, 500, "А", 8), (418, 500, "-", 8), (424, 500, "500C", 8),
    (215, 520, "Ø", 8), (223, 520, "8", 8), (260, 520, "Ø", 8), (268, 520, "10", 8), (305, 520, "Ъями", 8),
    (360, 520, "Ø", 8), (368, 520, "12", 8), (410, 520, "Ø", 8), (418, 520, "14", 8), (500, 520, "Ъями", 8),
    # the data line runs into the title block on the right
    (110, 545, "Md-1", 8), (215, 545, "16.96", 8), (305, 545, "16.96", 8), (410, 545, "1278.48", 8), (500, 545, "1278.48", 8),
    (560, 545, "1295.44", 8), (760, 545, "Mühəndis", 8), (820, 545, "Qaraşov N.", 8),
    (300, 600, "Beton \"B25\" 10.60 m³", 9), (760, 600, "Mərhələ", 8), (820, 600, "Vərəq", 8), (870, 600, "Vərəqlər", 8),
    (760, 620, "Monolit divar Md-1 armaturlanması", 9), (760, 640, "Konstruktor", 8),
    (30, 300, "Яслин", 8), (30, 340, "Имза", 8),
]
INDEX_SHEET = [(60, 60, "VƏRƏQLƏRİN SİYAHISI", 12), (60, 100, "Md-1 vərəq.4 Monolit divar Md-1 42.40 m²", 9)]


def test_unseen_office_conventions(pdf_factory):
    pdf = pdf_factory([INDEX_SHEET, LEGACY_SHEET], size=(1190, 842))
    data = T.process_uploaded_drawing_package(pdf, "tank.pdf", "Tank", asset_dir="t-legacy")
    got = sorted((i["unit"], i["qty"], i["rate"]) for i in data["items"])
    assert got == sorted([("kg", 16.96, "rebar_ai"), ("kg", 1278.48, "rebar_a500"), ("m³", 10.6, "conc_b25")])
    conc = [i for i in data["items"] if i["unit"] == "m³"][0]
    assert "Monolit divar Md-1" in conc["en"]
    assert not any(i["unit"] == "m²" for i in data["items"])  # a drawing-list entry is never a bill line
    labels = " ".join(i["en"] for i in data["items"])
    assert "Яслин" not in labels and "Имза" not in labels and "Mühəndis" not in labels
    assert any("one element" in c["title"] for c in data["checks"])
