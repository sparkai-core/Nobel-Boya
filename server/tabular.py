"""Shared reader for tabular uploads (rate schedules and client bills).

Finds the header row wherever it sits, works out which column holds the code,
description, unit, quantity, rate and amount, and parses numbers written in
either English (1,250.50) or Azerbaijani/European (1 250,50 / 1.250,50) style.
Reads .csv, .xlsx/.xlsm and legacy .xls.
"""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

SUPPORTED_EXTENSIONS = (".csv", ".xlsx", ".xlsm", ".xls")

ROLES = ("code", "desc", "unit", "qty", "rate", "amount")


class TableError(ValueError):
    """Raised when an upload cannot be read as a table."""


# ----------------------------------------------------------------- text helpers

def norm_text(s: Any) -> str:
    """Lower-case, NFC-normalised, single-spaced text. Turkish/Azerbaijani dotted I is folded."""
    if s is None:
        return ""
    t = unicodedata.normalize("NFC", str(s))
    # "İ".lower() yields "i" + combining dot; fold it to a plain "i" first
    t = t.replace("İ", "I").lower().replace("i̇", "i")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def norm_key(s: Any) -> str:
    """Canonical form of a rate code: case-, space-, dot-, dash- and underscore-insensitive."""
    t = norm_text(s)
    t = re.sub(r"[\s._\-/]+", "_", t)
    return t.strip("_")


_UNIT_ALIASES = {
    "m3": "m³", "m³": "m³", "м3": "m³", "kub.m": "m³", "kub m": "m³", "cu.m": "m³", "cum": "m³", "cbm": "m³",
    "m2": "m²", "m²": "m²", "м2": "m²", "kv.m": "m²", "kv m": "m²", "sq.m": "m²", "sqm": "m²",
    "m": "m", "p.m": "m", "p.m.": "m", "pm": "m", "m.p": "m", "m.p.": "m", "rm": "m", "lm": "m", "п.м": "m", "пм": "m", "metr": "m",
    "kg": "kg", "kq": "kg", "kq.": "kg", "kg.": "kg", "кг": "kg",
    "t": "t", "ton": "t", "tn": "t", "tonne": "t", "т": "t",
    "no": "no", "no.": "no", "nr": "no", "nos": "no", "pcs": "no", "pc": "no", "ea": "no", "each": "no",
    "əd": "no", "əd.": "no", "ədəd": "no", "ed": "no", "ed.": "no", "шт": "no", "шт.": "no", "ədəd.": "no",
    "dəst": "set", "dest": "set", "set": "set", "kompl": "set", "kompl.": "set", "komplekt": "set", "компл": "set",
    "l": "l", "lt": "l", "litr": "l",
    "item": "item", "sum": "item", "ls": "item", "l.s": "item",
}


def norm_unit(u: Any) -> str:
    """Map unit spellings to one canonical form (m³, m², m, kg, t, no, set, l, item)."""
    t = norm_text(u).replace(" ", "")
    if not t:
        return ""
    t2 = t.rstrip(".")
    return _UNIT_ALIASES.get(t, _UNIT_ALIASES.get(t2, _UNIT_ALIASES.get(t2 + ".", t)))


def units_compatible(a: str, b: str) -> bool:
    ua, ub = norm_unit(a), norm_unit(b)
    if not ua or not ub:
        return True
    if ua == ub:
        return True
    return {ua, ub} in ({"kg", "t"}, {"no", "set"})


def unit_factor(src: str, dst: str) -> float:
    """Factor converting a quantity in unit `src` into unit `dst` (only kg<->t differ)."""
    s, d = norm_unit(src), norm_unit(dst)
    if s == "t" and d == "kg":
        return 1000.0
    if s == "kg" and d == "t":
        return 0.001
    return 1.0


# ---------------------------------------------------------------- number parsing

_CURRENCY = re.compile(r"(azn|manat|man\.|usd|eur|rub|aed|₼|\$|€|£|₽)", re.IGNORECASE)


def parse_number(v: Any) -> Optional[float]:
    """Parse a cell into a float. Returns None for blanks, dashes and text."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s or s in {"-", "--", "—", "–", "x", "n/a", "N/A"}:
        return None
    s = _CURRENCY.sub("", s)
    s = s.replace(" ", "").replace(" ", "").replace(" ", "").replace("'", "")
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg, s = True, s[1:-1]
    if s.startswith("-"):
        neg, s = True, s[1:]
    if not re.fullmatch(r"[0-9.,]+", s) or not re.search(r"\d", s):
        return None
    has_c, has_d = "," in s, "." in s
    if has_c and has_d:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")  # 1.250,50
        else:
            s = s.replace(",", "")  # 1,250.50
    elif has_c:
        parts = s.split(",")
        if len(parts) > 2:
            s = s.replace(",", "")  # 1,250,000
        else:
            intpart, frac = parts
            # 1,250 with a non-zero integer part reads as thousands; 0,250 / 12,5 read as decimals
            if len(frac) == 3 and intpart not in ("", "0"):
                s = intpart + frac
            else:
                s = intpart + "." + frac
    elif has_d and s.count(".") > 1:
        s = s.replace(".", "")  # 1.250.000
    try:
        val = float(s)
    except ValueError:
        return None
    return -val if neg else val


# ----------------------------------------------------------------- header logic

def _has(cell: str, *phrases: str) -> bool:
    for p in phrases:
        if re.search(r"(?<![a-zəöüğışç0-9])" + re.escape(p) + r"(?![a-zəöüğışç0-9])", cell):
            return True
    return False


def classify_header(cell: Any) -> Optional[str]:
    """Return the role of a header cell, or None. Order matters: 'Unit rate' is a rate, 'Item description' is a description."""
    c = norm_text(cell)
    if not c or len(c) > 60:
        return None
    if _has(c, "unit rate", "unit price", "rate", "price", "vahid qiyməti", "vahid qiymət", "qiymət", "qiyməti",
            "qiymet", "cost per unit", "unit cost", "цена", "расценка"):
        return "rate"
    if _has(c, "amount", "total", "məbləğ", "məbləği", "cəmi", "cemi", "dəyər", "dəyəri", "сумма", "стоимость", "line total"):
        return "amount"
    if _has(c, "qty", "quantity", "quant", "miqdar", "miqdarı", "həcm", "həcmi", "sayı", "say", "кол-во", "количество", "объем"):
        return "qty"
    if _has(c, "description", "desc", "təsvir", "təsviri", "adı", "ad", "işin adı", "işlərin adı", "name", "work",
            "наименование", "item description", "material", "materialın adı"):
        if not _has(c, "code", "kod"):
            return "desc"
    if _has(c, "unit", "units", "uom", "u/m", "vahid", "vahidi", "ölçü", "ölçü vahidi", "ed. izm", "ед. изм", "ед.изм"):
        return "unit"
    if _has(c, "code", "kod", "kodu", "no", "no.", "nr", "№", "item no", "item", "ref", "s/n", "sl", "pos", "maddə", "şifr", "шифр", "код"):
        return "code"
    if c in {"#", "№", "n"}:
        return "code"
    return None


def _score_header(row: Sequence[Any]) -> Tuple[int, Dict[str, int]]:
    cols: Dict[str, int] = {}
    for idx, cell in enumerate(row):
        role = classify_header(cell)
        if role and role not in cols:
            cols[role] = idx
    score = len(cols)
    if "rate" in cols or "qty" in cols:
        score += 1
    if "desc" in cols:
        score += 1
    return score, cols


@dataclass
class Table:
    sheet: str
    header_row: int  # 1-based
    columns: Dict[str, int]
    headers: Dict[str, str]
    records: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def _find_header(rows: List[List[Any]], need: Sequence[str]) -> Optional[Tuple[int, Dict[str, int], int]]:
    best = None
    for i, row in enumerate(rows[:40]):
        score, cols = _score_header(row)
        if not all(r in cols for r in need):
            continue
        if best is None or score > best[2]:
            best = (i, cols, score)
    return best


def _infer_numeric_column(rows: List[List[Any]], start: int, exclude: Sequence[int]) -> Optional[int]:
    """Right-most column where most data rows hold a number. Used when a file has no rate/qty header."""
    width = max((len(r) for r in rows[start:start + 50]), default=0)
    best = None
    for c in range(width - 1, -1, -1):
        if c in exclude:
            continue
        vals = [r[c] for r in rows[start:start + 50] if c < len(r) and str(r[c] if r[c] is not None else "").strip()]
        if len(vals) < 1:
            continue
        nums = sum(1 for v in vals if parse_number(v) is not None)
        if nums / len(vals) >= 0.6:
            best = c
            break
    return best


# ------------------------------------------------------------------ file reading

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "cp1254", "cp1251"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _read_csv(content: bytes) -> List[Tuple[str, List[List[Any]]]]:
    text = _decode(content)
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delim = dialect.delimiter
    except csv.Error:
        counts = {d: sample.count(d) for d in (";", "\t", ",", "|")}
        delim = max(counts, key=counts.get) if any(counts.values()) else ","
    rows = [list(r) for r in csv.reader(io.StringIO(text), delimiter=delim)]
    return [("csv", rows)]


def _read_xlsx(content: bytes) -> List[Tuple[str, List[List[Any]]]]:
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as exc:
        raise TableError("The Excel file could not be opened. Save it again as .xlsx and retry.") from exc
    out = []
    for ws in wb.worksheets:
        if getattr(ws, "sheet_state", "visible") != "visible":
            continue
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        out.append((ws.title, rows))
    wb.close()
    return out


def _xlsx_has_uncached_formulas(content: bytes, sheet: str) -> bool:
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=False, read_only=True)
        ws = wb[sheet]
        for r in ws.iter_rows(values_only=True):
            for v in r:
                if isinstance(v, str) and v.startswith("="):
                    wb.close()
                    return True
        wb.close()
    except Exception:
        return False
    return False


def _read_xls(content: bytes) -> List[Tuple[str, List[List[Any]]]]:
    try:
        import xlrd
    except ImportError as exc:  # pragma: no cover
        raise TableError("Legacy .xls files need the 'xlrd' package on the server. Save the file as .xlsx instead.") from exc
    try:
        book = xlrd.open_workbook(file_contents=content)
    except Exception as exc:
        raise TableError("The .xls file could not be opened. Save it again as .xlsx and retry.") from exc
    out = []
    for sh in book.sheets():
        if sh.visibility != 0:
            continue
        rows = []
        for r in range(sh.nrows):
            row = []
            for c in range(sh.ncols):
                cell = sh.cell(r, c)
                row.append(None if cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK) else cell.value)
            rows.append(row)
        out.append((sh.name, rows))
    return out


def read_sheets(content: bytes, filename: str) -> List[Tuple[str, List[List[Any]]]]:
    fn = (filename or "").lower()
    if not content:
        raise TableError("The uploaded file is empty.")
    if fn.endswith(".csv"):
        return _read_csv(content)
    if fn.endswith((".xlsx", ".xlsm")):
        if not content.startswith(b"PK"):
            if content.startswith(b"\xd0\xcf\x11\xe0"):
                return _read_xls(content)
            raise TableError("This file is not a valid .xlsx workbook.")
        return _read_xlsx(content)
    if fn.endswith(".xls"):
        if content.startswith(b"PK"):
            return _read_xlsx(content)
        return _read_xls(content)
    raise TableError("Unsupported file type. Upload .csv, .xlsx or .xls.")


def _clean_rows(rows: List[List[Any]]) -> List[List[Any]]:
    out = []
    for r in rows:
        cells = [(c.strip() if isinstance(c, str) else c) for c in r]
        out.append(cells)
    return out


def read_table(content: bytes, filename: str, need: Sequence[str], prefer_sheet: Sequence[str] = ()) -> Table:
    """Read the best-matching sheet and return records keyed by role.

    `need` lists the roles that must be present in the header (a missing rate/qty
    column is inferred from data when possible).
    """
    sheets = read_sheets(content, filename)
    candidates = []
    for name, rows in sheets:
        rows = _clean_rows(rows)
        found = _find_header(rows, [r for r in need if r not in ("rate", "qty")])
        if not found:
            continue
        hdr_idx, cols, score = found
        data_rows = sum(1 for r in rows[hdr_idx + 1:] if any(c not in (None, "") for c in r))
        pref = any(p in name.lower() for p in prefer_sheet)
        candidates.append((pref, score, data_rows, name, rows, hdr_idx, cols))
    if not candidates:
        roles = ", ".join(need)
        raise TableError(f"No header row found. The file needs column headings for: {roles} (for example 'Code, Description, Unit, Rate').")
    candidates.sort(key=lambda c: (c[0], c[1], c[2]), reverse=True)
    _, _, _, name, rows, hdr_idx, cols = candidates[0]
    warnings: List[str] = []

    for role in ("rate", "qty"):
        if role in need and role not in cols:
            col = _infer_numeric_column(rows, hdr_idx + 1, exclude=list(cols.values()))
            if col is None:
                raise TableError(f"No '{role}' column found. Add a heading such as '{'Rate' if role == 'rate' else 'Quantity'}'.")
            cols[role] = col
            warnings.append(f"No '{role}' heading found; used column {col + 1} because it holds numbers.")

    header_row = rows[hdr_idx]
    headers = {role: str(header_row[i]) if i < len(header_row) and header_row[i] is not None else "" for role, i in cols.items()}
    table = Table(sheet=name, header_row=hdr_idx + 1, columns=cols, headers=headers, warnings=warnings)

    for ridx in range(hdr_idx + 1, len(rows)):
        r = rows[ridx]
        if not any(c not in (None, "") for c in r):
            continue
        rec: Dict[str, Any] = {"_row": ridx + 1}
        for role, ci in cols.items():
            rec[role] = r[ci] if ci < len(r) else None
        table.records.append(rec)

    if filename.lower().endswith((".xlsx", ".xlsm")):
        num_role = "rate" if "rate" in cols else "qty"
        if table.records and all(rec.get(num_role) in (None, "") for rec in table.records):
            if _xlsx_has_uncached_formulas(content, name):
                raise TableError("The workbook's numbers are formulas with no saved values. Open it in Excel, save it, and upload again.")
    return table


def cell_text(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()
