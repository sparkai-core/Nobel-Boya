"""Commercial Rates Importer: parses CSV and Excel (.xlsx, .xls) rate files.
Extracts item keys, descriptions, units, and rates with intelligent column matching.
"""
import io
import csv
from typing import Dict, Any, List
import openpyxl


def parse_csv_rates(content_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """Parse CSV rates file and extract rate dictionary."""
    text = content_bytes.decode("utf-8-sig", errors="ignore")
    # Detect delimiter
    sample = text[:2048]
    delim = ","
    if sample.count(";") > sample.count(","):
        delim = ";"
    elif sample.count("\t") > sample.count(","):
        delim = "\t"

    reader = csv.reader(io.StringIO(text), delimiter=delim)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return {}

    header = [c.strip().lower() for c in rows[0]]
    rates = {}

    # Locate column indexes
    key_idx = -1
    desc_idx = -1
    unit_idx = -1
    rate_idx = -1

    for idx, col in enumerate(header):
        if any(k in col for k in ["code", "key", "kod", "maddə", "no", "item"]):
            key_idx = idx
        elif any(k in col for k in ["desc", "name", "təsvir", "ad", "işin adı", "material"]):
            desc_idx = idx
        elif any(k in col for k in ["unit", "vahid", "ölçü"]):
            unit_idx = idx
        elif any(k in col for k in ["rate", "price", "qiymət", "vahid qiymət", "məzənnə", "cost"]):
            rate_idx = idx

    # If no rate column identified by name, check last numeric column
    if rate_idx == -1 and len(rows) > 1:
        for idx in reversed(range(len(rows[1]))):
            try:
                float(rows[1][idx].replace(",", ".").replace("AZN", "").strip())
                rate_idx = idx
                break
            except Exception:
                continue

    if rate_idx == -1:
        rate_idx = len(header) - 1

    for r_idx, row in enumerate(rows[1:]):
        if len(row) <= rate_idx:
            continue
        try:
            val_str = row[rate_idx].replace(",", ".").replace("AZN", "").replace("$", "").strip()
            rate_val = float(val_str)
        except Exception:
            continue

        raw_key = row[key_idx].strip() if key_idx != -1 and len(row) > key_idx else f"rate_{r_idx + 1}"
        desc = row[desc_idx].strip() if desc_idx != -1 and len(row) > desc_idx else raw_key
        unit = row[unit_idx].strip() if unit_idx != -1 and len(row) > unit_idx else "m³"

        key = raw_key.lower().replace(" ", "-").replace(".", "-")
        rates[key] = {
            "rate": round(rate_val, 2),
            "unit": unit or "m³",
            "en": desc or key,
            "az": desc or key,
            "group": "Uploaded rates"
        }

    return rates


def parse_excel_rates(content_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """Parse Excel (.xlsx, .xls) rates file."""
    wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
    ws = wb.active
    rows = []
    for r in ws.iter_rows(values_only=True):
        if any(c is not None for c in r):
            rows.append([str(c or "").strip() for c in r])

    if not rows:
        return {}

    header = [c.lower() for c in rows[0]]
    rates = {}

    key_idx = -1
    desc_idx = -1
    unit_idx = -1
    rate_idx = -1

    for idx, col in enumerate(header):
        if any(k in col for k in ["code", "key", "kod", "maddə", "no", "item"]):
            key_idx = idx
        elif any(k in col for k in ["desc", "name", "təsvir", "ad", "material"]):
            desc_idx = idx
        elif any(k in col for k in ["unit", "vahid", "ölçü"]):
            unit_idx = idx
        elif any(k in col for k in ["rate", "price", "qiymət", "vahid qiymət", "cost"]):
            rate_idx = idx

    if rate_idx == -1 and len(rows) > 1:
        rate_idx = len(rows[0]) - 1

    for r_idx, row in enumerate(rows[1:]):
        if len(row) <= rate_idx:
            continue
        try:
            val_str = row[rate_idx].replace(",", ".").replace("AZN", "").strip()
            rate_val = float(val_str)
        except Exception:
            continue

        raw_key = row[key_idx].strip() if key_idx != -1 and len(row) > key_idx else f"rate_{r_idx + 1}"
        desc = row[desc_idx].strip() if desc_idx != -1 and len(row) > desc_idx else raw_key
        unit = row[unit_idx].strip() if unit_idx != -1 and len(row) > unit_idx else "m³"

        key = raw_key.lower().replace(" ", "-").replace(".", "-")
        rates[key] = {
            "rate": round(rate_val, 2),
            "unit": unit or "m³",
            "en": desc or key,
            "az": desc or key,
            "group": "Uploaded rates"
        }

    return rates


def parse_rates_file(content_bytes: bytes, filename: str) -> Dict[str, Dict[str, Any]]:
    fn = filename.lower()
    if fn.endswith(".csv"):
        return parse_csv_rates(content_bytes)
    elif fn.endswith((".xlsx", ".xls")):
        return parse_excel_rates(content_bytes)
    else:
        raise ValueError("Unsupported rate file format. Please upload .csv or .xlsx / .xls.")


if __name__ == "__main__":
    sample_csv = b"Code,Description,Unit,Rate\nconc-b25,Concrete B25,m3,175.50\nrebar-a500,Rebar A500C,kg,1.85\n"
    res = parse_rates_file(sample_csv, "rates.csv")
    print("Parsed sample rates:", res)
