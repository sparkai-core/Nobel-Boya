"""BOQ Comparison Engine: compares an uploaded client BOQ against the AI-generated BOQ.
Identifies over-measurements, under-measurements, omissions, and price variances.
"""
import io
import re
import csv
from typing import Dict, Any, List
import openpyxl


def parse_client_boq(content_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Parse client BOQ from Excel (.xlsx) or CSV."""
    fn = filename.lower()
    raw_rows = []

    if fn.endswith(".csv"):
        text = content_bytes.decode("utf-8-sig", errors="ignore")
        delim = ";" if text.count(";") > text.count(",") else ","
        reader = csv.reader(io.StringIO(text), delimiter=delim)
        raw_rows = [r for r in reader if any(c.strip() for c in r)]
    elif fn.endswith((".xlsx", ".xls")):
        wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
        # Prefer a sheet named 'Bill' or 'BOQ', else first sheet
        sheet_names = [s.lower() for s in wb.sheetnames]
        target_name = wb.sheetnames[0]
        for name in wb.sheetnames:
            if "bill" in name.lower() or "boq" in name.lower() or "smeta" in name.lower():
                target_name = name
                break
        ws = wb[target_name]
        for r in ws.iter_rows(values_only=True):
            if any(c is not None for c in r):
                raw_rows.append([str(c or "").strip() for c in r])

    if not raw_rows:
        return []

    # Detect header row
    header_idx = 0
    for idx, r in enumerate(raw_rows[:10]):
        row_str = " ".join(r).lower()
        if any(k in row_str for k in ["unit", "qty", "quantity", "rate", "amount", "sayı", "miqdar", "qiymət"]):
            header_idx = idx
            break

    header = [c.lower() for c in raw_rows[header_idx]]
    code_idx = -1
    desc_idx = -1
    unit_idx = -1
    qty_idx = -1
    rate_idx = -1
    amt_idx = -1

    for idx, col in enumerate(header):
        if any(k in col for k in ["item", "code", "no", "kod", "maddə"]):
            code_idx = idx
        elif any(k in col for k in ["desc", "description", "təsvir", "ad", "işin adı"]):
            desc_idx = idx
        elif any(k in col for k in ["unit", "vahid", "ölçü"]):
            unit_idx = idx
        elif any(k in col for k in ["qty", "quantity", "miqdar", "həcm", "sayı"]):
            qty_idx = idx
        elif any(k in col for k in ["rate", "price", "qiymət", "vahid qiymət"]):
            rate_idx = idx
        elif any(k in col for k in ["amount", "total", "məbləğ", "cəmi"]):
            amt_idx = idx

    client_lines = []
    for r_idx, row in enumerate(raw_rows[header_idx + 1:]):
        if len(row) <= max(desc_idx, qty_idx):
            continue

        code_val = row[code_idx].strip() if code_idx != -1 and len(row) > code_idx else f"{r_idx + 1}"
        desc_val = row[desc_idx].strip() if desc_idx != -1 and len(row) > desc_idx else ""
        if not desc_val or len(desc_val) < 2:
            continue

        try:
            qty_val = float(row[qty_idx].replace(",", ".").replace(" ", "").strip()) if qty_idx != -1 else 0.0
        except Exception:
            continue

        rate_val = 0.0
        if rate_idx != -1 and len(row) > rate_idx:
            try:
                rate_val = float(row[rate_idx].replace(",", ".").replace(" ", "").strip())
            except Exception:
                pass

        unit_val = row[unit_idx].strip() if unit_idx != -1 and len(row) > unit_idx else "m³"

        client_lines.append({
            "code": code_val,
            "description": desc_val,
            "unit": unit_val,
            "qty": qty_val,
            "rate": rate_val,
            "amount": round(qty_val * rate_val, 2)
        })

    return client_lines


def compare_boqs(client_lines: List[Dict[str, Any]], generated_project_data: Dict[str, Any]) -> Dict[str, Any]:
    """Compare client uploaded BOQ against the AI-generated BOQ items."""
    generated_items = generated_project_data.get("items", [])
    comparison_results = []

    matched_gen_ids = set()

    for c_line in client_lines:
        c_desc = c_line["description"].lower()
        c_qty = c_line["qty"]

        # Best match in generated items
        best_match = None
        best_score = 0

        for g_item in generated_items:
            g_desc = (g_item.get("az", "") + " " + g_item.get("en", "")).lower()
            # Token overlap score
            tokens_c = set(re.findall(r"\w+", c_desc))
            tokens_g = set(re.findall(r"\w+", g_desc))
            overlap = len(tokens_c.intersection(tokens_g))
            if overlap > best_score:
                best_score = overlap
                best_match = g_item

        if best_match and best_score >= 2:
            matched_gen_ids.add(best_match["id"])
            g_qty = best_match.get("qty", 0.0)
            diff = round(c_qty - g_qty, 2)
            pct = round((diff / g_qty) * 100, 1) if g_qty > 0 else 0.0

            if abs(pct) <= 2.0:
                status = "match"
            elif diff > 0:
                status = "over_measured"  # Client over-measured
            else:
                status = "under_measured"  # Client under-measured

            comparison_results.append({
                "code": c_line["code"],
                "description": c_line["description"],
                "unit": c_line["unit"],
                "client_qty": c_qty,
                "generated_qty": g_qty,
                "diff_qty": diff,
                "pct_variance": pct,
                "status": status,
                "cited_sheet": best_match.get("src", [{}])[0].get("sheet", "N/A"),
                "quote": best_match.get("src", [{}])[0].get("quote", "")
            })
        else:
            comparison_results.append({
                "code": c_line["code"],
                "description": c_line["description"],
                "unit": c_line["unit"],
                "client_qty": c_qty,
                "generated_qty": 0.0,
                "diff_qty": c_qty,
                "pct_variance": 100.0,
                "status": "not_in_drawings",
                "cited_sheet": "N/A",
                "quote": "Not cited in current drawing set schedules."
            })

    # Find items in drawings that client missed
    for g_item in generated_items:
        if g_item["id"] not in matched_gen_ids:
            comparison_results.append({
                "code": "AI-FOUND",
                "description": g_item.get("az", g_item.get("en", "Item")),
                "unit": g_item.get("unit", "m³"),
                "client_qty": 0.0,
                "generated_qty": g_item.get("qty", 0.0),
                "diff_qty": -g_item.get("qty", 0.0),
                "pct_variance": -100.0,
                "status": "missing_in_client_boq",
                "cited_sheet": g_item.get("src", [{}])[0].get("sheet", "N/A"),
                "quote": g_item.get("src", [{}])[0].get("quote", "")
            })

    summary = {
        "total_client_lines": len(client_lines),
        "total_generated_items": len(generated_items),
        "matches": sum(1 for r in comparison_results if r["status"] == "match"),
        "over_measured": sum(1 for r in comparison_results if r["status"] == "over_measured"),
        "under_measured": sum(1 for r in comparison_results if r["status"] == "under_measured"),
        "missing_in_client_boq": sum(1 for r in comparison_results if r["status"] == "missing_in_client_boq"),
        "not_in_drawings": sum(1 for r in comparison_results if r["status"] == "not_in_drawings"),
    }

    return {
        "summary": summary,
        "lines": comparison_results
    }
