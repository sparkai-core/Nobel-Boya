"""Takeoff engine: reads quantities that are written on the drawings and builds the BOQ dataset.

Rules
-----
* A quantity enters the bill only if it is printed on a sheet. The engine never
  estimates or fills in a number. Each item cites the sheet and the box around the
  printed value and its row label, in displayed (rotation-corrected) page points.
* Three sources are read:
    1. Steel consumption tables ("Polad sərfi cədvəli"): one row per element, with
       reinforcement totals per bar class and, where present, the concrete volume.
    2. Specification tables with a unit column (equipment, cable, pipe, materials):
       the quantity is the number in the row after the unit.
    3. Material statements such as "Material: Beton B25 - 15.36 m3".
* Schedule totals are cross-checked (bar diameters add up to the class total, class
  totals add up to the grand total). Mismatches become checks; they are not corrected.
* Sheets that carry schedules the engine cannot read, and sheets with no text layer,
  are listed as checks so they get measured by hand.
"""
from __future__ import annotations

import io
import json
import os
import re
import statistics
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import pymupdf
from PIL import Image

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parents[1] / "app" / "public"))
SHEETS_DIR = DATA_DIR / "sheets"
DEFAULT_RATES_PATH = Path(__file__).resolve().parents[1] / "app" / "src" / "data" / "qobu.json"

MAX_RASTER_PX = 6000  # longest side of the full-size sheet image


# --------------------------------------------------------------------------- reference data

SECTIONS = [
    {"id": "sub", "az": "Torpaqaltı hissə və bünövrələr", "en": "Substructure and foundations"},
    {"id": "frame", "az": "Monolit dəmir-beton karkas", "en": "Reinforced concrete frame"},
    {"id": "rebar", "az": "Armatur işləri", "en": "Reinforcement"},
    {"id": "steel", "az": "Metal konstruksiyalar", "en": "Structural steelwork"},
    {"id": "masonry", "az": "Hörgü işləri", "en": "Masonry"},
    {"id": "roof", "az": "Dam örtüyü və su axıdılması", "en": "Roofing and rainwater"},
    {"id": "openings", "az": "Qapı və pəncərələr", "en": "Doors and windows"},
    {"id": "finish", "az": "Bəzək işləri", "en": "Finishes"},
    {"id": "elec", "az": "Elektrik təchizatı", "en": "Electrical installation"},
    {"id": "hvac", "az": "İstilik, ventilyasiya və kondisionerləşdirmə", "en": "Heating, ventilation and air conditioning"},
    {"id": "plumb", "az": "Su təchizatı və kanalizasiya", "en": "Water supply and drainage"},
    {"id": "fire", "az": "Daxili yanğınsöndürmə", "en": "Firefighting water"},
    {"id": "alarm", "az": "Yanğın siqnalizasiyası", "en": "Fire alarm"},
    {"id": "lowcur", "az": "Rabitə və videomüşahidə", "en": "Communications and CCTV"},
    {"id": "pa", "az": "Səsli xəbərvermə", "en": "Public address"},
    {"id": "ext", "az": "Abadlaşdırma və yol örtükləri", "en": "Landscaping and paving"},
    {"id": "other", "az": "Digər işlər", "en": "Other works"},
]
SECTION_NAME = {s["id"]: s["en"] for s in SECTIONS}


def get_default_rates() -> Dict[str, Any]:
    """Sample rate library (from the reference project). Keys the engine maps to must exist here."""
    rates: Dict[str, Any] = {}
    if DEFAULT_RATES_PATH.exists():
        try:
            data = json.loads(DEFAULT_RATES_PATH.read_text(encoding="utf-8"))
            for k, v in data.get("rates", {}).items():
                rates[k] = dict(v)
        except Exception:
            pass
    fallback = {
        "conc_fdn": {"unit": "m³", "rate": 172.0, "en": "Concrete B25 in foundations, all-in with formwork", "group": "Concrete"},
        "conc_slab_grd": {"unit": "m³", "rate": 138.0, "en": "Concrete B15 in ground slab, placed and finished", "group": "Concrete"},
        "conc_blind": {"unit": "m³", "rate": 108.0, "en": "Concrete B7.5 blinding", "group": "Concrete"},
        "conc_col": {"unit": "m³", "rate": 268.0, "en": "Concrete B25 in columns, all-in with formwork", "group": "Concrete"},
        "conc_beam": {"unit": "m³", "rate": 246.0, "en": "Concrete B25 in beams, all-in with formwork", "group": "Concrete"},
        "conc_slab": {"unit": "m³", "rate": 214.0, "en": "Concrete B25 in suspended slab, all-in with formwork", "group": "Concrete"},
        "rebar_a500": {"unit": "kg", "rate": 1.92, "en": "Rebar A500C, cut, bent and fixed", "group": "Reinforcement"},
        "rebar_ai": {"unit": "kg", "rate": 2.04, "en": "Rebar A-I (A240), cut, bent and fixed", "group": "Reinforcement"},
        "steel_struct": {"unit": "kg", "rate": 4.65, "en": "Structural steel, fabricated, primed and erected", "group": "Steel"},
    }
    for k, v in fallback.items():
        rates.setdefault(k, v)
    return rates


# --------------------------------------------------------------------------- text primitives

def _fold(s: str) -> str:
    s = unicodedata.normalize("NFC", s or "")
    return s.replace("İ", "I").lower().replace("i̇", "i")


NUM_RE = re.compile(r"^\d{1,7}(?:[.,]\d{1,3})?$")
GLUED_RE = re.compile(r"^(\d{1,7}(?:[.,]\d{1,3})?)(m3|m³|m2|m²|kq|kg)$", re.IGNORECASE)
GRADE_RE = re.compile(r"\b[BВ](\d{1,2}(?:[.,]5)?)\b")
PREFIX_DIM_RE = re.compile(r"^(l|lüm|lum|h|d|r|b|t|δ|ø|i)\s*=", re.IGNORECASE)

STATEMENT_UNITS = {"m3": "m³", "m³": "m³", "м3": "m³", "(m3)": "m³", "(m³)": "m³", "(м3)": "m³", "m2": "m²", "m²": "m²", "м2": "m²",
                   "p.m": "m", "p.m.": "m", "п.м": "m", "kq": "kg", "kq.": "kg", "kg": "kg", "kg.": "kg", "ton": "t", "m": "m"}
TABLE_UNITS = {"nr": "ədəd", "nos": "ədəd", "nos.": "ədəd", "no's": "ədəd", "each": "ədəd", "ea": "ədəd", "pc": "ədəd",
               "set": "dəst", "sets": "dəst", "lm": "m", "rm": "m", "l.m": "m", "sqm": "m²", "sq.m": "m²", "sq.m.": "m²",
               "cum": "m³", "cu.m": "m³", "cu.m.": "m³", "tonne": "t", "tons": "t", "kgs": "kg", "мп": "m", "м.п.": "m",
               "komp": "dəst", "komp.": "dəst", "kompl": "dəst", "компл.": "dəst", "к-т": "dəst","əd": "ədəd", "əd.": "ədəd", "ədəd": "ədəd", "ed.": "ədəd", "шт": "ədəd", "шт.": "ədəd", "pcs": "ədəd",
               "m": "m", "m.": "m", "p.m": "m", "p.m.": "m", "pm": "m", "м": "m", "п.м": "m",
               "m2": "m²", "m²": "m²", "м2": "m²", "m3": "m³", "m³": "m³", "м3": "m³",
               "kq": "kg", "kq.": "kg", "kg": "kg", "кг": "kg", "t": "t", "ton": "t", "tn": "t",
               "dəst": "dəst", "dest": "dəst", "komplekt": "dəst", "kompl.": "dəst", "компл": "dəst", "компл.": "dəst"}

META_WORDS = {"drawn", "checked", "approved", "scale:", "scale", "dwg", "rev.", "revision", "revisions", "consultant",
              "разраб.", "пров.", "утв.", "н.контр.", "лист", "листов", "стадия", "gip:", "konstruktor", "vərəq", "vərəqlər", "mərhələ", "i.l.", "l.b.m.", "mühəndis", "format", "sifarişçi",
              "yoxladı", "n.nəz.", "n.nəzarət", "layihəçi", "icraçı", "rəhbəri", "gip", "qip"}
# Words of the binding-margin stamp. They share lines with table rows, so they are dropped one by one.
MARGIN_WORDS = {"əvəzi", "əslin", "razılaşdırılıb", "razılaşdırılmışdır", "razilasdirilmisdir", "əvəzinə", "invent", "inv.№", "imza", "tarix", "inv", "i̇nv.№"}
LOAD_WORDS = ("yük", "qar", "külək", "təzyiq", "нагруз", "load", "/m2", "/m²", "kq/m", "kg/m")

ELEMENT_WORDS = ("column", "beam", "slab", "footing", "foundation", "raft", "pile", "lintel", "stair", "retaining", "wall",
                 "колонн", "балк", "плит", "фундамент", "sütun", "kolon", "rigel", "tir", "kəmər", "bünövrə", "başmaq", "özül", "döşəmə", "tava", "plita",
                 "pilləkən", "divar", "monolit", "d/b", "d\\b", "ростверк", "svay", "hazırlıq", "hazirliq")
PROSE_WORDS = ("shall", "should", "not less", "not exceed", "unless", "refer to", "approx", "typical", "минимум", "не менее",
               "olmalı", "minimum", "maksimum", "hündürlü", "səviyyə", "məsafə", "dərinli", "sərfi", "olaraq",
               "hesabat", "ən azı", "qədər", "sutka", "saat", "radius", "en kəsiy")
FINISH_WORDS = ("tavan", "metlax", "alçipan", "şpaklovka", "yapışdırıcı", "məhlul", "dikt", "reyka", "tol", "düzləndirici",
                "qranit", "linoleum", "parket", "mərmər", "suvaq", "kağız", "armstronq", "plintus")


_WORD_RE_CACHE: Dict[Tuple[str, ...], Any] = {}


def has_word(text: str, words: Sequence[str]) -> bool:
    """True if any vocabulary entry starts a word in `text` ("tir" matches "tirlər", not "istirahət")."""
    key = tuple(words)
    rx = _WORD_RE_CACHE.get(key)
    if rx is None:
        rx = re.compile(r"(?<![a-zəöüğışçа-я0-9])(?:" + "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True)) + ")")
        _WORD_RE_CACHE[key] = rx
    return bool(rx.search(text))


def _is_prose(t: str) -> bool:
    """Notes and requirements ("... döşəmədən 1.0 m", "minimum 1.4 m olmalıdır"), not schedule rows."""
    return any(k in t for k in PROSE_WORDS) or bool(re.search(r"[a-zəöüğışç]{3,}(dən|dan)(?![a-zəöüğışç])", t))


MATERIAL_WORDS = ELEMENT_WORDS + ("concrete", "rebar", "reinforcement", "steel", "brick", "plaster", "paint", "tile", "screed",
                                  "waterproof", "insulation", "door", "window", "pipe", "cable", "duct", "ceiling", "floor",
                                  "roof", "kerb", "paving", "asphalt", "excavation", "backfill", "formwork", "membrane",
                                  "glazing", "railing", "conduit", "tray", "luminaire", "socket", "switch", "valve", "pump",
                                  "sheet", "cladding", "gypsum", "bitumen", "gravel", "sand", "timber",
                                  "бетон", "арматур", "кирпич", "труб", "кабел", "штукатур", "плитк", "утепл", "гидроизол",
                                  "beton", "armatur", "suvaq", "boya", "kafel", "keramo", "laminat", "örtük", "hörgü",
                                  "kərpic", "blok", "səki", "asfalt", "bordür", "qazıntı", "torpaq", "çınqıl", "qum",
                                  "qırmadaş", "karbonat", "taxta", "şalban", "izolya", "hidroizol", "teploizol", "profil",
                                  "polad", "metal", "boru", "kabel", "novça", "parapet", "pəncərə", "qapı", "vitraj", "material",
                                  "profnastil", "proflist", "sandviç", "panel", "membran", "şifer", "kirəmit")
SCHEDULE_WORDS = ("bar bending", "bill of quantit", "quantities", "specification", "material list", "таблиц", "cədvəl", "təsnifat", "spesifikasiya", "sərfi", "schedule", "ведомость", "спецификац", "siyahı")


@dataclass
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def h(self) -> float:
        return self.y1 - self.y0

    @property
    def low(self) -> str:
        return _fold(self.text)


@dataclass
class Row:
    idx: int
    words: List[Word]
    meta: bool = False

    @property
    def cy(self) -> float:
        return statistics.fmean(w.cy for w in self.words)

    @property
    def x0(self) -> float:
        return min(w.x0 for w in self.words)

    @property
    def x1(self) -> float:
        return max(w.x1 for w in self.words)

    def text(self, words: Optional[Sequence[Word]] = None) -> str:
        return " ".join(w.text for w in (words if words is not None else self.words))


_LEGACY_AZ = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "q", "д": "d", "е": "e", "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k",
    "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x",
    "ц": "ü", "ч": "ç", "ш": "ş", "щ": "h", "ъ": "c", "ы": "ı", "ь": "ğ", "э": "e", "ю": "ö", "я": "ə",
})


def kw(w: "Word") -> str:
    """Keyword form of a word: folded, punctuation-trimmed, legacy-font Cyrillic read as Azerbaijani Latin."""
    t = w.low.strip(":,.;()")
    if re.search(r"[а-яё]", t) and re.search(r"[яъьщцю]", t):
        t = t.translate(_LEGACY_AZ)
    return t


def is_num(w: Word) -> bool:
    return bool(NUM_RE.match(w.text))


def num(w: Word) -> float:
    return float(w.text.replace(",", "."))


def fmt_val(w: Word) -> str:
    return w.text


def union_box(words: Sequence[Word], pad: float = 2.5, page_w: float = 1e9, page_h: float = 1e9) -> List[float]:
    x0 = min(w.x0 for w in words) - pad
    y0 = min(w.y0 for w in words) - pad
    x1 = max(w.x1 for w in words) + pad
    y1 = max(w.y1 for w in words) + pad
    return [round(max(0.0, x0), 1), round(max(0.0, y0), 1), round(min(page_w, x1), 1), round(min(page_h, y1), 1)]


def page_words(page: pymupdf.Page) -> List[Word]:
    m = page.rotation_matrix
    out = []
    for w in page.get_text("words"):
        r = pymupdf.Rect(w[:4]) * m
        t = (w[4] or "").strip()
        if t and _margin_free(t):
            out.append(Word(r.x0, r.y0, r.x1, r.y1, t))
    return out


def _margin_free(t: str) -> bool:
    """Binding-margin stamps, also when written in a legacy font ("Яслин" = Əslin, "Имза" = İmza)."""
    f = _fold(t)
    return f not in MARGIN_WORDS and f.translate(_LEGACY_AZ) not in MARGIN_WORDS


def merge_diameter_signs(words: List[Word]) -> List[Word]:
    """'Ø' drawn apart from its number ('Ø 8') is one token, 'Ø8'."""
    signs = [i for i, w in enumerate(words) if w.text in ("Ø", "ø", "∅", "Ф", "ф")]
    if not signs:
        return words
    skip = set()
    for i in signs:
        a = words[i]
        best = None
        for j, b in enumerate(words):
            if j == i or j in skip or not re.fullmatch(r"\d{1,3}", b.text):
                continue
            if abs(b.cy - a.cy) < 0.6 * max(a.h, b.h) and -1 <= b.x0 - a.x1 < 4:
                best = j
                break
        if best is not None:
            b = words[best]
            words[i] = Word(a.x0, min(a.y0, b.y0), b.x1, max(a.y1, b.y1), "Ø" + b.text)
            skip.add(best)
    return [w for k, w in enumerate(words) if k not in skip]


def merge_superscripts(words: List[Word]) -> List[Word]:
    """'m' followed by a small raised '2'/'3' is m²/m³ (CAD text often draws the exponent as its own word)."""
    exps = [i for i, w in enumerate(words) if w.text in ("2", "3", "2)", "3)")]
    if not exps:
        return words
    skip = set()
    for a, wa in enumerate(words):
        if wa.text.lower() not in ("m", "м", "(m", "m.", "(м"):
            continue
        for b in exps:
            wb = words[b]
            if b in skip or not (-1.5 <= wb.x0 - wa.x1 < 3) or wb.h >= 0.85 * max(wa.h, 0.1):
                continue
            if not (wa.y0 - wb.h <= wb.cy < wa.cy):
                continue
            sup = "²" if wb.text.startswith("2") else "³"
            words[a] = Word(wa.x0, min(wa.y0, wb.y0), wb.x1, wa.y1, wa.text.rstrip(".") + sup + (")" if wb.text.endswith(")") else ""))
            skip.add(b)
            break
    return [w for i, w in enumerate(words) if i not in skip]


CALC_WORDS = ("istilik itki", "istilik itkiləri", "enerji effektiv", "enerji sinfi", "hesablama", "hesablanması", "hesabat",
              "izahat", "izahlı qeyd", "heat loss", "energy performance", "calculation", "design basis", "расчет", "расчёт",
              "пояснительн", "теплотехн", "энергетич")


def is_calc_page(text: str) -> bool:
    """Calculation reports and explanatory notes list areas and volumes for calculations, not work to be billed."""
    t = _fold(text[:6000])
    return any(k in t for k in CALC_WORDS)


def split_title_block(words: List[Word], pw: float, ph: float) -> Tuple[List[Word], List[Word]]:
    """Return (drawing words, title-block words). The title block is the region from the left-most
    title-block keyword ("Konstruktor", "Mərhələ", "Drawn", ...) in the lower part of the sheet to the
    bottom-right corner. A schedule line that runs into the title block keeps its own words."""
    # the title block is in the bottom-right corner; approval stamps elsewhere do not define it
    marks = [w for w in words if w.low in META_WORDS and w.cy > 0.55 * ph and w.cx > 0.45 * pw]
    if len(marks) < 2:
        return words, []
    x0 = min(w.x0 for w in marks) - 12
    y0 = min(w.y0 for w in marks) - 6
    inside = [w for w in words if w.x0 >= x0 and w.y0 >= y0]
    if len(inside) > 0.6 * len(words):
        return words, []  # not a title block; probably a text-heavy sheet
    keep = [w for w in words if not (w.x0 >= x0 and w.y0 >= y0)]
    return keep, inside


def build_rows(words: List[Word]) -> List[Row]:
    if not words:
        return []
    heights = [w.h for w in words if w.h > 0]
    med_h = statistics.median(heights) if heights else 8.0
    tol = max(1.8, 0.42 * med_h)
    ws = sorted(words, key=lambda w: (w.cy, w.x0))
    groups: List[List[Word]] = []
    centers: List[float] = []
    for w in ws:
        if groups and abs(w.cy - centers[-1]) <= tol:
            groups[-1].append(w)
            centers[-1] = statistics.fmean(x.cy for x in groups[-1])
        else:
            groups.append([w])
            centers.append(w.cy)
    rows = []
    for i, g in enumerate(groups):
        g.sort(key=lambda w: w.x0)
        meta = any(w.low in META_WORDS for w in g)
        rows.append(Row(i, g, meta))
    return rows


# --------------------------------------------------------------------------- classification

def discipline_of(text: str) -> str:
    t = _fold(text)
    rules = [
        ("pa", ("səsli xəbərvermə", "xəbərdarlıq sistemi", "оповещ")),
        ("alarm", ("yanğın siqnal", "siqnalizasiya", "пожарная сигнализ")),
        ("lowcur", ("videomüşahidə", "lan ", "lan-", "rabitə sistem", "rabitə xətt", "rabitə şəbək", "cctv", "zəif cərəyan", "telefon", "data network")),
        ("fire", ("yanğınsöndürmə", "yanğın su", "hidrant", "sprinkler")),
        ("hvac", ("ventilyasiya", "kondisioner", "istilik", "havalandırma", "hvac", "isitmə")),
        ("plumb", ("su təchizatı", "kanalizasiya", "su kəməri", "drenaj", "plumbing")),
        ("elec", ("elektrik", "işıqlandırma", "güc", "kabel", "elektrotəchizat", "torpaqlama", "electrical", "lighting", "power", "электро")),
        ("struct", ("bünövrə", "özül", "armatur", "monolit", "sütun", "rigel", "polad sərfi", "konstruksiya", "ferma", "foundation", "rebar",
                    "reinforcement", "column", "beam", "footing", "structural", "арматур", "фундамент", "rabitələr", "bərkitmə")),
        ("site", ("baş plan", "ərazi", "abadlaşdırma", "site plan", "landscape")),
        ("arch", ("fasad", "qapı", "pəncərə", "döşəmə", "bəzək", "memarlıq", "plan", "kəsik", "elevation", "floor")),
    ]
    # the discipline with the most keyword hits wins; a passing mention ("yanğın" in a general note) does not
    best, best_n = "general", 0
    for disc, keys in rules:
        n = sum(len(re.findall(r"(?<![a-zəöüğışç])" + re.escape(k), t)) for k in keys)
        if n > best_n:
            best, best_n = disc, n
    return best


def section_for(desc: str, unit: str, discipline: str, label: str = "") -> str:
    if label:
        own = section_for(label, unit, "", "")
        if own != "other":
            return own
    t = _fold(desc)
    if discipline in ("elec", "hvac", "plumb", "fire", "alarm", "lowcur", "pa"):
        return discipline
    if any(k in t for k in ("qapı", "pəncərə", "door", "window", "vitraj")):
        return "openings"
    if any(k in t for k in ("hörgü", "kərpic", "blok", "divar", "brick", "block")):
        return "masonry"
    if any(k in t for k in ("dam ", "dam örtüy", "novça", "roof", "gutter", "sandviç", "kirəmit", "profnastil", "şifer", "çatı")):
        return "roof"
    if any(k in t for k in ("suvaq", "boya", "kafel", "keramogranit", "laminat", "tavan", "plaster", "paint", "tile")):
        return "finish"
    if any(k in t for k in ("asfalt", "səki", "bordür", "yaşıllıq", "paving")):
        return "ext"
    if any(k in t for k in ("ferma", "profil", "polad", "metal", "steel", "lövhə", "dirsək", "bolt")) and unit in ("kg", "t"):
        return "steel"
    if discipline == "site":
        return "ext"
    return "other"


def bar_class(token: str) -> Optional[str]:
    t = _fold(token).replace(" ", "").strip(",.;:)(")
    t = t.replace("а", "a").replace("с", "c")  # Cyrillic look-alikes
    if re.fullmatch(r"a\(?-?i\)?|a-?\(?240\)?|ai|a-i\(a240\)|a-i\(a\)?|\(a240\)|a240c?", t):
        return "A240"
    if re.fullmatch(r"a-?ii|a\(?300\)?|a300c?", t):
        return "A300"
    if re.fullmatch(r"a-?iii|a-?\(?400\)?|a400c?|aiii", t):
        return "A400"
    if re.fullmatch(r"a-?\(?500\)?c?|a50c", t):
        return "A500C"
    if re.fullmatch(r"b500[abc]?|в500с?|fe500d?|fe415|gr\.?60|grade60", t):
        return {"fe415": "Fe415"}.get(t, "B500" if t.startswith(("b", "в")) else ("Gr60" if t.startswith("gr") else "Fe500"))
    return None


def rebar_rate_key(cls: str) -> Optional[str]:
    return {"A500C": "rebar_a500", "A240": "rebar_ai"}.get(cls)


def concrete_rate_key(context: str, grade: Optional[str]) -> Tuple[Optional[str], str]:
    """Return (library rate key or None, section)."""
    t = _fold(context)
    g = None
    if grade:
        try:
            g = float(grade.replace(",", "."))
        except ValueError:
            g = None
    if has_word(t, ("hazırlıq", "hazirliq")) or (g is not None and g <= 10):
        return "conc_blind", "sub"
    if has_word(t, ("blinding", "lean concrete", "подготовк")):
        return "conc_blind", "sub"
    if has_word(t, ("bünövrə", "başmaq", "özül", "ростверк", "fundament", "foundation", "footing", "raft", "pile cap", "фундамент")):
        return "conc_fdn", "sub"
    if has_word(t, ("sütun", "kolon", "column", "колонн")):
        return "conc_col", "frame"
    if has_word(t, ("rigel", "tir", "kəmər", "beam", "lintel", "балк", "ригел")):
        return "conc_beam", "frame"
    if has_word(t, ("döşəmə", "tava", "plita", "slab", "плит")):
        if g is not None and g <= 15:
            return "conc_slab_grd", "sub"
        return "conc_slab", "frame"
    return None, "frame"


STANDARD_RE = re.compile(r"^(гост|gost|düist|duist|düİst|снип|snip|azdtn|en|iso|bs|astm|din)$", re.IGNORECASE)
STD_NUM_RE = re.compile(r"^\d{2,6}[-–]\d{2,4}\*?$")
MARK_RE = re.compile(r"^[\"'«(]*[A-Za-zƏəÖöÜüÇçŞşĞğIıİА-Яа-я]{1,5}[-–]?\d{1,3}[a-zа-я]?[\"'»)]*[,.;:]?$")


def strip_standards(tokens: List[str]) -> List[str]:
    out, k = [], 0
    while k < len(tokens):
        if STANDARD_RE.match(tokens[k].strip(",.;:")):
            k += 1
            while k < len(tokens) and (STD_NUM_RE.match(tokens[k].strip(",.;:")) or re.fullmatch(r"[\d.\-–*]+", tokens[k])):
                k += 1
            continue
        if STD_NUM_RE.match(tokens[k].strip(",.;:")) and re.search(r"-(19|20)\d\d", tokens[k]):
            k += 1
            continue
        out.append(tokens[k])
        k += 1
    return out


ELEMENT_START = ("monolit", "d/b", "d\\b", "d.b", "dəmir-beton", "sütun", "rigel", "tir", "kəmər", "bünövrə", "başmaq",
                 "özül", "tava", "plita", "döşəmə", "divar", "pilləkən", "atma", "çətir", "lent", "column", "beam", "slab",
                 "footing", "foundation", "wall", "lintel", "raft", "колонн", "балк", "плит", "фундамент")


NAME_STOP = ("armaturlan", "sxem", "material", "sərfi", "spesifikasiya", "kəsik", "plan", "fasad", "detal", "düyün",
             "cədvəl", "təsnifat", "alt", "üst", "tor", "qəlib", "eskiz", "və", "ilə", "üçün", "bax")


NAME_STOP_EXACT = {"və", "ilə", "üçün", "bax", "alt", "üst", "tor", "and", "of", "for"}


def _is_name_stop(t: str) -> bool:
    f = _fold(t.strip(".,;:"))
    return f in NAME_STOP_EXACT or f.startswith(tuple(x for x in NAME_STOP if x not in NAME_STOP_EXACT))


def element_phrase(text: str) -> Tuple[str, Optional[str]]:
    """'4000 1 аr. L=4300 ГОСТ 34028-2016 Monolit örtük tavası Mtv-1 1 19.36 m²' -> ('Monolit örtük tavası Mtv-1', 'Mtv-1')."""
    toks = strip_standards(text.split())
    start = next((i for i, t in enumerate(toks) if _fold(t).startswith(ELEMENT_START)), None)
    if start is None:
        return "", None
    # keep up to two describing words before the element word ("Örtük tavası", "Lentvari monolit ...")
    for _ in range(2):
        prev = toks[start - 1] if start > 0 else ""
        if (re.fullmatch(r"[A-Za-zƏəÖöÜüÇçŞşĞğIıİ]{3,}", prev) and not _is_name_stop(prev) and not prev.isupper()
                and _fold(prev) not in META_WORDS and not _fold(prev).startswith(("vərəq", "sheet", "лист", "mərhələ"))):
            start -= 1
        else:
            break
    out: List[str] = []
    mark = None
    for t in toks[start:start + 10]:
        tt = t.strip(",;:")
        if _is_name_stop(tt) and out:
            break  # "armaturlanması", "sxemi", "material sərfi" describe the drawing, not the element
        if "=" in tt or (re.fullmatch(r"[+±\-]?\d+(?:[.,]\d+)?", tt) and out):
            break
        if tt.startswith("(") and re.search(r"\d", tt) and not MARK_RE.match(tt):
            break
        out.append(t.rstrip("."))
        if t.endswith(".") and not MARK_RE.match(tt):
            break  # end of a sentence
        if MARK_RE.match(tt) and re.search(r"\d", tt):
            mark = re.sub(r"[\"'«»(),.;:]", "", tt).replace("М", "M")
            break
    return " ".join(out).strip(" ,;:-"), mark


def find_element_name(rows: List[Row], cy: float, x: float) -> Tuple[str, Optional[str]]:
    """Name of the element a statement belongs to: the nearest heading with an element word, preferring
    one that carries a mark (Btv-1, Mk-1); the sheet's title-block name is the fallback."""
    best = None
    for r in rows:
        if r.meta:
            continue
        txt = r.text()
        if (len(txt.split()) > 14 or "%" in txt or _is_prose(_fold(txt)) or re.match(r"^\d{1,2}\.\s", txt)
                or re.search(r"(vərəq|лист|sheet|bax)", _fold(txt))):
            continue  # a numbered note or a sentence, not an element heading
        name, mark = element_phrase(txt)
        if not name:
            continue
        dy = cy - r.cy
        dist = (abs(dy) if dy >= 0 else 3 * abs(dy)) + 0.25 * abs((r.x0 + r.x1) / 2 - x)
        score = dist - (100 if mark else 0)
        if best is None or score < best[0]:
            best = (score, name, mark)
    return (best[1], best[2]) if best else ("", None)


def label_mark(label: str) -> Optional[str]:
    for t in label.split():
        tt = t.strip(",;:()\"'«»")
        if MARK_RE.match(tt) and re.search(r"\d", tt) and re.search(r"[A-Za-zƏəА-Яа-я]", tt):
            return tt.replace("М", "M")
    return None


_EDGE_NOISE = re.compile(r"^(?:[+±\-]?\d+(?:[.,]\d+)?|[-–—:;,.()]+)$")


def clean_label(words: Sequence[Word]) -> str:
    toks = strip_standards([w.text for w in words if _fold(w.text) not in MARGIN_WORDS])
    while toks and _EDGE_NOISE.match(toks[0]):
        toks.pop(0)
    while toks and _EDGE_NOISE.match(toks[-1]):
        toks.pop()
    txt = re.sub(r"\s+", " ", " ".join(toks))
    # a measurement in brackets after the name ("Bt-1 ( 21.16 m²)") is not part of the name
    txt = re.sub(r"\(\s*=?\s*[\d.,]+\s*(?:m²|m³|m2|m3|m|p\.m|pm|kq|kg|əd\.?)?\s*\)", "", txt)
    return re.sub(r"\s+", " ", txt).strip(" -–—:;,.")


# --------------------------------------------------------------------------- extraction results

@dataclass
class Found:
    kind: str                 # rebar | concrete | table | statement
    unit: str
    qty: float
    label: str
    sheet: str
    sources: List[Dict[str, Any]]
    method: str = "schedule"
    formula: Optional[str] = None
    note: Optional[str] = None
    grade: Optional[str] = None
    bar: Optional[str] = None
    context: str = ""
    row_cy: float = 0.0
    x: float = 0.0
    attach: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class PageResult:
    found: List[Found] = field(default_factory=list)
    checks: List[Dict[str, Any]] = field(default_factory=list)
    verified_totals: int = 0
    schedule_heading: Optional[Tuple[str, List[float]]] = None
    text_layer: bool = True
    ocr: bool = False


def src(sheet: str, words: Sequence[Word], quote_words: Sequence[Word], value: Optional[str], role: Optional[str], pw: float, ph: float) -> Dict[str, Any]:
    return {
        "sheet": sheet,
        "box": union_box(words, page_w=pw, page_h=ph),
        "quote": re.sub(r"\s+", " ", " ".join(w.text for w in quote_words)).strip()[:160],
        "value": value,
        "how": "text",
        "role": role,
    }


# ---------------------------------------------------------- 1. steel consumption tables

SUM_WORDS = {"cəmi:", "cəmi", "cemi", "cemi:", "итого", "итого:", "total", "total:", "subtotal", "sub-total"}
TOTAL_WORDS = {"yekun", "yekun:", "ümumi", "umumi", "hamısı", "всего", "всего:", "grand"}


def _is_dia(w: Word) -> bool:
    """Bar diameter headings: Ø12, ф12, T12, Y12, H12, #4, d12."""
    return bool(re.fullmatch(r"(?:[Øø∅Фф]|[TYH]|#|d)\s?\d{1,2}(?:mm)?", w.text.strip()))


def find_consumption_tables(rows: List[Row], sheet: str, pw: float, ph: float, res: PageResult) -> set:
    """Read steel consumption tables. Returns the set of row indexes consumed."""
    consumed: set = set()
    for hi, hrow in enumerate(rows):
        dias = [w for w in hrow.words if _is_dia(w)]
        sums = [w for w in hrow.words if kw(w) in {x.strip(":") for x in SUM_WORDS | TOTAL_WORDS}]
        if not sums or (len(sums) < 2 and len(dias) < 2) or len(dias) < 1:
            continue
        if hrow.idx in consumed:
            continue
        sums.sort(key=lambda w: w.cx)
        above = [r for r in rows[max(0, hi - 8):hi] if hrow.cy - r.cy < 90]
        header_rows = above + [hrow]

        classes: List[Tuple[float, str, Word]] = []
        for r in header_rows:
            ws_ = r.words
            used_i = set()
            for i in range(len(ws_)):
                if i in used_i:
                    continue
                # a class may be split over words: "А - 500C"
                for n in (1, 2, 3):
                    grp = ws_[i:i + n]
                    if len(grp) < n or any(b.x0 - a.x1 > 6 for a, b in zip(grp, grp[1:])):
                        break
                    c = bar_class("".join(g.text for g in grp))
                    if c:
                        classes.append(((grp[0].x0 + grp[-1].x1) / 2, c, grp[0]))
                        used_i.update(range(i, i + n))
                        break
        classes.sort(key=lambda t: t[0])

        total_anchor = None
        beton_anchor = None
        grade = None
        label_x0 = None
        for r in header_rows:
            for w in r.words:
                if r is not hrow and kw(w) in {t.strip(":") for t in TOTAL_WORDS | SUM_WORDS} and w.cx > sums[-1].cx + 5:
                    total_anchor = w
                if kw(w).startswith("beton") and w.cx > sums[-1].cx:
                    beton_anchor = w
                if kw(w).startswith("element") or kw(w).startswith("markas"):
                    label_x0 = w.x0 if label_x0 is None else min(label_x0, w.x0)
        if beton_anchor is not None:
            for r in header_rows + rows[hi + 1:hi + 2]:
                for w in r.words:
                    if abs(w.cx - beton_anchor.cx) < 40:
                        g = GRADE_RE.search(w.text)
                        if g:
                            grade = g.group(1)

        # anchors: diameters, class sums, grand total, concrete
        anchors: List[Tuple[float, str, Any]] = []
        for w in dias:
            anchors.append((w.cx, "dia", w))
        for i, w in enumerate(sums):
            prev_x = sums[i - 1].cx if i > 0 else -1e9
            cands = [c for c in classes if prev_x - 5 < c[0] < w.cx + 5]
            cls = cands[0][1] if cands else None
            anchors.append((w.cx, "sum", (cls, w, prev_x)))
        if total_anchor is not None:
            anchors.append((total_anchor.cx, "total", total_anchor))
        if beton_anchor is not None:
            anchors.append((beton_anchor.cx, "beton", beton_anchor))
        anchors.sort(key=lambda a: a[0])
        xs = [a[0] for a in anchors]
        gaps = [b - a for a, b in zip(xs, xs[1:]) if b - a > 1]
        tol = max(8.0, min(30.0, (min(gaps) / 2) if gaps else 20.0))
        first_x = min(xs) - tol
        last_x = max(xs) + tol + 25
        if label_x0 is None:
            label_x0 = first_x - 260
        label_x1 = first_x - 1

        # data lines below the header
        consumed.update(r.idx for r in header_rows)
        data_rows: List[Row] = []
        last_y = hrow.cy
        for r in rows[hi + 1:]:
            if r.cy - last_y > 45:
                break
            if r.meta:
                continue
            if any(kw(w) in SUM_WORDS for w in r.words) and sum(1 for w in r.words if _is_dia(w)) >= 2:
                break  # next table header
            own = [w for w in r.words if label_x0 - 10 <= w.cx <= last_x]  # only this table's columns
            rt = _fold(" ".join(w.text for w in own))
            heads = sum(1 for w in own if kw(w) in ("mövqe", "adı", "işarə", "qeyd", "miq", "kütlə", "поз", "наименование", "position", "description"))
            if any(k in rt for k in SCHEDULE_WORDS) or heads >= 2:
                break  # the next table's title or header row
            in_tab = [w for w in r.words if first_x <= w.cx <= last_x]
            in_lab = [w for w in r.words if label_x0 <= w.cx <= label_x1]
            if not in_tab and not in_lab:
                if r.cy - last_y > 20:
                    break
                continue
            data_rows.append(r)
            last_y = r.cy
        if not data_rows:
            continue

        # numeric tokens in table area, clustered into logical lines
        tokens = []
        for r in data_rows:
            for w in r.words:
                if first_x <= w.cx <= last_x and (is_num(w) or w.text in {"-", "--", "—"}):
                    tokens.append(w)
        tokens.sort(key=lambda w: w.cy)
        lines: List[List[Word]] = []
        for w in tokens:
            if lines and w.cy - statistics.fmean(t.cy for t in lines[-1]) <= 6.5:
                lines[-1].append(w)
            else:
                lines.append([w])
        lines = [ln for ln in lines if any(is_num(w) for w in ln)]
        if not lines:
            continue
        label_words_all = [w for r in data_rows for w in r.words if label_x0 <= w.cx <= label_x1]
        centers = [statistics.fmean(w.cy for w in ln) for ln in lines]

        for li, ln in enumerate(lines):
            cy = centers[li]
            up = (cy - centers[li - 1]) / 2 if li > 0 else 14
            down = (centers[li + 1] - cy) / 2 if li + 1 < len(lines) else 14
            lab = sorted([w for w in label_words_all if cy - min(up, 16) <= w.cy <= cy + min(down, 16)], key=lambda w: (round(w.cy / 4), w.x0))
            if lab:
                row_words = [w for r in data_rows for w in r.words if abs(w.cy - lab[0].cy) < 4 and w.x1 <= min(x.x0 for x in lab) + 1]
                left_edge = min(x.x0 for x in lab)
                for w in sorted(row_words, key=lambda w: -w.x1):
                    if left_edge - w.x1 > 40 or is_num(w):
                        break
                    lab.insert(0, w)
                    left_edge = w.x0
            label = clean_label(lab) or f"row {li + 1}"
            cells: Dict[int, Word] = {}
            for w in ln:
                if not is_num(w):
                    continue
                best = min(range(len(anchors)), key=lambda k: abs(anchors[k][0] - w.cx))
                if abs(anchors[best][0] - w.cx) <= tol and best not in cells:
                    cells[best] = w
            # class totals
            class_vals: List[Tuple[str, float, Word]] = []
            for k, (ax, kind, payload) in enumerate(anchors):
                if kind != "sum" or k not in cells:
                    continue
                cls, sum_w, prev_x = payload
                val = num(cells[k])
                dia_cells = [cells[j] for j, a in enumerate(anchors) if a[1] == "dia" and prev_x < a[0] < ax and j in cells]
                if dia_cells:
                    dsum = round(sum(num(c) for c in dia_cells), 2)
                    if abs(dsum - val) > max(0.6, 0.006 * max(val, dsum)):
                        res.checks.append(_arith_check(sheet, f"{label}: {cls or 'class'} total", val, dsum, "kg",
                                                       [src(sheet, lab + [cells[k]], lab + [cells[k]], cells[k].text, "printed", pw, ph)] +
                                                       [src(sheet, [c], [c], c.text, "part", pw, ph) for c in dia_cells]))
                    else:
                        res.verified_totals += 1
                if val > 0:
                    class_vals.append((cls or "rebar", val, cells[k]))
            # grand total check
            tot_idx = next((k for k, a in enumerate(anchors) if a[1] == "total"), None)
            if tot_idx is not None and tot_idx in cells and class_vals:
                tval = num(cells[tot_idx])
                csum = round(sum(v for _, v, _ in class_vals), 2)
                if abs(tval - csum) > max(0.6, 0.006 * max(tval, csum)):
                    res.checks.append(_arith_check(sheet, f"{label}: grand total", tval, csum, "kg",
                                                   [src(sheet, lab + [cells[tot_idx]], lab + [cells[tot_idx]], cells[tot_idx].text, "printed", pw, ph)] +
                                                   [src(sheet, [w], [w], w.text, "part", pw, ph) for _, _, w in class_vals]))
                else:
                    res.verified_totals += 1
            for cls, val, w in class_vals:
                f = Found(kind="rebar", unit="kg", qty=val, label=label, sheet=sheet, bar=cls,
                          sources=[src(sheet, lab + [w], lab + [w], w.text, None, pw, ph)], row_cy=cy, x=w.cx)
                res.found.append(f)
            bet_idx = next((k for k, a in enumerate(anchors) if a[1] == "beton"), None)
            if bet_idx is not None and bet_idx in cells:
                w = cells[bet_idx]
                val = num(w)
                if val > 0:
                    unit_w = [u for r in data_rows for u in r.words if abs(u.cy - w.cy) < 4 and 0 < u.x0 - w.x1 < 25 and u.low in ("m3", "m³", "м3")]
                    g = grade
                    m = GRADE_RE.search(label)
                    if m:
                        g = m.group(1)
                    res.found.append(Found(kind="concrete", unit="m³", qty=val, label=label, sheet=sheet, grade=g,
                                           sources=[src(sheet, lab + [w] + unit_w, lab + [w] + unit_w, w.text, None, pw, ph)],
                                           context=label, row_cy=cy, x=w.cx))
        consumed.update(r.idx for r in data_rows)
        title_rows = [r for r in rows[max(0, hi - 12):hi] if hrow.cy - r.cy < 170]
        ttxt = _fold(" ".join(r.text() for r in title_rows))
        if re.search(r"(bir element|1 element|1 ədəd|bir ədəd|one element|один элемент|1 шт)", ttxt):
            new = [f for f in res.found if f.row_cy > hrow.cy and f.sheet == sheet and not f.note]
            for f in new:
                f.note = "The schedule is for one element. Multiply by the number of elements if there are several."
            if new:
                res.checks.append({
                    "kind": "review", "severity": "warn",
                    "title": f"Steel schedule on {sheet} is for one element",
                    "detail": "The table is headed 'for one element'. The bill carries one element; if the drawings show several, set the quantity to the full count on the Bill page.",
                    "sources": new[0].sources[:1], "_items_of": new,
                })
    return consumed


def _arith_check(sheet: str, what: str, printed: float, expected: float, unit: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "kind": "arithmetic",
        "severity": "error",
        "title": f"{what} does not add up ({sheet})",
        "detail": f"The schedule prints {printed:g} {unit}, but its parts add up to {expected:g} {unit}. "
                  f"The printed figure is used in the bill; confirm it with the designer.",
        "expected": expected,
        "printed": printed,
        "unit": unit,
        "sources": sources,
        "_label": what,
    }


# ----------------------------------------------------- 2. specification tables (unit column)

DITTO = {'"', '”', '“', '„', "''", '-//-', '--//--', '//', '-"-', '—"—', '″'}


def _dim_prefix_value(text: str) -> bool:
    """'L=1500' or 'Lüm=1210.00' waiting for its unit in the next word (a bar length, not a quantity)."""
    return bool(PREFIX_DIM_RE.match(text)) and bool(re.search(r"\d$", text))


def _row_candidate(rows: List[Row], i: int, j: int, w: Word, unit: Optional[str], ditto: bool):
    r = rows[i]
    ws = r.words
    if any(_dim_prefix_value(ws[k].text) for k in range(max(0, j - 2), j)):
        return None
    before = None
    if j > 0 and is_num(ws[j - 1]) and w.x0 - ws[j - 1].x1 < 45 and unit in ("ədəd", "dəst", "m", "kg", "t", None):
        pre = ws[j - 2].text.lower() if j > 1 else ""
        if pre not in ("x", "х", "*", "×", "=") and not pre.endswith("="):
            before = ws[j - 1]
    after = None
    for k in range(j + 1, len(ws)):
        if ws[k].x0 - w.x1 > 450:
            break
        tk = ws[k]
        if (unit and TABLE_UNITS.get(tk.low) == unit) or tk.text in DITTO:
            continue  # repeated unit cell or ditto
        if TABLE_UNITS.get(tk.low):
            break  # another unit column starts
        if tk.text.endswith("=") or tk.text in ("=", ":"):
            break  # "V = 100": a parameter
        if is_num(tk):
            after = tk
            break
        if tk.text in {"-", "--", "—"}:
            break
    if after is None and i + 1 < len(rows):
        nxt = rows[i + 1]
        lone = [x for x in nxt.words if x.x0 > w.x1]
        if 0 < nxt.cy - r.cy < 14 and len(lone) == 1 and is_num(lone[0]) and len(nxt.words) <= 2:
            after = lone[0]
    if before is None and after is None:
        return None
    return (i, j, w, unit, ditto, before, after)


def find_unit_rows(rows: List[Row], consumed: set, sheet: str, pw: float, ph: float, discipline: str) -> Tuple[List[Found], set]:
    """Specification rows with a unit column. The quantity is the number next to the unit, on the side
    the table uses (decided per table from the majority of its rows)."""
    def skip_row(r: Row) -> bool:
        if r.meta or r.idx in consumed:
            return True
        t = _fold(r.text())
        return any(k in t for k in SCHEDULE_WORDS) or "material" in t or _is_prose(t)

    cands = []
    for i, r in enumerate(rows):
        if skip_row(r):
            continue
        resume_x = -1e9  # a row may carry two tables side by side
        for j, w in enumerate(r.words):
            if w.x0 < resume_x:
                continue
            unit = TABLE_UNITS.get(w.low)
            if not unit:
                continue
            c = _row_candidate(rows, i, j, w, unit, False)
            if c:
                cands.append(c)
                resume_x = max(x.x1 for x in (c[5], c[6]) if x is not None) + 1
    # ditto marks stand for the unit of the row above; use the one sitting in a unit column
    unit_xs = [c[2].cx for c in cands]
    have = {c[0] for c in cands}
    for i, r in enumerate(rows):
        if i in have or skip_row(r):
            continue
        dit = [(j, w) for j, w in enumerate(r.words) if w.text in DITTO]
        best = None
        for j, w in dit:
            d = min((abs(w.cx - x) for x in unit_xs), default=1e9)
            if d <= 22 and (best is None or d < best[0]):
                best = (d, j, w)
        if best:
            c = _row_candidate(rows, i, best[1], best[2], None, True)
            if c:
                cands.append(c)

    # group by unit column position and decide which side holds the quantity
    cols: List[List[tuple]] = []
    for c in sorted(cands, key=lambda c: c[2].cx):
        if cols and abs(c[2].cx - statistics.fmean(x[2].cx for x in cols[-1])) <= 22:
            cols[-1].append(c)
        else:
            cols.append([c])

    out: List[Found] = []
    used: set = set()
    for col in cols:
        if len({c[0] for c in col}) < 3:
            continue  # fewer than three aligned rows is not a table column
        n_before = sum(1 for c in col if c[5] is not None and not c[4])
        n_after = sum(1 for c in col if c[6] is not None and not c[4])
        if n_before == n_after and n_before:
            gap_b = statistics.fmean(c[2].x0 - c[5].x1 for c in col if c[5] is not None)
            gap_a = statistics.fmean(c[6].x0 - c[2].x1 for c in col if c[6] is not None)
            side = "before" if gap_b < gap_a else "after"
        else:
            side = "before" if n_before > n_after else "after"
        last_unit = None
        for i, j, w, unit, ditto, before, after in sorted(col, key=lambda c: rows[c[0]].cy):
            r = rows[i]
            ws = r.words
            if ditto:
                unit = last_unit
                if unit is None:
                    continue
            else:
                last_unit = unit
            qty_w = before if side == "before" else after
            if qty_w is None:
                continue
            qty = num(qty_w)
            if qty <= 0:
                continue
            if unit in ("ədəd", "dəst") and not float(qty).is_integer():
                continue  # counts are whole numbers; this column is something else
            stop = qty_w.x0 if side == "before" else w.x0
            left = max((max(x.x1 for x in (cc[5], cc[6]) if x is not None) for cc in cands
                        if cc[0] == i and cc[2].cx < w.cx), default=-1e9)
            desc_words = [x for x in ws if left < x.x0 and x.x1 <= stop + 1 and TABLE_UNITS.get(x.low) is None and x.text not in DITTO]
            if desc_words and re.fullmatch(r"\d{1,3}\.?", desc_words[0].text):
                desc_words = desc_words[1:]
            # continuation lines under the description column
            for nr in rows[i + 1:i + 4]:
                if nr.meta or nr.cy - r.cy > 45:
                    break
                if any(TABLE_UNITS.get(x.low) or x.text in DITTO for x in nr.words) or (nr.words and re.fullmatch(r"\d{1,3}\.?", nr.words[0].text)):
                    break
                extra = [x for x in nr.words if x.x1 < stop - 2]
                if extra and len(extra) == len(nr.words) and not any(is_num(x) for x in extra[-1:]):
                    desc_words += extra
                else:
                    break
            desc = clean_label(desc_words)
            if len(re.sub(r"[^A-Za-zƏəÖöÜüĞğIıİiŞşÇçА-Яа-я]", "", desc)) < 3:
                # a size row under a group heading ("Ø6.35 m 10"): borrow the heading above
                for pr in reversed(rows[max(0, i - 3):i]):
                    if r.cy - pr.cy > 40 or pr.meta:
                        break
                    if any(TABLE_UNITS.get(x.low) or x.text in DITTO for x in pr.words):
                        continue
                    head = [x for x in pr.words if x.x1 < stop - 2 and not is_num(x)]
                    if head:
                        desc = clean_label(head) + (" " + desc if desc else "")
                        break
            if len(re.sub(r"[^A-Za-zƏəÖöÜüĞğIıİiŞşÇçА-Яа-я0-9]", "", desc)) < 3:
                continue
            box_words = [x for x in ws if left < x.x0 and x.x0 <= max(w.x1, qty_w.x1) + 1]
            if qty_w not in box_words:
                box_words.append(qty_w)
            out.append(Found(kind="table", unit=unit, qty=qty, label=desc, sheet=sheet,
                             sources=[src(sheet, box_words, box_words, qty_w.text, None, pw, ph)],
                             context=discipline, row_cy=r.cy, x=qty_w.cx))
            used.add(r.idx)
    if len(out) < 2:
        return [], set()
    return out, used


# ------------------------------------------------------- 4. metal specification tables

def find_metal_spec(rows: List[Row], consumed: set, sheet: str, pw: float, ph: float, title: str) -> Tuple[List[Found], set]:
    """Metal element specifications (KÜTLƏSİ, kq: BİR / ÜMUMİ / YEKUN). The YEKUN column holds each element's total mass."""
    out: List[Found] = []
    used: set = set()
    for hi, r in enumerate(rows):
        if r.idx in consumed:
            continue
        yek = [w for w in r.words if w.low.strip(".:,") in ("yekun", "итого")]
        if not yek:
            continue
        near = [x for x in rows[max(0, hi - 5):hi + 3] if abs(x.cy - r.cy) < 45]
        if not any(w.low.startswith(("kütlə", "kutle", "масса")) for x in near for w in x.words):
            continue
        ycol = yek[0]
        umumi = next((w for x in near for w in x.words if w.low.strip(".:,") in ("ümumi", "umumi", "общая")), None)
        mark = next((w for x in near for w in x.words if w.low.startswith(("markası", "marka", "марка")) and w.cx < ycol.cx - 150), None)
        header_bottom = max(x.cy for x in near)
        used.update(x.idx for x in near)
        for dr in rows:
            if dr.cy <= header_bottom:
                continue
            if dr.meta:
                break
            vals = [w for w in dr.words if is_num(w) and abs(w.cx - ycol.cx) <= 24 and ("." in w.text or "," in w.text)]
            if not vals:
                continue
            v = vals[0]
            if umumi is not None:
                # a YEKUN value shares its row with an ÜMUMİ value, or closes a group of rows that have one
                ok = any(is_num(w) and abs(w.cx - umumi.cx) <= 24 for x in rows if 0 <= v.cy - x.cy < 30 for w in x.words)
                if not ok:
                    continue
            lab: List[Word] = []
            if mark is not None:
                for x in rows:
                    if 0 <= v.cy - x.cy < 30:
                        lab += [w for w in x.words if mark.x0 - 25 <= w.cx <= mark.x1 + 45 and not is_num(w)]
            label = clean_label(lab) or title
            out.append(Found(kind="steel", unit="kg", qty=num(v), label=label, sheet=sheet,
                             sources=[src(sheet, lab + [v], lab + [v], v.text, None, pw, ph)], row_cy=dr.cy, x=v.cx))
            used.add(dr.idx)
        break
    return out, used


# --------------------------------------------- 5. schedules whose unit sits in the column header

QTY_HEADERS = {"area": "m²", "volume": "m³", "weight": "kg", "mass": "kg", "length": "m", "qty": None, "qty.": None,
               "quantity": None, "nos": "ədəd", "площадь": "m²", "объем": "m³", "объём": "m³", "масса": "kg", "длина": "m",
               "кол-во": None, "количество": None, "sahə": "m²", "sahəsi": "m²", "sahe": "m²", "həcm": "m³", "həcmi": "m³", "kütlə": "kg", "kütləsi": "kg",
               "çəki": "kg", "çəkisi": "kg", "sayı": "ədəd", "say": "ədəd", "miqdarı": None, "miqdar": None,
               "uzunluq": "m", "uzunluğu": "m"}
TEXT_HEADERS = ("description", "item", "name", "type", "mark", "location", "room", "element", "наименование", "марка", "тип",
                "adı", "döşəmə", "tavan", "divar", "markası", "tipi", "təsviri", "təsnifat", "otağın", "işin", "material",
                "qapı", "pəncərə", "element", "konstruksiya", "mövqe")


def find_header_columns(rows: List[Row], sheet: str, pw: float, ph: float, title: str) -> List[Found]:
    """Schedules that print the unit once, in the header ("Sahə, m²"), and only numbers in the rows."""
    out: List[Found] = []
    for hi, hr in enumerate(rows):
        if hr.meta:
            continue
        band = [r for r in rows[max(0, hi - 2):hi + 4] if abs(r.cy - hr.cy) <= 30 and not r.meta]
        hwords = [w for r in band for w in r.words]
        qcols = []
        for w in hwords:
            key = w.low.strip(",.:;()")
            if key in QTY_HEADERS:
                unit = QTY_HEADERS[key]
                # an explicit unit printed just under or beside the heading wins
                for u in hwords:
                    uu = STATEMENT_UNITS.get(u.low.strip(",;")) or TABLE_UNITS.get(u.low.strip(",;"))
                    if uu and abs(u.cx - w.cx) < 30 and u is not w and uu in ("m²", "m³", "kg", "m", "ədəd"):
                        unit = uu
                if unit:
                    qcols.append((w, unit))
        tcols = [w for w in hwords if any(w.low.startswith(k) for k in TEXT_HEADERS)]
        if not qcols or not tcols or len(hwords) < 4:
            continue
        header_bottom = max(r.cy for r in band)
        qcols.sort(key=lambda c: c[0].cx)
        data = []
        last = header_bottom
        for r in rows:
            if r.cy <= header_bottom:
                continue
            if r.meta or r.cy - last > 70:
                break
            data.append(r)
            last = r.cy
        for qw, unit in qcols:
            lefts = [t for t in tcols if t.cx < qw.cx - 10]
            if not lefts:
                continue
            tcol = max(lefts, key=lambda t: t.cx)
            x_lo = tcol.x0 - 20
            for r in data:
                vals = [w for w in r.words if is_num(w) and abs(w.cx - qw.cx) <= 24 and w.x0 > x_lo]
                if not vals:
                    continue
                v = vals[0]
                qty = num(v)
                if qty <= 0 or (unit == "ədəd" and not qty.is_integer()):
                    continue
                lab = [w for w in r.words if x_lo <= w.x0 and w.x1 <= v.x0 + 1 and not is_num(w)]
                if not lab:
                    lab = [w for x in data if abs(x.cy - r.cy) <= 13 for w in x.words if x_lo <= w.x0 and w.x1 <= v.x0 + 1 and not is_num(w)]
                    lab.sort(key=lambda w: (round(w.cy / 4), w.x0))
                label = clean_label(lab)
                letters = re.sub(r"[^A-Za-zƏəÖöÜüĞğIıİiŞşÇçА-Яа-я]", "", label)
                if len(letters) < 4:
                    continue  # a bare "Döşəmə 1" is a calculation row, not a described item
                box = lab + [v]
                out.append(Found(kind="statement", unit=unit, qty=qty, label=label, sheet=sheet,
                                 sources=[src(sheet, box, box, v.text, None, pw, ph)], row_cy=r.cy, x=v.cx,
                                 context=_fold(label + " " + title)))
        if out:
            break
    # the same short label repeated many times is a per-room calculation table, not a schedule of work
    counts: Dict[str, int] = {}
    for f in out:
        counts[_fold(f.label)] = counts.get(_fold(f.label), 0) + 1
    return [f for f in out if counts[_fold(f.label)] < 4]

# ----------------------------------------------------------- 3. material statements

def find_statements(rows: List[Row], skip: set, sheet: str, pw: float, ph: float, title: str) -> List[Found]:
    out: List[Found] = []
    for i, r in enumerate(rows):
        if r.meta or r.idx in skip:
            continue
        ws = r.words
        for j, w in enumerate(ws):
            unit = None
            val_w = None
            unit_w = None
            g = GLUED_RE.match(w.text)
            if g:
                unit = STATEMENT_UNITS.get(g.group(2).lower())
                val_w, unit_w = w, None
            elif (is_num(w) or (re.fullmatch(r"[-–]\d{1,7}(?:[.,]\d{1,3})?", w.text) and j > 0 and re.search(r"[A-Za-zƏəÖöÜüĞğIıİŞşÇç]$", ws[j - 1].text))) and j + 1 < len(ws):
                nxt = ws[j + 1]
                if nxt.x0 - w.x1 > 30:
                    continue
                unit = STATEMENT_UNITS.get(nxt.low)
                if unit == "m" and "." not in w.text and "," not in w.text:
                    unit = None  # a bare "m" after an integer is usually a dimension
                if unit == "m" and nxt.low == "m" and j + 2 < len(ws) and ws[j + 2].low in ("kq", "kg"):
                    unit = None
                val_w, unit_w = w, nxt
            if not unit or val_w is None:
                continue
            prev = ws[j - 1].text if j > 0 else ""
            if PREFIX_DIM_RE.match(prev) or PREFIX_DIM_RE.match(val_w.text) or prev.lower() in ("x", "х", "*", "×"):
                continue
            if prev.endswith("=") or (j > 1 and ws[j - 2].text.endswith("=")) or prev in ("≈", "~"):
                left_txt = _fold(" ".join(x.text for x in ws[:j]))
                if not has_word(left_txt, MATERIAL_WORDS):
                    continue  # a design parameter (V = 100 m³, H = 8.0 m), not a quantity
            if unit_w is not None and j + 2 < len(ws) and ws[j + 2].text.startswith("/"):
                continue  # a rate such as "m³/saat"
            qty = float(GLUED_RE.match(val_w.text).group(1).replace(",", ".")) if GLUED_RE.match(val_w.text) else float(val_w.text.lstrip("-–").replace(",", "."))
            if qty <= 0:
                continue
            row_low = _fold(r.text())
            if re.search(r"(vərəq|лист|sheet|dwg)\.?\s*\d", row_low):
                continue  # a drawing-list entry pointing at another sheet, not a quantity
            if unit in ("kg", "t") and any(k in row_low for k in LOAD_WORDS):
                continue  # a design load (snow, wind, kg/m²), not a quantity
            left = [x for x in ws[:j] if val_w.x0 - x.x1 < 360]
            # stop the label at the previous quantity in the row
            for k in range(len(left) - 1, -1, -1):
                if is_num(left[k]) and k + 1 < len(left) and STATEMENT_UNITS.get(left[k + 1].low):
                    left = left[k + 2:]
                    break
            label_words = [x for x in left if (not is_num(x) or GRADE_RE.search(x.text)) and x.text not in ("=", ":")]
            label = clean_label(label_words)
            grade_m = GRADE_RE.search(r.text(left))
            words_box = left + [val_w] + ([unit_w] if unit_w else [])
            out.append(Found(kind="statement", unit=unit, qty=qty, label=label, sheet=sheet,
                             grade=grade_m.group(1) if grade_m else None,
                             sources=[src(sheet, words_box, words_box, val_w.text if not GLUED_RE.match(val_w.text) else GLUED_RE.match(val_w.text).group(1), None, pw, ph)],
                             row_cy=r.cy, x=val_w.cx, context=title))
    return out


def heading_above(rows: List[Row], cy: float, x: float, keys: Sequence[str], max_dy: float) -> Optional[Row]:
    best = None
    for r in rows:
        if r.meta or r.cy >= cy - 1 or cy - r.cy > max_dy:
            continue
        if not (r.x0 - 200 <= x <= r.x1 + 260):
            continue
        t = _fold(r.text())
        if any(k in t for k in keys):
            if best is None or r.cy > best.cy:
                best = r
    return best


# --------------------------------------------------------------------------- per page

def sheet_title(rows: List[Row]) -> str:
    best = None
    for r in rows:
        if r.meta:
            continue
        alpha = [w for w in r.words if re.search(r"[A-Za-zƏəÖöÜüĞğIıİŞşÇçА-Яа-я]{3,}", w.text)]
        if len(alpha) < 2:
            continue
        h = statistics.median(w.h for w in r.words)
        score = h + 0.05 * min(len(alpha), 8)
        if best is None or score > best[0]:
            best = (score, r)
    if not best:
        return ""
    t = re.sub(r"\s+", " ", best[1].text()).strip()
    return t[:87] + "..." if len(t) > 90 else t


def analyse_page(page: pymupdf.Page, sheet: str) -> Tuple[PageResult, Dict[str, Any]]:
    pw, ph = page.rect.width, page.rect.height
    res = PageResult()
    words = page_words(page)
    ocr = False
    if len(words) < 8 and ocr_available():
        words = ocr_words(page)
        ocr = bool(words)
    words = merge_diameter_signs(merge_superscripts(words))
    words, tb_words = split_title_block(words, pw, ph)
    tb_text = " ".join(w.text for w in sorted(tb_words, key=lambda w: (round(w.cy / 4), w.x0)))
    rows = build_rows(words)
    full_text = " ".join(w.text for w in words)
    title = sheet_title(rows) or f"Sheet {sheet}"
    tb_name = element_phrase(tb_text)[0] if tb_text else ""
    if tb_name and (not re.search(r"[A-Za-zƏə]{4}", title) or title.startswith(("Яслин", "Sheet "))):
        title = tb_name
    disc = discipline_of(full_text)
    meta = {"title": title, "discipline": disc, "ocr": ocr}
    if len(words) < 8:
        res.text_layer = False
        return res, meta
    if is_calc_page(full_text):
        meta["calc"] = True
        return res, meta
    res.ocr = ocr

    consumed = find_consumption_tables(rows, sheet, pw, ph, res)
    steel_found, steel_rows = find_metal_spec(rows, consumed, sheet, pw, ph, title)
    res.found.extend(steel_found)
    consumed |= steel_rows
    if steel_found:
        res.checks.append({
            "kind": "review", "severity": "info",
            "title": f"Steel specification on {sheet} read as printed",
            "detail": "The element totals (YEKUN) are taken as printed. If the table describes one element of several "
                      "(for example one truss of a series), set the quantity to the full count on the Bill page.",
            "sources": steel_found[0].sources[:1], "_items_of": steel_found,
        })
    table_found, unit_rows = find_unit_rows(rows, consumed, sheet, pw, ph, disc)
    res.found.extend(table_found)
    statements = find_statements(rows, consumed | unit_rows, sheet, pw, ph, title)

    has_table_concrete = any(f.kind == "concrete" for f in res.found)
    volume_stmts = [s for s in statements if s.unit == "m³"]
    other_stmts = [s for s in statements if s.unit != "m³"]

    multiplier = None
    mult_words: List[Word] = []
    mm = re.search(r"\(?\s*(\d{1,3})\s*(?:ədəd|ƏDƏD|əd\.)\s*(?:üçün|ÜÇÜN|üç\.)", full_text)
    if mm and int(mm.group(1)) > 1:
        multiplier = int(mm.group(1))
        mult_words = [w for w in words if w.text.strip("(") == mm.group(1)]

    totals: List[Found] = []
    for s in volume_stmts:
        head = heading_above(rows, s.row_cy, s.x, ELEMENT_WORDS, 160)
        ctx = _fold((head.text() if head else "") + " " + s.label + " " + title)
        is_total = any(k in _fold(s.label) for k in ("ümumi", "cəmi", "yekun", "total"))
        if has_word(ctx, ("beton", "d/b", "d\\b", "d.b", "concrete", "бетон")) or GRADE_RE.search(s.label):
            if has_table_concrete:
                continue  # the consumption table already gives the concrete per element
            s.kind = "concrete"
        elif has_word(ctx, ("taxta", "şalban", "mauerlat", "ağac", "timber", "dirək", "брус", "древес")):
            s.kind = "timber"
        else:
            lab = _fold(s.label)
            if _is_prose(lab) or not has_word(lab, MATERIAL_WORDS):
                continue  # a tank capacity, flow or note, not a measured quantity
            s.kind = "statement"
        s.context = ctx
        name, mark = ("", None) if is_total else find_element_name(rows, s.row_cy, s.x)
        if not is_total and tb_text and not name:
            name, mark = element_phrase(tb_text)  # the sheet's own name, when no heading names the element
        if name and not mark:
            # a mark printed near the statement ("Mbt-1 1 12.96 m²") completes the name
            near = [x for x in rows if 0 < s.row_cy - x.cy < 160 and abs(x.x0 - s.x) < 400]
            for x in sorted(near, key=lambda x: s.row_cy - x.cy):
                mk = label_mark(x.text())
                if mk and not re.match(r"^(ad|ø|l|h)", mk.lower()):
                    name = f"{name} {mk}"
                    break
        if name:
            s.label = name
            s.context = _fold(name) + " " + ctx
        elif is_total or len(s.label) < 4:
            s.label = f"{s.label} — {title}" if s.label else title
        unit_head = heading_above(rows, s.row_cy, s.x, ("üçün", "üçun", "для"), 450)
        if s.kind == "concrete" and unit_head and re.search(r"\(\s*1\s*(ədəd|əd)", unit_head.text(), re.IGNORECASE):
            if multiplier:
                s.method = "derived"
                s.formula = f"{multiplier} no. × {s.qty:g} m³"
                s.note = f"The schedule gives the volume for one element; the sheet states {multiplier} elements."
                s.qty = round(s.qty * multiplier, 3)
                if mult_words:
                    s.sources.append(src(sheet, mult_words[:1], mult_words[:1], str(multiplier), "count", pw, ph))
            else:
                s.note = "The schedule gives the volume for one element and the sheet does not state how many. Confirm the count."
                res.checks.append({
                    "kind": "review", "severity": "warn",
                    "title": f"Count needed for {s.label[:60]} ({sheet})",
                    "detail": f"{s.qty:g} m³ is stated for one element. The number of elements is not on this sheet, so the line carries one element until the count is confirmed.",
                    "sources": s.sources[:1], "_item_of": s,
                })
        if is_total:
            totals.append(s)
        res.found.append(s)

    # member lengths in a schedule whose volume total is printed under it are evidence for that total
    for t in totals:
        for f in [f for f in res.found if f.kind == "table" and f.unit == "m"]:
            if 0 < t.row_cy - f.row_cy < 420 and abs(t.x - f.x) < 320:
                t.attach.append({**f.sources[0], "role": "length"})
                res.found.remove(f)

    volumes = [f for f in res.found if f.kind in ("concrete", "timber")]
    for s in other_stmts:
        target = None
        # lengths listed in a schedule whose volume total is printed below it
        for t in totals:
            if s.unit == "m" and 0 < t.row_cy - s.row_cy < 420 and abs(t.x - s.x) < 320:
                target = t
        # an area or length printed above a concrete statement describes that element
        if target is None:
            for c in volumes:
                if 0 < c.row_cy - s.row_cy < 140 and abs(c.x - s.x) < 160:
                    if target is None or c.row_cy < target.row_cy:
                        target = c
        if target is None and s.unit in ("m²", "m"):
            mk = label_mark(s.label)
            if mk:
                same = [c for c in volumes if label_mark(c.label) == mk]
                if same:
                    target = same[0]
        if target is not None:
            role = "area" if s.unit == "m²" else ("length" if s.unit == "m" else "mass")
            target.attach.append({**s.sources[0], "role": role})
            continue
        if s.unit in ("kg", "t") and any(f.kind in ("rebar", "steel") for f in res.found):
            continue  # steel on this sheet comes from its schedule totals
        if s.unit in ("kg", "t") and any(TABLE_UNITS.get(_fold(x)) == "ədəd" for x in s.sources[0]["quote"].split()):
            continue  # "65 əd. 1.2 kq": mass of a counted part, per piece or in total is not stated
        lab = _fold(s.label)
        if _is_prose(lab) or not has_word(lab, MATERIAL_WORDS):
            continue  # a note, a room area or a title-block figure, not a measured quantity
        head = heading_above(rows, s.row_cy, s.x, ELEMENT_WORDS, 120)
        if len(s.label) < 4 and head:
            s.label = head.text()
        if len(s.label) < 4:
            s.label = f"{title}"
        s.kind = "statement"
        res.found.append(s)

    if not res.found:
        skipped_conc = []
        for f in find_header_columns(rows, sheet, pw, ph, title):
            lab = _fold(f.label)
            if not has_word(lab, MATERIAL_WORDS + FINISH_WORDS):
                continue  # room areas and similar figures are not work quantities
            if f.unit == "m³" and any(k in lab for k in ("beton", "d/b", "d/ beton")):
                skipped_conc.append(f)
                continue  # structural concrete is taken from the structural drawings, not the finish schedule
            res.found.append(f)
        if skipped_conc:
            res.checks.append({
                "kind": "review", "severity": "info",
                "title": f"Concrete layers in the schedule on {sheet} not billed",
                "detail": "This schedule lists concrete layers (" + ", ".join(f"{f.qty:g} m³" for f in skipped_conc[:6]) +
                          "). Concrete is billed from the structural drawings, so these figures are kept as a cross-check only.",
                "sources": [f.sources[0] for f in skipped_conc[:4]],
            })
    if not res.found:
        for r in rows:
            t = _fold(r.text())
            if not r.meta and any(k in t for k in SCHEDULE_WORDS):
                res.schedule_heading = (r.text()[:100], union_box(r.words, page_w=pw, page_h=ph))
                break
    if ocr:
        for f in res.found:
            f.method = "image"
            for sref in f.sources:
                sref["how"] = "image"
            f.note = ((f.note + " ") if f.note else "") + "Read by OCR from an image-only sheet; check the figure against the drawing."
    return res, meta


# --------------------------------------------------------------------------- OCR (optional)

_OCR_STATE: Dict[str, Any] = {}


def ocr_available() -> bool:
    """True when Tesseract is installed. OCR is used only for sheets that have no text layer."""
    if "ok" not in _OCR_STATE:
        import shutil
        import subprocess
        exe = shutil.which("tesseract")
        langs = []
        if exe and os.getenv("OCR_DISABLED", "0") != "1":
            try:
                out = subprocess.run([exe, "--list-langs"], capture_output=True, text=True, timeout=20).stdout
                langs = [ln.strip() for ln in out.splitlines()[1:] if ln.strip()]
            except Exception:
                langs = []
        wanted = [l for l in ("aze", "rus", "eng") if l in langs]
        _OCR_STATE["ok"] = bool(wanted)
        _OCR_STATE["lang"] = "+".join(wanted)
    return _OCR_STATE["ok"]


def ocr_words(page: pymupdf.Page) -> List[Word]:
    try:
        tp = page.get_textpage_ocr(language=_OCR_STATE.get("lang", "eng"), dpi=300, full=True)
        raw = page.get_text("words", textpage=tp)
    except Exception:
        return []
    m = page.rotation_matrix
    out = []
    for w in raw:
        r = pymupdf.Rect(w[:4]) * m
        t = (w[4] or "").strip()
        if t and _fold(t) not in MARGIN_WORDS:
            out.append(Word(r.x0, r.y0, r.x1, r.y1, t))
    return out


# --------------------------------------------------------------------------- rasterising

def rasterize_page(page: pymupdf.Page, full_path: Path, thumb_path: Path) -> None:
    rect = page.rect
    zoom = min(2.0, MAX_RASTER_PX / max(rect.width, rect.height, 1))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.save(full_path, "WEBP", quality=82, method=4)
    t_img = img.copy()
    t_img.thumbnail((360, 360))
    t_img.save(thumb_path, "WEBP", quality=78)


# --------------------------------------------------------------------------- dataset assembly

def _slug(s: str, n: int = 40) -> str:
    t = _fold(s)
    t = re.sub(r"[^a-z0-9əöüğışç]+", "_", t).strip("_")
    return t[:n] or "item"


def build_items(all_found: List[Found], rates: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Found]]:
    items: List[Dict[str, Any]] = []
    by_id: Dict[str, Found] = {}
    seen: Dict[Tuple[str, str, float], Dict[str, Any]] = {}
    n = 0
    vol_by_mark: Dict[str, Found] = {}
    for f in all_found:
        if f.kind in ("concrete", "timber"):
            mk = label_mark(f.label)
            if mk:
                vol_by_mark.setdefault(mk.lower(), f)
    kept = []
    for f in all_found:
        if f.kind == "statement" and f.unit in ("m²", "m"):
            mk = label_mark(f.label)
            target = vol_by_mark.get(mk.lower()) if mk else None
            if target is not None:
                target.attach.append({**f.sources[0], "role": "area" if f.unit == "m²" else "length"})
                continue
        kept.append(f)
    all_found = kept
    for f in all_found:
        label = f.label.strip()
        dedupe_key = (_fold(label), f.unit, round(f.qty, 3), f.bar or "")
        if dedupe_key in seen and (seen[dedupe_key]["src"][0]["sheet"] != f.sheet or f.kind == "statement"):
            # same printed line repeated on another sheet: one item, both citations
            seen[dedupe_key]["src"].append({**f.sources[0], "role": "repeat"})
            continue
        n += 1
        if f.kind == "rebar":
            key = rebar_rate_key(f.bar or "")
            section = "rebar"
            az = f"Armatur {f.bar} — {label}"
            en = f"Reinforcement {f.bar}, {label}"
            if not key:
                key = f"rebar_{_slug(f.bar or 'other', 12)}"
                rates.setdefault(key, {"unit": "kg", "rate": 0.0, "en": f"Rebar {f.bar}, cut, bent and fixed", "group": "Reinforcement", "auto": True})
        elif f.kind == "concrete":
            key, section = concrete_rate_key(f.context + " " + label, f.grade)
            grade = f" B{f.grade}" if f.grade else ""
            az = f"Beton{grade} — {label}"
            en = f"Concrete{grade}, {label}"
            if key and f.grade:
                lib_grade = re.search(r"\bB(\d+(?:\.\d+)?)\b", rates.get(key, {}).get("en", ""))
                if lib_grade and abs(float(lib_grade.group(1)) - float(f.grade.replace(",", "."))) > 1e-6:
                    # the library rate is for another grade: keep the element type, price this grade separately
                    base = rates.get(key, {})
                    new_key = f"{key}_b{f.grade.replace('.', '_').replace(',', '_')}"
                    rates.setdefault(new_key, {"unit": "m³", "rate": 0.0, "group": base.get("group", "Concrete"), "auto": True,
                                               "en": re.sub(r"\bB\d+(?:\.\d+)?\b", f"B{f.grade}", base.get("en", f"Concrete B{f.grade}"))})
                    key = new_key
            if not key:
                key = f"conc_b{(f.grade or 'x').replace('.', '_').replace(',', '_')}"
                rates.setdefault(key, {"unit": "m³", "rate": 0.0, "en": f"Concrete{grade}, placed, all-in", "group": "Concrete", "auto": True})
        elif f.kind == "steel":
            key, section = "steel_struct", "steel"
            az = f"Metal konstruksiya — {label}"
            en = f"Structural steel, {label}"
        elif f.kind == "timber":
            key, section = "timber_roof", "roof"
            az = f"Taxta konstruksiya — {label}"
            en = f"Timber members, {label}"
            rates.setdefault(key, {"unit": "m³", "rate": 0.0, "en": "Timber roof members, treated and fixed", "group": "Roofing", "auto": True})
        else:
            section = section_for(label + " " + f.context, f.unit, f.context if f.kind == "table" else "", label)
            az = en = label
            key = f"auto_{_slug(f.unit, 4)}_{_slug(label)}"
            rates.setdefault(key, {"unit": f.unit, "rate": 0.0, "en": label, "az": label,
                                   "group": SECTION_NAME.get(section, "Other works"), "auto": True})
        item_id = f"it-{n:04d}"
        item = {
            "id": item_id,
            "building": "B1",
            "section": section,
            "az": az,
            "en": en,
            "unit": f.unit,
            "qty": round(f.qty, 3),
            "rate": key,
            "src": f.sources + f.attach,
            "method": f.method,
            "formula": f.formula,
            "note": f.note,
            "line": None,
        }
        items.append(item)
        seen[dedupe_key] = item
        by_id[item_id] = f
    return items, by_id


def process_uploaded_drawing_package(
    pdf_bytes: bytes,
    filename: str,
    project_title: str,
    client: str = "Client",
    designer: str = "Engineering Office",
    place: str = "Project Location",
    custom_rates: Optional[Dict[str, Any]] = None,
    asset_dir: Optional[str] = None,
    progress=None,
) -> Dict[str, Any]:
    """Read a drawing package and return the project dataset.

    `asset_dir` is a folder name under SHEETS_DIR, unique per project, where the sheet
    images are written. Sheets reference their image as "<asset_dir>/<sheet id>".
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        code = re.sub(r"[^A-Za-z0-9]", "", Path(filename).stem)[:8].upper() or "DOC"
        out_dir = SHEETS_DIR / asset_dir if asset_dir else SHEETS_DIR
        out_dir.mkdir(parents=True, exist_ok=True)

        sheets: List[Dict[str, Any]] = []
        all_found: List[Found] = []
        page_checks: List[Dict[str, Any]] = []
        raster_only: List[Tuple[str, float, float]] = []
        unread_schedules: List[Tuple[str, str, List[float]]] = []
        verified = 0
        total = len(doc)
        for i, page in enumerate(doc):
            sheet_id = f"{code}-{i + 1}"
            rasterize_page(page, out_dir / f"{sheet_id}.webp", out_dir / f"{sheet_id}.t.webp")
            res, meta = analyse_page(page, sheet_id)
            sheets.append({
                "id": sheet_id,
                "doc": code,
                "page": i + 1,
                "w": round(page.rect.width, 1),
                "h": round(page.rect.height, 1),
                "title": meta["title"],
                "titleEn": meta["title"],
                "building": "B1",
                "discipline": meta["discipline"],
                "no": str(i + 1),
                **({"img": f"{asset_dir}/{sheet_id}"} if asset_dir else {}),
            })
            all_found.extend(res.found)
            page_checks.extend(res.checks)
            verified += res.verified_totals
            if not res.text_layer:
                raster_only.append((sheet_id, page.rect.width, page.rect.height))
            elif res.schedule_heading:
                unread_schedules.append((sheet_id, res.schedule_heading[0], res.schedule_heading[1]))
            if progress:
                progress(i + 1, total)

        rates = get_default_rates()
        items, found_by_id = build_items(all_found, rates)
        item_of_found = {id(f): iid for iid, f in found_by_id.items()}

        checks: List[Dict[str, Any]] = []
        for c in page_checks:
            f = c.pop("_item_of", None)
            fs = c.pop("_items_of", None) or ([f] if f is not None else [])
            c.pop("_label", None)
            c["items"] = [item_of_found[id(x)] for x in fs if id(x) in item_of_found]
            checks.append(c)
        if verified:
            first = next((i for i in items if i["section"] == "rebar"), items[0] if items else None)
            checks.append({
                "kind": "agree", "severity": "ok",
                "title": f"{verified} schedule totals add up",
                "detail": "Bar diameters add up to each class total and class totals add up to the grand total on every schedule row checked.",
                "sources": first["src"][:1] if first else [], "items": [first["id"]] if first else [],
            })
        if raster_only:
            checks.append({
                "kind": "missing", "severity": "warn",
                "title": f"{len(raster_only)} sheet(s) have no text layer",
                "detail": "These sheets are images only, so nothing on them was read. Measure them by hand: "
                          + ", ".join(s for s, _, _ in raster_only[:40]) + ("…" if len(raster_only) > 40 else ""),
                "sources": [{"sheet": s, "box": [0, 0, round(w, 1), round(h, 1)], "quote": "Image-only sheet", "value": None, "how": "image", "role": None}
                            for s, w, h in raster_only[:12]],
                "items": [],
            })
        for sid, heading, box in unread_schedules:
            checks.append({
                "kind": "missing", "severity": "warn",
                "title": f"Schedule on {sid} was not read",
                "detail": f"'{heading}' looks like a schedule, but no quantity with a unit could be read from it. Enter its lines by hand.",
                "sources": [{"sheet": sid, "box": box, "quote": heading, "value": None, "how": "text", "role": None}],
                "items": [],
            })
        unpriced = [i for i in items if float(rates.get(i["rate"], {}).get("rate", 0) or 0) == 0]
        if unpriced:
            checks.append({
                "kind": "missing", "severity": "info",
                "title": f"{len(unpriced)} line(s) have no rate yet",
                "detail": "These quantities were read from the drawings but match no rate in the library. Upload a rate schedule or enter the rates on the Rates page.",
                "sources": unpriced[0]["src"][:1], "items": [i["id"] for i in unpriced[:200]],
            })
        for n, c in enumerate(checks, 1):
            c["id"] = f"C-{n:02d}"
            c.setdefault("building", "B1")

        gaps = []
        if not any(i["section"] in ("sub",) and "qazıntı" in _fold(i["az"]) for i in items):
            gaps.append({"az": "Torpaq işləri", "en": "Earthworks",
                         "detail": "No excavation or backfill quantity is printed on the drawings. Measure it from the foundation plan."})
        if not items:
            gaps.append({"az": "Kəmiyyət tapılmadı", "en": "No quantities found",
                         "detail": "No schedule or quantity statement with a unit was found in this package. The drawings may be image-only, or the schedules may be in a separate file."})

        return {
            "project": {
                "name": project_title,
                "nameEn": project_title,
                "place": place,
                "placeEn": place,
                "client": client,
                "designer": designer,
                "chiefEngineer": "",
                "stage": "Working design",
                "issued": datetime.now().strftime("%d.%m.%Y"),
                "currency": "AZN",
                "site": {"areaHa": 0, "footprint": 0, "greenery": 0},
            },
            "documents": [{
                "code": code,
                "file": filename,
                "az": project_title,
                "en": project_title,
                "date": datetime.now().strftime("%d.%m.%Y"),
                "pages": len(sheets),
                "text": True if not raster_only else ("partial" if len(raster_only) < len(sheets) else False),
                "note": f"{len(sheets) - len(raster_only)} of {len(sheets)} sheets carry a text layer.",
                "title": project_title,
            }],
            "buildings": [{"id": "B1", "az": project_title, "en": project_title, "short": project_title[:24]}],
            "sections": SECTIONS,
            "sheets": sheets,
            "items": items,
            "lineGroups": {},
            "rates": rates,
            "checks": checks,
            "gaps": gaps,
        }
    finally:
        doc.close()


if __name__ == "__main__":
    print("Takeoff engine ready. PyMuPDF", pymupdf.__version__)
