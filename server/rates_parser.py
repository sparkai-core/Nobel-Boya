"""Rate schedule import: reads .csv/.xlsx/.xls rate lists and merges them into a project's rate library.

Each row is matched to an existing rate by code first, then by description (with a
compatible unit). Matched rates keep their description, group and unit; only the
price changes. Unmatched rows are added as new rates. Every row that is skipped is
reported with the reason, so nothing disappears silently.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from tabular import (
    TableError,
    cell_text,
    norm_key,
    norm_text,
    norm_unit,
    parse_number,
    read_table,
    unit_factor,
    units_compatible,
)

MAX_RATE = 10_000_000.0


def _tokens(s: str) -> set:
    return {t for t in re.findall(r"[a-zəöüğışç0-9]+", norm_text(s)) if len(t) > 1}


def _display_unit(u: str) -> str:
    return {"no": "ədəd", "set": "dəst"}.get(u, u)


def parse_rate_rows(content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Return (rows, report). Each row: {row, code, desc, unit, rate}."""
    table = read_table(content, filename, need=("rate",), prefer_sheet=("rate", "qiymət", "price", "tarif"))
    if "code" not in table.columns and "desc" not in table.columns:
        raise TableError("The rate file needs a 'Code' or a 'Description' column so each rate can be matched to a BOQ item.")
    rows: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    for rec in table.records:
        code = cell_text(rec.get("code"))
        desc = cell_text(rec.get("desc"))
        raw_rate = rec.get("rate")
        rate = parse_number(raw_rate)
        if rate is None:
            if cell_text(raw_rate) == "":
                if not code or not desc:
                    continue  # a heading row such as "Concrete works" carries no price
                skipped.append({"row": rec["_row"], "reason": "No rate given"})
            else:
                skipped.append({"row": rec["_row"], "reason": f"Rate '{cell_text(raw_rate)}' is not a number"})
            continue
        if not code and not desc:
            skipped.append({"row": rec["_row"], "reason": "No code or description"})
            continue
        if rate < 0:
            skipped.append({"row": rec["_row"], "reason": "Negative rate"})
            continue
        if rate > MAX_RATE:
            skipped.append({"row": rec["_row"], "reason": "Rate is implausibly large"})
            continue
        rows.append({
            "row": rec["_row"],
            "code": code,
            "desc": desc,
            "unit": norm_unit(rec.get("unit")) if "unit" in table.columns else "",
            "rate": round(rate, 4),
        })
    report = {
        "sheet": table.sheet,
        "header_row": table.header_row,
        "columns": table.headers,
        "rows_read": len(rows),
        "skipped": skipped,
        "warnings": list(table.warnings),
    }
    return rows, report


def _match_existing(row: Dict[str, Any], existing: Dict[str, Any], by_norm: Dict[str, str]) -> Tuple[Optional[str], str]:
    code = row["code"]
    if code:
        if code in existing:
            return code, "code"
        k = by_norm.get(norm_key(code))
        if k:
            return k, "code"
    desc = row["desc"]
    if desc:
        nd = norm_text(desc)
        exact = [k for k, v in existing.items() if isinstance(v, dict) and nd in (norm_text(v.get("en")), norm_text(v.get("az")))]
        exact = [k for k in exact if units_compatible(row["unit"], existing[k].get("unit", ""))]
        if len(exact) == 1:
            return exact[0], "description"
        td = _tokens(desc)
        if len(td) >= 2:
            scored = []
            for k, v in existing.items():
                if not isinstance(v, dict) or not units_compatible(row["unit"], v.get("unit", "")):
                    continue
                tv = _tokens(v.get("en", "")) | _tokens(v.get("az", ""))
                if not tv:
                    continue
                j = len(td & tv) / len(td | tv)
                scored.append((j, k))
            scored.sort(reverse=True)
            if scored and scored[0][0] >= 0.75 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.1):
                return scored[0][1], "description"
    return None, ""


def _new_key(row: Dict[str, Any], existing: Dict[str, Any]) -> str:
    base = row["code"].strip() if row["code"] else "rate_" + (norm_key(row["desc"])[:40] or "item")
    key, n = base, 2
    while key in existing:
        key = f"{base}_{n}"
        n += 1
    return key


def merge_rates(existing: Dict[str, Any], rows: List[Dict[str, Any]], source_name: str = "Uploaded rates") -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Merge parsed rate rows into a copy of `existing`. Returns (rates, report)."""
    rates = {k: (dict(v) if isinstance(v, dict) else {"rate": float(v or 0), "unit": "", "en": k, "group": "Rates"}) for k, v in existing.items()}
    by_norm: Dict[str, str] = {}
    for k in rates:
        by_norm.setdefault(norm_key(k), k)

    updated, added, unchanged, conflicts = [], [], [], []
    for row in rows:
        key, how = _match_existing(row, rates, by_norm)
        if key:
            cur = rates[key]
            cur_unit = norm_unit(cur.get("unit", ""))
            new_rate = row["rate"]
            if row["unit"] and cur_unit and not units_compatible(row["unit"], cur_unit):
                conflicts.append({"row": row["row"], "key": key, "reason": f"Unit in file is {_display_unit(row['unit'])}, rate '{key}' is per {cur.get('unit')}; not applied"})
                continue
            if row["unit"] and cur_unit and row["unit"] != cur_unit:
                # price per t applied to a per-kg rate, or the other way round
                new_rate = round(new_rate / unit_factor(row["unit"], cur_unit), 6)
            old = float(cur.get("rate", 0) or 0)
            if abs(old - new_rate) < 1e-9:
                unchanged.append(key)
                continue
            cur["rate"] = new_rate
            cur["source"] = source_name
            if not cur.get("unit") and row["unit"]:
                cur["unit"] = _display_unit(row["unit"])
            updated.append({"row": row["row"], "key": key, "matched_by": how, "old": old, "new": new_rate, "en": cur.get("en", key)})
        else:
            key = _new_key(row, rates)
            desc = row["desc"] or row["code"]
            rates[key] = {
                "rate": row["rate"],
                "unit": _display_unit(row["unit"]) or "",
                "en": desc,
                "az": desc,
                "group": "Uploaded rates",
                "source": source_name,
            }
            by_norm.setdefault(norm_key(key), key)
            added.append({"row": row["row"], "key": key, "rate": row["rate"], "en": desc})
    report = {"updated": updated, "added": added, "unchanged": len(unchanged), "conflicts": conflicts}
    return rates, report


# Backwards-compatible helper: returns {key: {rate, unit, en, az, group}} for the rows in a file.
def parse_rates_file(content_bytes: bytes, filename: str) -> Dict[str, Dict[str, Any]]:
    rows, _ = parse_rate_rows(content_bytes, filename)
    merged, _ = merge_rates({}, rows)
    return merged


if __name__ == "__main__":
    sample = b"Code,Description,Unit,Unit Rate\nconc_col,Concrete B25 in columns,m3,\"1,250.50\"\n"
    print(parse_rate_rows(sample, "r.csv"))
