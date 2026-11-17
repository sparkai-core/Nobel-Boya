"""BOQ comparison: checks an uploaded client bill against the quantities read from the drawings.

Client lines are matched to drawing items one-to-one by description similarity, and
only when units are compatible (kg and t are converted). Lines that do not match a
single item are then tried against groups of items that share the same rate (for
example all A500C reinforcement), so a client line "Rebar A500C, total" can be
checked against the sum of the per-element reinforcement read from the schedules.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from tabular import (
    cell_text,
    norm_text,
    parse_number,
    read_table,
    unit_factor,
    units_compatible,
)

MATCH_TOLERANCE_PCT = 2.0
MIN_SCORE = 0.2

_STOP = {
    "və", "ve", "ilə", "ile", "üçün", "ucun", "the", "of", "and", "in", "with", "for", "to", "on", "a", "an", "all",
    "işləri", "isleri", "works", "work", "item", "supply", "install", "installation", "quraşdırılması", "mm", "m",
    "m2", "m3", "m²", "m³", "kg", "kq", "no", "ədəd", "əd", "pcs", "sheet", "vərəq", "d", "b", "-",
}

_SYNONYMS = {
    "beton": "concrete", "dəmir-beton": "concrete", "d/b": "concrete", "db": "concrete", "reinforced": "concrete",
    "armatur": "rebar", "reinforcement": "rebar", "armaturu": "rebar", "polad": "steel",
    "sütun": "column", "sütunlar": "column", "columns": "column", "kolon": "column",
    "tir": "beam", "rigel": "beam", "beams": "beam", "kəmər": "beam", "ригель": "beam",
    "bünövrə": "foundation", "başmaq": "foundation", "özül": "foundation", "foundations": "foundation", "footing": "foundation", "footings": "foundation",
    "döşəmə": "slab", "tava": "slab", "tavası": "slab", "plita": "slab", "slabs": "slab",
    "hazırlıq": "blinding", "hazirliq": "blinding",
    "a240": "a-i", "a-i": "a-i", "ai": "a-i", "a500c": "a500", "a500": "a500",
}


_STEMS = (("sütun", "column"), ("kolon", "column"), ("tava", "slab"), ("plit", "slab"), ("döşəmə", "slab"),
          ("bünövr", "foundation"), ("özül", "foundation"), ("başmaq", "foundation"), ("divar", "wall"),
          ("kəmər", "beam"), ("rigel", "beam"), ("atma", "beam"), ("pilləkən", "stair"), ("hazırlıq", "blinding"))


def _tokens(*texts: str) -> set:
    out = set()
    for t in texts:
        for tok in re.findall(r"[a-zəöüğışçø0-9/\-\.]+", norm_text(t)):
            tok = tok.strip(".-/")
            if not tok or tok in _STOP or len(tok) < 2 and not tok.isdigit():
                continue
            tok = _SYNONYMS.get(tok, tok)
            for stem, canon in _STEMS:
                if tok.startswith(stem):
                    tok = canon
                    break
            out.add(tok)
    return out


def _grades(toks: set) -> set:
    return {t for t in toks if re.fullmatch(r"b\d{1,2}(?:[.,]5)?", t)}


ELEMENT_TYPES = {"column", "beam", "slab", "foundation", "wall", "blinding", "stair", "pile"}


def _compatible(a: set, b: set) -> bool:
    ta, tb = a & ELEMENT_TYPES, b & ELEMENT_TYPES
    if ta and tb and not (ta & tb):
        return False  # a column is never the same work as a slab or a foundation
    ga, gb = _grades(a), _grades(b)
    if ga and gb and not (ga & gb):
        return False  # B20 concrete is not B25 concrete
    return True


def _similarity(a: set, b: set) -> float:
    if not a or not b or not _compatible(a, b):
        return 0.0
    inter = len(a & b)
    if inter < 2 and not (inter == 1 and min(len(a), len(b)) == 1):
        return 0.0
    return inter / len(a | b) + 0.25 * inter / min(len(a), len(b))


# ------------------------------------------------------------------ parsing

def parse_client_boq_report(content_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    table = read_table(content_bytes, filename, need=("desc", "qty"), prefer_sheet=("bill", "boq", "smeta", "smet", "hesab"))
    lines: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    for rec in table.records:
        desc = cell_text(rec.get("desc"))
        qty = parse_number(rec.get("qty"))
        rate = parse_number(rec.get("rate")) if "rate" in table.columns else None
        amount = parse_number(rec.get("amount")) if "amount" in table.columns else None
        if qty is None and amount is not None and rate:
            qty = round(amount / rate, 4)
        if not desc or len(desc) < 2:
            if qty is not None:
                skipped.append({"row": rec["_row"], "reason": "Quantity without a description"})
            continue
        if qty is None:
            continue  # section heading or note row
        if qty < 0:
            skipped.append({"row": rec["_row"], "reason": "Negative quantity"})
            continue
        unit_raw = cell_text(rec.get("unit"))
        lines.append({
            "row": rec["_row"],
            "code": cell_text(rec.get("code")) or str(rec["_row"]),
            "description": desc,
            "unit": unit_raw,
            "qty": qty,
            "rate": rate or 0.0,
            "amount": round(amount if amount is not None else qty * (rate or 0.0), 2),
        })
    report = {"sheet": table.sheet, "header_row": table.header_row, "columns": table.headers,
              "lines_read": len(lines), "skipped": skipped, "warnings": table.warnings}
    return lines, report


def parse_client_boq(content_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    return parse_client_boq_report(content_bytes, filename)[0]


# ---------------------------------------------------------------- comparison

def _rate_of(rates: Dict[str, Any], key: str) -> Tuple[float, str, str]:
    r = rates.get(key)
    if isinstance(r, dict):
        return float(r.get("rate", 0) or 0), r.get("unit", ""), r.get("en", key)
    try:
        return float(r or 0), "", key
    except (TypeError, ValueError):
        return 0.0, "", key


def _status(diff_pct: float, diff: float) -> str:
    if abs(diff_pct) <= MATCH_TOLERANCE_PCT:
        return "match"
    return "over_measured" if diff > 0 else "under_measured"


def compare_boqs(client_lines: List[Dict[str, Any]], generated_project_data: Dict[str, Any]) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = [i for i in generated_project_data.get("items", []) if float(i.get("qty") or 0) > 0]
    rates: Dict[str, Any] = generated_project_data.get("rates", {}) or {}

    item_tokens = {i["id"]: _tokens(i.get("az", ""), i.get("en", "")) for i in items}
    client_tokens = [_tokens(c["description"]) for c in client_lines]

    # Candidates: single items, and groups of items that share one rate (a client line such as
    # "Rebar A500C" usually totals every A500C line read from the schedules).
    by_id = {i["id"]: i for i in items}
    groups: Dict[str, List[str]] = {}
    for it in items:
        groups.setdefault(it.get("rate", ""), []).append(it["id"])
    group_tokens = {}
    for rk, ids in groups.items():
        if len(ids) < 2:
            continue
        r = rates.get(rk) if isinstance(rates.get(rk), dict) else {}
        group_tokens[rk] = _tokens(r.get("en", ""), r.get("az", ""))

    pairs = []
    for ci, c in enumerate(client_lines):
        for it in items:
            if c["unit"] and not units_compatible(c["unit"], it.get("unit", "")):
                continue
            sc = _similarity(client_tokens[ci], item_tokens[it["id"]])
            if sc >= MIN_SCORE:
                pairs.append((sc, ci, "item", it["id"]))
        for rk, toks in group_tokens.items():
            unit = by_id[groups[rk][0]].get("unit", "")
            if c["unit"] and not units_compatible(c["unit"], unit):
                continue
            if not all(_compatible(client_tokens[ci], item_tokens[m]) for m in groups[rk]):
                continue
            sc = _similarity(client_tokens[ci], toks)
            if sc >= MIN_SCORE + 0.1:
                pairs.append((sc + 0.05, ci, "group", rk))  # a work-type description outranks one element
    pairs.sort(key=lambda p: -p[0])
    client_match: Dict[int, Tuple[List[str], float]] = {}
    used: set = set()
    for sc, ci, kind, key in pairs:
        if ci in client_match:
            continue
        if kind == "item":
            if key in used:
                continue
            ids = [key]
        else:
            ids = [i for i in groups[key] if i not in used]
            if not ids:
                continue
        client_match[ci] = (ids, sc)
        used.update(ids)

    results: List[Dict[str, Any]] = []
    for ci, c in enumerate(client_lines):
        c_unit = c["unit"]
        if ci in client_match:
            ids, score = client_match[ci]
            matched = [by_id[i] for i in ids]
            g_unit = matched[0].get("unit", "")
            target_unit = c_unit or g_unit
            g_qty = round(sum(float(m.get("qty") or 0) * unit_factor(m.get("unit", ""), target_unit) for m in matched), 3)
            diff = round(c["qty"] - g_qty, 3)
            pct = round(diff / g_qty * 100, 1) if g_qty else 0.0
            p_rate, p_unit, _ = _rate_of(rates, matched[0].get("rate", ""))
            p_rate_client_unit = p_rate / unit_factor(p_unit or g_unit, target_unit) if p_rate else 0.0
            rate_pct = round((c["rate"] - p_rate_client_unit) / p_rate_client_unit * 100, 1) if (c["rate"] and p_rate_client_unit) else None
            src = matched[0].get("src") or [{}]
            results.append({
                "code": c["code"],
                "row": c.get("row"),
                "description": c["description"],
                "unit": c_unit or g_unit,
                "client_qty": c["qty"],
                "generated_qty": g_qty,
                "diff_qty": diff,
                "pct_variance": pct,
                "status": _status(pct, diff),
                "client_rate": c["rate"],
                "project_rate": round(p_rate_client_unit, 4),
                "rate_variance_pct": rate_pct,
                "client_amount": c["amount"],
                "generated_amount": round(g_qty * p_rate_client_unit, 2),
                "matched_items": ids,
                "matched_description": matched[0].get("en") if len(matched) == 1 else _rate_of(rates, matched[0].get("rate", ""))[2],
                "match_score": round(score, 2),
                "cited_sheet": src[0].get("sheet", "N/A"),
                "quote": src[0].get("quote", ""),
            })
        else:
            results.append({
                "code": c["code"],
                "row": c.get("row"),
                "description": c["description"],
                "unit": c_unit,
                "client_qty": c["qty"],
                "generated_qty": 0.0,
                "diff_qty": c["qty"],
                "pct_variance": 100.0,
                "status": "not_in_drawings",
                "client_rate": c["rate"],
                "project_rate": None,
                "rate_variance_pct": None,
                "client_amount": c["amount"],
                "generated_amount": 0.0,
                "matched_items": [],
                "matched_description": None,
                "match_score": 0.0,
                "cited_sheet": "N/A",
                "quote": "No matching quantity was read from the drawings.",
            })

    for it in items:
        if it["id"] in used:
            continue
        p_rate, _, _ = _rate_of(rates, it.get("rate", ""))
        src = it.get("src") or [{}]
        q = float(it.get("qty") or 0)
        results.append({
            "code": "AI-FOUND",
            "row": None,
            "description": it.get("az") or it.get("en") or "Item",
            "unit": it.get("unit", ""),
            "client_qty": 0.0,
            "generated_qty": q,
            "diff_qty": -q,
            "pct_variance": -100.0,
            "status": "missing_in_client_boq",
            "client_rate": None,
            "project_rate": p_rate,
            "rate_variance_pct": None,
            "client_amount": 0.0,
            "generated_amount": round(q * p_rate, 2),
            "matched_items": [it["id"]],
            "matched_description": it.get("en"),
            "match_score": 0.0,
            "cited_sheet": src[0].get("sheet", "N/A"),
            "quote": src[0].get("quote", ""),
        })

    def count(s: str) -> int:
        return sum(1 for r in results if r["status"] == s)

    summary = {
        "total_client_lines": len(client_lines),
        "total_generated_items": len(items),
        "matches": count("match"),
        "over_measured": count("over_measured"),
        "under_measured": count("under_measured"),
        "missing_in_client_boq": count("missing_in_client_boq"),
        "not_in_drawings": count("not_in_drawings"),
        "rate_differences": sum(1 for r in results if r.get("rate_variance_pct") not in (None,) and abs(r["rate_variance_pct"]) > MATCH_TOLERANCE_PCT),
        "client_total": round(sum(c["amount"] for c in client_lines), 2),
        "generated_total": round(sum(r["generated_amount"] for r in results), 2),
    }
    return {"summary": summary, "lines": results}
