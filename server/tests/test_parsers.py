import io

import openpyxl
import pytest

from boq_comparator import compare_boqs, parse_client_boq
from rates_parser import merge_rates, parse_rate_rows
from tabular import TableError, classify_header, parse_number


@pytest.mark.parametrize("raw,expected", [
    ("1,250.50", 1250.5), ("1.250,50", 1250.5), ("1 250,50", 1250.5), ("12,5", 12.5), ("0,250", 0.25),
    ("1,250", 1250.0), ("285 AZN", 285.0), ("₼ 3.40", 3.4), ("-", None), ("", None), ("abc", None), (42, 42.0),
    ("1,250,000", 1250000.0), ("(15)", -15.0),
])
def test_parse_number(raw, expected):
    assert parse_number(raw) == expected


@pytest.mark.parametrize("cell,role", [
    ("Unit Rate", "rate"), ("Vahid qiymət", "rate"), ("Item Description", "desc"), ("Item No", "code"),
    ("Unit", "unit"), ("Vahid", "unit"), ("Qty", "qty"), ("Miqdarı", "qty"), ("Amount", "amount"), ("Kod", "code"),
    ("Description", "desc"), ("Rate (AZN)", "rate"), ("Ölçü vahidi", "unit"),
])
def test_header_roles(cell, role):
    assert classify_header(cell) == role


def rows_of(csv: str, name="r.csv"):
    rows, report = parse_rate_rows(csv.encode("utf-8"), name)
    return rows, report


def test_rates_unit_rate_header_keeps_unit():
    rows, _ = rows_of("Code,Description,Unit,Unit Rate\nconc_col,Concrete columns,m3,285\n")
    assert rows == [{"row": 2, "code": "conc_col", "desc": "Concrete columns", "unit": "m³", "rate": 285.0}]


def test_rates_azerbaijani_headers():
    rows, _ = rows_of("Kod,Təsvir,Vahid,Vahid qiymət\nconc_col,Beton,m3,285\n")
    assert rows[0]["rate"] == 285.0 and rows[0]["unit"] == "m³" and rows[0]["code"] == "conc_col"


def test_rates_item_no_and_item_description():
    rows, _ = rows_of("Item No,Item Description,Unit,Rate\nconc_col,Concrete columns,m3,285\n")
    assert rows[0]["code"] == "conc_col" and rows[0]["desc"] == "Concrete columns"


def test_rates_number_formats_and_title_rows():
    csv = 'Rate schedule 2026,,,\n,,,\nCode;Description;Unit;Rate\nconc_col;Conc;m3;1 250,50\nrebar;Rebar;kg;"1,92"\n'
    rows, report = rows_of(csv.replace(",,,", ";;;"))
    assert [r["rate"] for r in rows] == [1250.5, 1.92]
    assert report["header_row"] == 3


def test_rates_skipped_rows_are_reported():
    rows, report = rows_of("Code,Description,Unit,Rate\na,A,m3,12\nb,B,m3,n/a?\nc,C,m3,-5\nConcrete works,,,\n")
    assert len(rows) == 1
    reasons = {s["row"]: s["reason"] for s in report["skipped"]}
    assert 3 in reasons and 4 in reasons and 5 not in reasons  # heading row is skipped quietly


def test_rates_xlsx_with_zero_rate_and_numeric_codes():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Price list"])
    ws.append(["Code", "Description", "Unit", "Rate"])
    ws.append([1.1, "Concrete", "m3", 285])
    ws.append(["rebar_a500", "Rebar", "kg", 0])
    b = io.BytesIO()
    wb.save(b)
    rows, _ = parse_rate_rows(b.getvalue(), "r.xlsx")
    assert [(r["code"], r["rate"]) for r in rows] == [("1.1", 285.0), ("rebar_a500", 0.0)]


def test_xls_errors_are_clear():
    with pytest.raises(TableError):
        parse_rate_rows(b"\xd0\xcf\x11\xe0 not really", "r.xls")
    with pytest.raises(TableError):
        parse_rate_rows(b"", "r.csv")


def test_merge_preserves_description_and_matches_by_description():
    existing = {
        "conc_col": {"rate": 268.0, "unit": "m³", "en": "Concrete B25 in columns, all-in with formwork", "group": "Concrete"},
        "rebar_a500": {"rate": 1.92, "unit": "kg", "en": "Rebar A500C, cut, bent and fixed", "group": "Reinforcement"},
    }
    rows = [
        {"row": 2, "code": "CONC-COL", "desc": "x", "unit": "m³", "rate": 300.0},             # code, case/dash-insensitive
        {"row": 3, "code": "", "desc": "Rebar A500C, cut, bent and fixed", "unit": "t", "rate": 2100.0},  # description; per t
        {"row": 4, "code": "new-1", "desc": "Formwork", "unit": "m²", "rate": 20.0},
    ]
    merged, rep = merge_rates(existing, rows)
    assert merged["conc_col"]["rate"] == 300.0 and merged["conc_col"]["en"].startswith("Concrete B25")
    assert merged["conc_col"]["group"] == "Concrete"
    assert merged["rebar_a500"]["rate"] == pytest.approx(2.1)  # 2100 per t -> 2.10 per kg
    assert merged["new-1"]["rate"] == 20.0 and merged["new-1"]["unit"] == "m²"
    assert {u["key"] for u in rep["updated"]} == {"conc_col", "rebar_a500"}
    assert existing["conc_col"]["rate"] == 268.0  # input not mutated


def test_merge_refuses_unit_conflict():
    merged, rep = merge_rates({"conc_col": {"rate": 268.0, "unit": "m³", "en": "Concrete", "group": "C"}},
                              [{"row": 2, "code": "conc_col", "desc": "", "unit": "kg", "rate": 1.0}])
    assert merged["conc_col"]["rate"] == 268.0 and rep["conflicts"]


def test_client_boq_headers():
    csv = "Item,Item Description,Unit,Qty,Unit Rate,Amount\n1.1,Concrete columns,m3,30,240,7200\n"
    lines = parse_client_boq(csv.encode(), "b.csv")
    assert lines[0]["description"] == "Concrete columns" and lines[0]["unit"] == "m3" and lines[0]["rate"] == 240.0


def _project():
    return {
        "items": [
            {"id": "a", "az": "Beton B25 — Monolit d/b sütun Ms-1", "en": "Concrete B25, column Ms-1", "unit": "m³", "qty": 32.55, "rate": "conc_col", "src": [{"sheet": "KS-15", "quote": "q"}]},
            {"id": "b", "az": "Armatur A500C — sütun Ms-1", "en": "Reinforcement A500C, column Ms-1", "unit": "kg", "qty": 1965.6, "rate": "rebar_a500", "src": [{"sheet": "KS-15", "quote": "q"}]},
            {"id": "c", "az": "Armatur A500C — rigel MR-1", "en": "Reinforcement A500C, beam MR-1", "unit": "kg", "qty": 1925.7, "rate": "rebar_a500", "src": [{"sheet": "KS-23", "quote": "q"}]},
            {"id": "d", "az": "Kabel N2XH 3x4", "en": "Cable N2XH 3x4", "unit": "m", "qty": 120, "rate": "x", "src": [{"sheet": "MEP-7", "quote": "q"}]},
        ],
        "rates": {"conc_col": {"rate": 268.0, "unit": "m³", "en": "Concrete B25 in columns"},
                  "rebar_a500": {"rate": 1.92, "unit": "kg", "en": "Rebar A500C, cut, bent and fixed"},
                  "x": {"rate": 0, "unit": "m", "en": "Cable"}},
    }


def test_compare_units_groups_and_prices():
    lines = [
        {"code": "1", "description": "Concrete B25 columns Ms-1", "unit": "m3", "qty": 32.55, "rate": 300.0, "amount": 9765.0},
        {"code": "2", "description": "Rebar A500C, cut, bent and fixed", "unit": "t", "qty": 4.2, "rate": 2000.0, "amount": 8400.0},
        {"code": "3", "description": "Concrete B25 columns Ms-1", "unit": "kg", "qty": 5, "rate": 0, "amount": 0},
    ]
    res = compare_boqs(lines, _project())
    by = {l["code"]: l for l in res["lines"]}
    assert by["1"]["status"] == "match" and by["1"]["matched_items"] == ["a"]
    assert by["1"]["rate_variance_pct"] == pytest.approx(11.9, abs=0.1)
    # client line in tonnes matched against the sum of both A500C items in kg
    assert set(by["2"]["matched_items"]) == {"b", "c"}
    assert by["2"]["generated_qty"] == pytest.approx((1965.6 + 1925.7) / 1000, abs=0.001)
    assert by["2"]["status"] == "over_measured"
    assert by["3"]["status"] == "not_in_drawings"  # kg cannot match a m³ item
    assert res["summary"]["missing_in_client_boq"] == 1  # the cable


def test_compare_never_matches_different_element_types():
    proj = {"items": [{"id": "f", "az": "Beton B20 — Monolit bünövrə tavası Btv-1", "en": "Concrete B20, foundation slab Btv-1",
                       "unit": "m³", "qty": 8.46, "rate": "k", "src": [{"sheet": "S-7", "quote": "q"}]}],
            "rates": {"k": {"rate": 0, "unit": "m³", "en": "Concrete"}}}
    res = compare_boqs([{"code": "1", "description": "Beton B20 sütun", "unit": "m3", "qty": 0.8, "rate": 0, "amount": 0}], proj)
    assert res["lines"][0]["status"] == "not_in_drawings"


def test_compare_respects_azerbaijani_element_words_and_grades():
    proj = {"items": [{"id": "w", "az": "Beton B25 — Monolit divar Md-1", "en": "Concrete B25, Monolit divar Md-1",
                       "unit": "m³", "qty": 10.6, "rate": "k", "src": [{"sheet": "S-4", "quote": "q"}]},
                      {"id": "s", "az": "Beton B25 — Örtük tavasının Mtv-1", "en": "Concrete B25, Örtük tavasının Mtv-1",
                       "unit": "m³", "qty": 1.58, "rate": "k", "src": [{"sheet": "S-5", "quote": "q"}]}],
            "rates": {"k": {"rate": 0, "unit": "m³", "en": "Concrete"}}}
    lines = [{"code": "1", "description": "Monolit örtük tavası beton B20", "unit": "m3", "qty": 2.91, "rate": 0, "amount": 0},
             {"code": "2", "description": "Örtük tavası beton B25", "unit": "m3", "qty": 1.58, "rate": 0, "amount": 0}]
    by = {l["code"]: l for l in compare_boqs(lines, proj)["lines"]}
    assert by["1"]["status"] == "not_in_drawings"          # B20 vs B25, and slab vs wall
    assert by["2"]["matched_items"] == ["s"] and by["2"]["status"] == "match"
