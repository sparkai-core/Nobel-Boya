"""Build the Qobu demo dataset: sheet register, takeoff with evidence, BOQ rules, rates and checks.

Every quantity cites the sheet it is printed on. Text-layer sheets are located automatically and the
build fails if a cited number is not printed in the cited row. Flattened sheets (master plan and most
of the architecture set) carry a hand-set box and are marked as read from the image.
"""
import json
import re
import sys
from pathlib import Path

from locate import NotFound, locate, page_size, region_text

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "src" / "data" / "qobu.json"

# --------------------------------------------------------------------------- evidence helpers


class L:
    """A value located on a text-layer sheet."""

    def __init__(self, code, page, value, *labels, **kw):
        self.code, self.page, self.value, self.labels, self.kw = code, page, value, labels, kw
        self.role = kw.pop("role", None)

    def resolve(self):
        box, quote = locate(self.code, self.page, self.value, self.labels, **self.kw)
        return {"sheet": f"{self.code}-{self.page}", "box": box, "quote": quote, "value": self.value, "how": "text", "role": self.role}


class M:
    """A value read by eye from a flattened sheet, with a hand-set box."""

    def __init__(self, code, page, box, quote, value=None, role=None):
        self.code, self.page, self.box, self.quote, self.value, self.role = code, page, box, quote, value, role

    def resolve(self):
        return {"sheet": f"{self.code}-{self.page}", "box": [round(v, 1) for v in self.box], "quote": self.quote, "value": self.value, "how": "image", "role": self.role}


# --------------------------------------------------------------------------- reference data

BUILDINGS = [
    {"id": "WH", "az": "Anbar binası (metal materialları saxlama anbarı)", "en": "Warehouse (metal materials store)", "short": "Warehouse"},
    {"id": "AD", "az": "İnzibati bina", "en": "Administration building", "short": "Admin building"},
    {"id": "PS", "az": "Yeraltı nasosxana", "en": "Underground pump station", "short": "Pump station"},
    {"id": "TK", "az": "Təsərrüfat-içməli və yanğın su anbarları V = 100 m³ (2 ədəd)", "en": "Domestic and fire water tanks, 2 × 100 m³", "short": "Water tanks"},
    {"id": "SITE", "az": "Ərazinin abadlaşdırılması", "en": "External works and landscaping", "short": "External works"},
]

SECTIONS = [
    ("sub", "Torpaqaltı hissə və bünövrələr", "Substructure and foundations"),
    ("frame", "Monolit dəmir-beton karkas", "Reinforced concrete frame"),
    ("rebar", "Armatur işləri", "Reinforcement"),
    ("steel", "Metal konstruksiyalar", "Structural steelwork"),
    ("masonry", "Hörgü işləri", "Masonry"),
    ("roof", "Dam örtüyü və su axıdılması", "Roofing and rainwater"),
    ("openings", "Qapı və pəncərələr", "Doors and windows"),
    ("finish", "Bəzək işləri", "Finishes"),
    ("elec", "Elektrik təchizatı", "Electrical installation"),
    ("hvac", "İstilik, ventilyasiya və kondisionerləşdirmə", "Heating, ventilation and air conditioning"),
    ("plumb", "Su təchizatı və kanalizasiya", "Water supply and drainage"),
    ("fire", "Daxili yanğınsöndürmə", "Firefighting water"),
    ("alarm", "Yanğın siqnalizasiyası", "Fire alarm"),
    ("lowcur", "Rabitə və videomüşahidə", "Communications and CCTV"),
    ("pa", "Səsli xəbərvermə", "Public address"),
    ("ext", "Abadlaşdırma və yol örtükləri", "Landscaping and paving"),
]

DOCUMENTS = [
    {"code": "BP", "file": "Qobu Bas plan28.09.2026.pdf", "az": "Baş plan", "en": "Master plan", "date": "28.09.2026", "text": False,
     "note": "Plotted without a text layer. Values on these sheets were read from the image and are marked that way."},
    {"code": "AR", "file": "Qobu inzibati bina ve anbar 28.09.2026.pdf", "az": "Memarlıq hissəsi (anbar və inzibati bina)", "en": "Architecture (warehouse and admin building)", "date": "28.09.2026", "text": "partial",
     "note": "Only the general data and the admin finish schedule carry text. Plans, schedules and elevations are flattened."},
    {"code": "KS", "file": "Qobu konstruksiya.pdf", "az": "Konstruksiya hissəsi", "en": "Structure", "date": "2026", "text": True,
     "note": "Full text layer. Every schedule value is located on the sheet automatically."},
    {"code": "MEP", "file": "Qobu kommunikasiya ümumi.pdf", "az": "Kommunikasiya (mühəndis sistemləri)", "en": "Building services and utilities", "date": "2026", "text": True,
     "note": "Full text layer. Five pages use a legacy Cyrillic-mapped font for headings only; item rows read correctly."},
]

PROJECT = {
    "name": "Qobu anbar və inzibati bina",
    "nameEn": "Qobu warehouse and administration building",
    "place": "Abşeron rayonu, Qobu qəsəbəsi",
    "placeEn": "Qobu settlement, Absheron district, Azerbaijan",
    "client": "Cəfərov Mədət İslam oğlu",
    "designer": "\"Storm Building\" MMC",
    "chiefEngineer": "G. Musayeva",
    "stage": "İşçi layihə (working design)",
    "issued": "28.09.2026",
    "currency": "AZN",
    "site": {"areaHa": 0.9998, "footprint": 1398.2, "greenery": 2532.3},
}

# --------------------------------------------------------------------------- sheet register


def _sheet(code, page, title, title_en, building, discipline, no=None):
    w, h = page_size(code, page)
    return {"id": f"{code}-{page}", "doc": code, "page": page, "w": w, "h": h, "title": title, "titleEn": title_en,
            "building": building, "discipline": discipline, "no": no}


def sheets():
    out = []
    bp = [
        ("Üz vərəqi", "Cover", None), ("Titul vərəqi", "Title page", None), ("Ümumi məlumatlar", "General data", "BP-1"),
        ("Mövqe planı", "Location plan", "BP-2"), ("Bölüşdürmə planı", "Site layout plan", "BP-3"),
        ("Relyefin təşkili planı", "Grading plan", "BP-4"), ("Abadlaşdırma planı", "Landscaping plan", "BP-5"),
        ("Təsnifatlar", "Site materials schedule", "BP-6"),
    ]
    for i, (t, te, no) in enumerate(bp, 1):
        out.append(_sheet("BP", i, t, te, "SITE", "site" if i > 2 else "general", no))

    ar = {
        1: ("Lisenziya", "Design licence", "general", "SITE", None),
        2: ("Lisenziyaya əlavə", "Licence annex", "general", "SITE", None),
        3: ("Üz vərəqi", "Cover", "general", "WH", None),
        4: ("Titul vərəqi, anbar binası", "Title page, warehouse", "general", "WH", None),
        5: ("Ümumi məlumatlar", "General data", "arch", "WH", "MH-1"),
        6: ("Mövqe planı", "Location plan", "arch", "WH", "MH-2"),
        7: ("Anbar və inzibati binanın ±0.000 səviyyəsinin planı", "Warehouse and admin building, plan at ±0.000", "arch", "WH", "MH-3"),
        8: ("±0.000 səviyyəsinin planı", "Plan at ±0.000", "arch", "WH", "MH-4"),
        9: ("±0.000 səviyyəsinin divar markalanması (hörgü planı)", "Wall types plan at ±0.000", "arch", "WH", "MH-5"),
        10: ("±0.000 səviyyəsinin bəzək planı", "Finishes plan at ±0.000", "arch", "WH", "MH-6"),
        11: ("Damın planı", "Roof plan", "arch", "WH", "MH-7"),
        12: ("Kəsik 1-1", "Section 1-1", "arch", "WH", "MH-8"),
        13: ("Kəsik 2-2", "Section 2-2", "arch", "WH", "MH-9"),
        14: ("Fasad 12-4", "Elevation 12-4", "arch", "WH", "MH-10"),
        15: ("Fasad 4-12", "Elevation 4-12", "arch", "WH", "MH-11"),
        16: ("Fasad A*-E*", "Elevation A*-E*", "arch", "WH", "MH-12"),
        17: ("Fasad E*-A*", "Elevation E*-A*", "arch", "WH", "MH-13"),
        18: ("Döşəmə və divarın təsnifatı", "Floor and wall finish schedule", "arch", "WH", "MH-14"),
        19: ("Qapı və pəncərələrin spesifikasiyası", "Door and window schedule", "arch", "WH", "MH-15"),
        20: ("Titul vərəqi, inzibati bina", "Title page, admin building", "general", "AD", None),
        21: ("Ümumi məlumatlar", "General data", "arch", "AD", "MH-1"),
        22: ("Mövqe planı", "Location plan", "arch", "AD", "MH-2"),
        23: ("Anbar və inzibati binanın ±0.000 səviyyəsinin planı", "Warehouse and admin building, plan at ±0.000", "arch", "AD", "MH-3"),
        24: ("±0.000 səviyyəsinin planı", "Plan at ±0.000 with room schedule", "arch", "AD", "MH-4"),
        25: ("±0.000 səviyyəsinin divar markalanması (hörgü planı)", "Wall types plan at ±0.000", "arch", "AD", "MH-5"),
        26: ("±0.000 səviyyəsinin döşəmə markalanması", "Floor finishes plan", "arch", "AD", "MH-6"),
        27: ("±0.000 səviyyəsinin tavan markalanması", "Ceiling plan", "arch", "AD", "MH-7"),
        28: ("±0.000 səviyyəsinin qapı-pəncərə markalanması", "Door and window plan", "arch", "AD", "MH-8"),
        29: ("±0.000 səviyyəsinin mebel planı", "Furniture plan", "arch", "AD", "MH-9"),
        30: ("Damın planı", "Roof plan", "arch", "AD", "MH-10"),
        31: ("Kəsik 1-1", "Section 1-1", "arch", "AD", "MH-11"),
        32: ("Kəsik 2-2", "Section 2-2", "arch", "AD", "MH-12"),
        33: ("Fasad F-A; Fasad A-F", "Elevations F-A and A-F", "arch", "AD", "MH-13"),
        34: ("Fasad 1-3; Fasad 3-1", "Elevations 1-3 and 3-1", "arch", "AD", "MH-14"),
        35: ("Döşəmə, tavan və divarın təsnifatı", "Floor, ceiling and wall finish schedule", "arch", "AD", "MH-15"),
        36: ("Qapı və pəncərələrin spesifikasiyası", "Door and window schedule", "arch", "AD", "MH-16"),
    }
    for p, (t, te, disc, b, no) in ar.items():
        out.append(_sheet("AR", p, t, te, b, disc, no))

    ks_titles = {
        1: ("Üz vərəqi", "Cover"), 2: ("Titul vərəqi", "Title page"), 3: ("Ümumi verilənlər", "General data"),
        4: ("Çalanın yerləşmə planı", "Excavation plan"), 5: ("Kəsik A-A", "Section A-A"), 6: ("Kəsik B-B", "Section B-B"),
        7: ("Monolit d/b lentvari bünövrə və başmaqların yerləşmə planı", "Strip foundation and pad footing layout"),
        8: ("Bünövrə kəsikləri A-A, B-B", "Foundation sections A-A, B-B"),
        9: ("Monolit d/b lentvari bünövrə. Başmaq MB-1", "Strip foundation and pad footing MB-1"),
        10: ("±0.00 səviyyəsində monolit d/b döşəmə və kəmərin yerləşmə planı", "Ground slab and ring beam layout at ±0.00"),
        11: ("±0.00 səviyyəsində monolit d/b döşəmə və kəmərin konstruksiyası", "Ground slab and ring beam Mk-1 details"),
        12: ("-0.70 səviyyəsində sütunların yerləşmə planı", "Column layout at -0.70"),
        13: ("±0.00 səviyyəsində sütunların yerləşmə planı", "Column layout at ±0.00"),
        14: ("+7.00 səviyyəsində sütunların yerləşmə planı", "Column layout at +7.00"),
        15: ("Monolit d/b sütun Ms-1", "Column Ms-1"), 16: ("Monolit d/b sütun Ms-2", "Column Ms-2"),
        17: ("Monolit d/b sütun Ms-3", "Column Ms-3"), 18: ("Monolit d/b sütun Ms-4", "Column Ms-4"),
        19: ("+3.70 səviyyəsində kəmərlərin yerləşmə planı", "Ring beam layout at +3.70"),
        20: ("+7.00 səviyyəsində rigellərin yerləşmə planı", "Beam layout at +7.00"),
        21: ("+8.00 səviyyəsində rigellərin yerləşmə planı", "Beam layout at +8.00"),
        22: ("Monolit d/b kəmər Mk-2", "Ring beam Mk-2"), 23: ("Monolit d/b rigel MR-1", "Beam MR-1"),
        24: ("Monolit d/b rigel MR-2", "Beam MR-2"), 25: ("Monolit d/b rigel MR-3", "Beam MR-3"),
        26: ("Fermaların yerləşməsi", "Truss layout"), 27: ("Ferma F-1", "Truss F-1 geometry"),
        28: ("Düyün D-01, D-02", "Nodes D-01, D-02"), 29: ("Düyün D-03 ... D-07", "Nodes D-03 to D-07"), 30: ("Düyün D-08", "Node D-08"),
        31: ("Ferma F-1 üçün material sərfi", "Truss F-1 material schedule"),
        32: ("Şaquli rabitə Şr-1", "Vertical bracing Şr-1"), 33: ("Şaquli rabitə Şr-2", "Vertical bracing Şr-2"),
        34: ("Alt kəmər üzrə üfüqi rabitələrin yerləşmə planı", "Bottom chord bracing layout"),
        35: ("Alt kəmər üzrə üfüqi rabitə və düyünləri", "Bottom chord bracing and nodes"),
        36: ("Üst kəmər üzrə üfüqi rabitələrin yerləşmə planı", "Top chord bracing layout"),
        37: ("Üst kəmər üzrə üfüqi rabitə", "Top chord bracing"),
        38: ("Proqonların yerləşmə planı. Material sərfi", "Purlin layout and schedule"),
        39: ("Titul vərəqi", "Title page"), 40: ("Ümumi verilənlər", "General data"),
        41: ("Çalanın yerləşmə planı", "Excavation plan"), 42: ("Kəsik A-A", "Section A-A"), 43: ("Kəsik B-B", "Section B-B"),
        44: ("Lentvari bünövrənin yerləşmə planı", "Strip foundation layout"),
        45: ("Bünövrənin alt armaturlarının planı", "Strip foundation bottom bars"),
        46: ("Bünövrənin üst armaturlarının planı", "Strip foundation top bars"),
        47: ("Lentvari bünövrənin material sərfi", "Strip foundation schedule"),
        48: ("±0.00 səviyyəsində döşəmə və kəmərin planı", "Ground slab and ring beam layout"),
        49: ("±0.00 səviyyəsində döşəmə və kəmər Mk-1", "Ground slab and ring beam Mk-1"),
        50: ("-0.80 səviyyəsində sütunların yerləşmə planı", "Column layout at -0.80"),
        51: ("Monolit d/b sütun Ms-1", "Column Ms-1"),
        52: ("+3.30 səviyyəsində rigellərin yerləşmə planı", "Beam layout at +3.30"),
        53: ("Monolit d/b rigel MR-1", "Beam MR-1"), 54: ("Monolit d/b rigel MR-2", "Beam MR-2"),
        55: ("+3.30 səviyyəsində örtüyün yerləşmə planı", "Roof slab layout at +3.30"),
        56: ("+3.30 örtüyün alt torunun armaturlanması", "Roof slab bottom mesh"),
        57: ("+3.30 örtüyün üst torunun armaturlanması", "Roof slab top mesh"),
        58: ("+3.30 örtük üçün material təsnifatı", "Roof slab schedule"),
        59: ("Damda çatı elementlərinin yerləşmə planı", "Timber roof layout"),
        60: ("Kəsik 1", "Roof section 1"), 61: ("Damda çatı elementlərinin material sərfi", "Timber roof schedule"),
    }
    for p, (t, te) in ks_titles.items():
        b = "WH" if p <= 38 else "AD"
        out.append(_sheet("KS", p, t, te, b, "general" if p in (1, 2, 39) else "struct"))

    mep_sets = [
        (1, 7, "WH", "elec", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat (1)", "Ümumi məlumat (2)", "Mərtəbənin işıqlanma planı. Torpaqlama", "BPL lövhəsinin prinsipial sxemi", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes (1)", "General notes (2)", "Lighting and earthing plan", "Distribution board BPL schematic", "Equipment schedule"]),
        (8, 14, "WH", "hvac", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat (əvvəli)", "Ümumi məlumat (sonu)", "Ventilyasiya sisteminin planı", "Ventilyasiya 9-1 fasadı", "Material və avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes (start)", "General notes (end)", "Ventilation plan", "Ventilation, elevation 9-1", "Equipment schedule"]),
        (15, 20, "WH", "fire", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Daxili yanğınsöndürmə sisteminin planı", "Daxili yanğınsöndürmə sisteminin sxemi", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "Internal fire water plan", "Internal fire water schematic", "Equipment schedule"]),
        (21, 25, "WH", "alarm", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Yanğın siqnalizasiya şəbəkəsinin planı", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "Fire alarm plan", "Equipment schedule"]),
        (26, 33, "PS", "elec", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat (1)", "Şərti işarələr", "Prinsipial elektrik sxemi PLN", "Elektrik güc avadanlıqları", "Elektrik işıqlanması. Plan", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "Legend", "Panel PLN schematic", "Power equipment", "Lighting plan", "Equipment schedule"]),
        (34, 39, "PS", "plumb", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Plan, kəsik 1-1", "Kəsik 1-1, kəsik 2-2, sxem", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "Plan and section 1-1", "Sections and schematic", "Equipment schedule"]),
        (40, 48, "AD", "elec", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat (1)", "Ümumi məlumat (2)", "Mərtəbənin torpaqlama planı", "Mərtəbənin işıqlanma planı", "Mərtəbənin güc və torpaqlama planı", "BPL lövhəsinin prinsipial sxemi", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes (1)", "General notes (2)", "Earthing plan", "Lighting plan", "Power and earthing plan", "Distribution board BPL schematic", "Equipment schedule"]),
        (49, 56, "AD", "hvac", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat (əvvəli)", "Ümumi məlumat (sonu)", "Ventilyasiya sisteminin planı", "Ventilyasiya sisteminin aksonometrik sxemi", "Kondisioner sisteminin planı", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes (start)", "General notes (end)", "Ventilation plan", "Ventilation isometric", "Air conditioning plan", "Equipment schedule"]),
        (57, 61, "AD", "alarm", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Yanğın siqnalizasiya şəbəkəsinin planı", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "Fire alarm plan", "Equipment schedule"]),
        (62, 66, "WH", "lowcur", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Videomüşahidə şəbəkəsinin planı", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "CCTV plan", "Equipment schedule"]),
        (67, 72, "AD", "lowcur", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Videomüşahidə şəbəkəsinin planı", "Rabitə şəbəkəsinin planı", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "CCTV plan", "Data network plan", "Equipment schedule"]),
        (73, 81, "AD", "plumb", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Soyuq, isti su və kanalizasiya planı", "Damın kanalizasiya planı", "Soyuq və isti su sxemi", "Kanalizasiya sxemi", "Avadanlığın təsnifatı (1)", "Avadanlığın təsnifatı (2)"],
         ["Cover", "Title page", "General notes", "Water and drainage plan", "Roof drainage plan", "Water schematic", "Drainage schematic", "Equipment schedule (1)", "Equipment schedule (2)"]),
        (82, 86, "AD", "pa", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Səsli xəbərverici sisteminin planı", "Avadanlığın təsnifatı"],
         ["Cover", "Title page", "General notes", "Public address plan", "Equipment schedule"]),
        (87, 93, "TK", "plumb", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Su anbarının planı (5)", "Kəsik 1-1 (5)", "Kəsik 2-2 (5)", "Avadanlığın təsnifatı (5)"],
         ["Cover", "Title page", "General notes", "Tank 5 plan", "Tank 5 section 1-1", "Tank 5 section 2-2", "Tank 5 equipment schedule"]),
        (94, 100, "TK", "plumb", ["Üz vərəqi", "Titul vərəqi", "Ümumi məlumat", "Su anbarının planı (6)", "Kəsik 1-1 (6)", "Kəsik 2-2 (6)", "Avadanlığın təsnifatı (6)"],
         ["Cover", "Title page", "General notes", "Tank 6 plan", "Tank 6 section 1-1", "Tank 6 section 2-2", "Tank 6 equipment schedule"]),
    ]
    for first, last, b, disc, az, en in mep_sets:
        assert last - first + 1 == len(az) == len(en), (first, last)
        for k, p in enumerate(range(first, last + 1)):
            out.append(_sheet("MEP", p, az[k], en[k], b, "general" if k < 2 else disc))
    return out


# --------------------------------------------------------------------------- takeoff

ITEMS = []


def item(id, bld, sec, az, en, unit, qty, src, method="schedule", formula=None, rate=None, note=None, line=None):
    ITEMS.append({"id": id, "building": bld, "section": sec, "az": az, "en": en, "unit": unit, "qty": qty,
                  "src": src, "method": method, "formula": formula, "rate": rate, "note": note, "line": line})


def rebar(id, bld, sec, element_az, element_en, a500, ai, page, label, a500_kw=None, ai_kw=None, extra=None):
    """Two reinforcement items (A500C and A-I) for one element, from its steel schedule row."""
    item(f"{id}-a500", bld, "rebar", f"{element_az}: armatur A500C (DÜİST 52544-2006)", f"{element_en}: rebar A500C",
         "kg", float(a500), [L("KS", page, a500, *label, **(a500_kw or {}))], rate="rebar_a500")
    if ai:
        item(f"{id}-ai", bld, "rebar", f"{element_az}: armatur A-I (A240) (DÜİST 5781-82*)", f"{element_en}: rebar A-I (A240)",
             "kg", float(ai), [L("KS", page, ai, *label, **(ai_kw or {}))], rate="rebar_ai")


def build_structure():
    # Warehouse foundations, KS p7 and p9
    item("wh-strip", "WH", "sub", "Monolit d/b lentvari bünövrə LB-1 (400×500 h), beton B25", "RC strip foundation LB-1 (400 × 500 mm), concrete B25",
         "m³", 38.40, [L("KS", 9, "38.40", "Beton", "B25"), L("KS", 7, "192.00", "LB-1", role="length")], rate="conc_fdn",
         note="Schedule gives 192.00 m of strip; 192.00 × 0.40 × 0.50 = 38.40 m³.")
    item("wh-pads", "WH", "sub", "Monolit d/b başmaq MB-1 (1500×2400×500 h), 31 ədəd, beton B25", "RC pad footings MB-1 (1500 × 2400 × 500 mm), 31 no., concrete B25",
         "m³", round(31 * 1.80, 2), [L("KS", 9, "1.80", "Beton", "B25"), L("KS", 7, "31", "Başmaq", role="count")], method="derived",
         formula="31 no. × 1.80 m³", rate="conc_fdn")
    rebar("wh-pads-r", "WH", "rebar", "Başmaq MB-1 (31 ədəd)", "Pad footings MB-1 (31 no.)", "3753.48", None, 9, ("başmaq",),
          a500_kw={"dy": 9, "x_range": (900, 1000)})
    rebar("wh-strip-r", "WH", "rebar", "Lentvari bünövrə", "Strip foundation", "1461.70", "682.60", 9, ("Lentavri",),
          a500_kw={"dy": 8, "x_range": (900, 1000)}, ai_kw={"dy": 8, "x_range": (780, 820)})

    # Warehouse ground slab and ring beam, KS p11
    item("wh-slab", "WH", "sub", "±0.00 səviyyəsində monolit d/b döşəmə tavası h=150 mm, beton B15 (1109.10 m²)", "Ground bearing slab 150 mm at ±0.00, concrete B15 (1,109.10 m²)",
         "m³", 166.37, [L("KS", 11, "166.37", "Beton", "B15"), L("KS", 11, "1109.10", role="area")], rate="conc_slab_grd")
    item("wh-blind", "WH", "sub", "Döşəmə altı beton hazırlıq qatı B7.5, h=100 mm", "Blinding under ground slab, concrete B7.5, 100 mm",
         "m³", round(1109.10 * 0.10, 2), [L("KS", 11, "1109.10", role="area"), L("KS", 11, "h=100", "hazirliq", role="thickness")],
         method="derived", formula="1109.10 m² × 0.10 m", rate="conc_blind")
    item("wh-stone", "WH", "sub", "Qırmadaş qatı (fraksiya 20×40) h=100 mm", "Crushed stone layer (20–40 mm) 100 mm",
         "m³", round(1109.10 * 0.10, 2), [L("KS", 11, "1109.10", role="area"), L("KS", 11, "h=100", "Qırmadaş", role="thickness")],
         method="derived", formula="1109.10 m² × 0.10 m", rate="crushed_stone")
    item("wh-carb", "WH", "sub", "Karbonat qatı h=500 mm (hər 250 mm-dən bir kipləşdirməklə)", "Carbonate fill 500 mm, compacted every 250 mm",
         "m³", round(1109.10 * 0.50, 2), [L("KS", 11, "1109.10", role="area"), L("KS", 11, "h=500", "Karbonat", role="thickness")],
         method="derived", formula="1109.10 m² × 0.50 m", rate="fill_carbonate")
    rebar("wh-slab-r", "WH", "rebar", "Döşəmə tavası", "Ground slab", "10341.7", "714.00", 11, ("tavası",),
          a500_kw={"x_range": (960, 1000)}, ai_kw={"x_range": (800, 850)})
    item("wh-mk1", "WH", "sub", "Monolit d/b kəmər Mk-1 (400×200), 192.00 p.m., beton B25", "RC ground ring beam Mk-1 (400 × 200 mm), 192.00 m, concrete B25",
         "m³", 15.36, [L("KS", 11, "15.36", "B25")], rate="conc_beam")
    rebar("wh-mk1-r", "WH", "rebar", "Kəmər Mk-1", "Ring beam Mk-1", "1790.30", "422.40", 11, ("kəmər",))

    # Warehouse columns, KS p15–18
    cols = [("1", 15, "32.55", "21", "1965.6", "1148.7"), ("2", 16, "7.0", "4", "670.4", "244.4"),
            ("3", 17, "7.2", "4", "683.2", "254.8"), ("4", 18, "3.72", "2", "348.0", "132.6")]
    for n, page, vol, count, a500, ai in cols:
        item(f"wh-ms{n}", "WH", "frame", f"Monolit d/b sütun Ms-{n} (400×500), {count} ədəd, beton B25", f"RC column Ms-{n} (400 × 500 mm), {count} no., concrete B25",
             "m³", float(vol), [L("KS", page, vol, f"Ms-{n}")], rate="conc_col", line="wh-cols")
        rebar(f"wh-ms{n}-r", "WH", "rebar", f"Sütun Ms-{n} ({count} ədəd)", f"Column Ms-{n} ({count} no.)", a500, ai, page, (f"Ms-{n}",))

    # Warehouse beams, KS p22–25
    item("wh-mk2", "WH", "frame", "+3.70 səviyyəsində monolit d/b kəmər Mk-2 (400×250), 144.0 p.m., beton B25", "RC ring beam Mk-2 at +3.70 (400 × 250 mm), 144.0 m, concrete B25",
         "m³", 11.52, [L("KS", 22, "11.52", "Beton")], rate="conc_beam")
    rebar("wh-mk2-r", "WH", "rebar", "Kəmər Mk-2", "Ring beam Mk-2", "538.2", "345.6", 22, ("kəmər",))
    for n, page, vol, count, a500, ai in [("1", 23, "26.88", "3", "1925.70", "1202.70"), ("2", 24, "8.80", "2", "652.40", "401.00"), ("3", 25, "8.80", "2", "482.60", "401.00")]:
        item(f"wh-mr{n}", "WH", "frame", f"Monolit d/b rigel MR-{n} (400×500), {count} ədəd, beton B25", f"RC beam MR-{n} (400 × 500 mm), {count} no., concrete B25",
             "m³", float(vol), [L("KS", page, vol, "RİGEL", "ÜÇÜN")], rate="conc_beam", line="wh-beams")
        rebar(f"wh-mr{n}-r", "WH", "rebar", f"Rigel MR-{n} ({count} ədəd)", f"Beam MR-{n} ({count} no.)", a500, ai, page, ("RİGEL", "ÜÇÜN"))
    item("wh-embed-anc", "WH", "steel", "Proqon dayaq detalları: ankerlər Ø14 A500C, L=1190, 72 ədəd", "Purlin bearing embeds: anchors Ø14 A500C, L = 1190 mm, 72 no.",
         "kg", 103.50, [L("KS", 25, "103.50", "Ø14")], rate="steel_embed")
    item("wh-embed-plate", "WH", "steel", "Proqon dayaq detalları: metal lövhə -400×200×10, 36 ədəd", "Purlin bearing embeds: steel plate 400 × 200 × 10 mm, 36 no.",
         "kg", 226.10, [L("KS", 25, "226.10", "400")], rate="steel_embed")

    # Warehouse steelwork, KS p26–38
    item("wh-truss", "WH", "steel", "Polad ferma F-1 (profil 80×80×4, C245), 7 ədəd", "Steel roof truss F-1 (SHS 80 × 80 × 4, C245), 7 no.",
         "kg", round(7 * (828.26 + 253.36), 2),
         [L("KS", 31, "828.26", role="profiles"), L("KS", 31, "253.36", role="plates"), M("KS", 26, [354, 262, 889, 343], "Ferma F-1 × 7, oxlar 5–11", role="count")],
         method="derived", formula="7 no. × (828.26 kg profiles + 253.36 kg plates)", rate="steel_struct")
    item("wh-sr1", "WH", "steel", "Şaquli rabitə Şr-1 (4 ədəd), profil 80×4 və lövhələr", "Vertical bracing Şr-1 (4 no.), angle 80 × 4 and plates",
         "kg", round(402.28 + 140.6, 2), [L("KS", 32, "402.28"), L("KS", 32, "140.6")], method="derived", formula="402.28 kg profiles + 140.6 kg plates", rate="steel_struct")
    item("wh-sr2", "WH", "steel", "Şaquli rabitə Şr-2 (4 ədəd), profil 80×4 və lövhələr", "Vertical bracing Şr-2 (4 no.), angle 80 × 4 and plates",
         "kg", round(808.80 + 140.6, 2), [L("KS", 33, "808.80"), L("KS", 33, "140.6")], method="derived", formula="808.80 kg profiles + 140.6 kg plates (as printed)", rate="steel_struct",
         note="Printed profile total does not add up. See check C-01.")
    item("wh-brace-bot", "WH", "steel", "Fermaların alt kəməri üzrə üfüqi rabitələr və dartqılar", "Bottom chord horizontal bracing and ties",
         "kg", round(4784.64 + 926.10, 2), [L("KS", 35, "4784.64"), L("KS", 35, "926.10")], method="derived", formula="4784.64 kg profiles + 926.10 kg plates", rate="steel_struct")
    item("wh-brace-top", "WH", "steel", "Fermaların üst kəməri üzrə üfüqi rabitələr", "Top chord horizontal bracing",
         "kg", round(1908.16 + 401.88, 2), [L("KS", 37, "1908.16", x_range=(1050, 1120)), L("KS", 37, "401.88")], method="derived", formula="1908.16 kg profiles + 401.88 kg plates", rate="steel_struct")
    item("wh-purlin", "WH", "steel", "Proqonlar: şveller 12, L=12000, 72 ədəd və birləşmə küncləri 80×60×6", "Purlins: channel 12, L = 12 m, 72 no., with cleats 80 × 60 × 6",
         "kg", 9068.30, [L("KS", 38, "9068.30")], rate="steel_struct")

    # Admin building structure, KS p47–61
    item("ad-strip", "AD", "sub", "Monolit d/b lentvari bünövrə h=400 mm, beton B25", "RC strip foundation 400 mm, concrete B25",
         "m³", 33.0, [L("KS", 47, "33.0", "Beton")], rate="conc_fdn")
    rebar("ad-strip-r", "AD", "rebar", "Lentvari bünövrə", "Strip foundation", "1046.2", "721.0", 47, ("LENTVARİ",))
    item("ad-slab", "AD", "sub", "±0.00 səviyyəsində monolit d/b döşəmə tavası h=100 mm, beton B15", "Ground slab 100 mm at ±0.00, concrete B15",
         "m³", 18.1, [L("KS", 49, "18.1", "BETON", "B15")], rate="conc_slab_grd", note="Architecture shows 150 mm here. See check C-03.")
    item("ad-slab-r-a500", "AD", "rebar", "Döşəmə tavası: armatur Ø10 A500C", "Ground slab: rebar Ø10 A500C", "kg", 1172.3,
         [L("KS", 49, "1172.3", "TAVASI")], rate="rebar_a500")
    item("ad-mk1", "AD", "sub", "Monolit d/b kəmər Mk-1, beton B25", "RC ground ring beam Mk-1, concrete B25", "m³", 5.3, [L("KS", 49, "5.3", "B25")], rate="conc_beam")
    item("ad-mk1-r-a500", "AD", "rebar", "Kəmər Mk-1: armatur Ø12 A500C", "Ring beam Mk-1: rebar Ø12 A500C", "kg", 257.9, [L("KS", 49, "257.9", "L=290.4")], rate="rebar_a500")
    item("ad-mk1-r-ai", "AD", "rebar", "Kəmər Mk-1: armatur Ø8 A-I (A240)", "Ring beam Mk-1: rebar Ø8 A-I", "kg", 145.2, [L("KS", 49, "145.2", "0.44", dy=9)], rate="rebar_ai")
    item("ad-ms1", "AD", "frame", "Monolit d/b sütun Ms-1 (400×400), 18 ədəd, beton B25", "RC column Ms-1 (400 × 400 mm), 18 no., concrete B25",
         "m³", 10.8, [L("KS", 51, "10.8", "Ms-1")], rate="conc_col")
    rebar("ad-ms1-r", "AD", "rebar", "Sütun Ms-1 (18 ədəd)", "Column Ms-1 (18 no.)", "1684.8", "392.4", 51, ("Ms-1",))
    item("ad-mr1", "AD", "frame", "Monolit d/b rigel MR-1, 3 ədəd, beton B25", "RC beam MR-1, 3 no., concrete B25", "m³", 7.5,
         [L("KS", 53, "7.5", "RİGEL", "ÜÇÜN")], rate="conc_beam", line="ad-beams")
    rebar("ad-mr1-r", "AD", "rebar", "Rigel MR-1 (3 ədəd)", "Beam MR-1 (3 no.)", "1310.4", "572.4", 53, ("RİGEL", "ÜÇÜN"))
    item("ad-mr2", "AD", "frame", "Monolit d/b rigel MR-2, 6 ədəd, beton B25", "RC beam MR-2, 6 no., concrete B25", "m³", 5.1,
         [L("KS", 54, "5.1", "RİGEL", "ÜÇÜN")], rate="conc_beam", line="ad-beams")
    rebar("ad-mr2-r", "AD", "rebar", "Rigel MR-2 (6 ədəd)", "Beam MR-2 (6 no.)", "874.8", "388.2", 54, ("RİGEL", "ÜÇÜN"))
    item("ad-roofslab", "AD", "frame", "+3.30 səviyyəsində monolit d/b örtük tavası h=150 mm, beton B25", "RC roof slab 150 mm at +3.30, concrete B25",
         "m³", 31.1, [L("KS", 58, "31.1", "Beton")], rate="conc_slab")
    rebar("ad-roofslab-r", "AD", "rebar", "Örtük tavası", "Roof slab", "3854.8", "130.0", 58, ("örtük",))

    # Admin timber roof, KS p61
    item("ad-timber", "AD", "roof", "Ağac çatı elementləri (mauerlat, çatı ayaqları, dik dayaq, reyka və s.)", "Timber roof structure (wall plate, rafters, posts, battens, ties)",
         "m³", 8.3, [L("KS", 61, "8.3", "CƏMİ")], rate="timber_roof")
    item("ad-timber-ties", "AD", "roof", "Mauerlatı bağlamaq üçün və anker armatur Ø12, 65+65 ədəd", "Wall plate ties and anchor bars Ø12, 65 + 65 no.",
         "kg", 104.0, [L("KS", 61, "78", "MAUERLATI", dy=6), L("KS", 61, "26", "ANKER", dy=6)], method="derived", formula="78 kg + 26 kg", rate="steel_embed")
    item("ad-profnastil", "AD", "roof", "Profnastil dam örtüyü", "Profiled metal roof sheeting", "m²", 260.0, [L("KS", 61, "260.0", "PROFNASTİL")], rate="roof_sheet")
    item("ad-palan", "AD", "roof", "Metal lövhə (palan)", "Metal flashing (eaves sheet)", "m", 42.2, [L("KS", 61, "42.2", "LÖVHƏ")], rate="flashing")
    item("ad-gutter", "AD", "roof", "Su aparan nov Ø100", "Gutter Ø100", "m", 70.0, [L("KS", 61, "70.0", "NOV-", dy=7)], rate="gutter")


def build_architecture():
    # Warehouse, AR set 1 (p5–19)
    item("wh-wall", "WH", "masonry", "Xarici divarlar 400 mm mişarlanmış əhəng daşından", "External walls, 400 mm sawn limestone",
         "m²", 787.4, [L("AR", 5, "787.4", "DAŞI"), M("AR", 18, [756, 370, 1093, 451], "D1: 1. Mişarlanmış əhəng daşı 2. Suvaq 3. Şpatlovka 4. 3 qat boya — 787.4", role="schedule")],
         rate="wall_limestone")
    item("wh-wallfin", "WH", "finish", "Daxili divarlar: suvaq, şpatlovka, 3 qat boya", "Internal walls: plaster, skim coat, three coats of paint",
         "m²", 787.4, [M("AR", 18, [756, 370, 1093, 451], "Divar D1: Suvaq, Şpatlovka, 3 qat boya, 787.4 m²", "787.4")], method="image", rate="int_paint")
    item("wh-floor", "WH", "finish", "Döşəmə D1: cilalanmış beton 50 mm", "Floor D1: polished concrete topping 50 mm",
         "m²", 1122.0, [M("AR", 10, [81, 775, 465, 800], "Anbar sahəsi 1 122 m²", "1122"), M("AR", 18, [284, 384, 500, 397], "1. Cilalanmış beton - 50 mm — 56.1 m³", "56.1")],
         method="image", rate="polished_conc", formula="56.1 m³ ÷ 0.05 m = 1,122 m²")
    for page, name_az, name_en, area, box in [
        (14, "Fasad 12-4", "Elevation 12-4", 430.6, [116, 755, 417, 815]), (15, "Fasad 4-12", "Elevation 4-12", 400.0, [116, 755, 417, 815]),
        (16, "Fasad A*-E*", "Elevation A*-E*", 207.2, [112, 755, 417, 815]), (17, "Fasad E*-A*", "Elevation E*-A*", 207.2, [112, 755, 417, 815])]:
        item(f"wh-fac-{page}", "WH", "finish", f"{name_az}: sement-qum suvaq və 3 qat fasad boyası", f"{name_en}: cement-sand render and three coats of facade paint",
             "m²", area, [M("AR", page, box, f"Fasad materiallarının spesifikasiyası: Mişarlanmış əhəng daşı, Suvaq, 3 qat boya — {area}", str(area))],
             method="image", rate="facade_paint", line="wh-facade")
    item("wh-door", "WH", "openings", "Q-1 hermetik jalüz qapı 3000×3500 (h), 3 ədəd", "Q-1 sealed roller shutter door 3000 × 3500 mm, 3 no.",
         "m²", 31.5, [M("AR", 19, [56, 196, 1035, 232], "Q-1 Germetik jalüz qapı, Qapı 3000 x 3500 (h), 3, 31.5", "31.5")], method="image", rate="door_roller")
    item("wh-win", "WH", "openings", "P-1 plastik (PVC) pəncərə 2000×800 (h), 21 ədəd", "P-1 PVC window 2000 × 800 mm, 21 no.",
         "m²", 33.6, [M("AR", 19, [56, 266, 1035, 304], "P-1 Plastik (PVC) pəncərə, Pəncərə 2000 x 800 (h), 21, 33.6", "33.6")], method="image", rate="window_pvc")
    item("wh-roof", "WH", "roof", "Profnastil dam örtüyü t=0.4 mm, proqonlar üzrə", "Profiled metal roof sheeting 0.4 mm on purlins",
         "m²", 1180.96, [M("AR", 11, [606, 328, 716, 353], "9.16 1180.96 m²", "1180.96"), M("AR", 13, [286, 198, 372, 214], "PROFNASTİL (t=0.4mm), PROQON, METAL KONSTRUKSİYA", role="spec")],
         method="image", rate="roof_sheet")
    for key, az, en, unit, qty, y, rate in [
        ("pipe", "Su axıdan boru Ø100", "Downpipe Ø100", "m", 45, 730, "downpipe"),
        ("elbow", "Dirsək Ø100", "Downpipe elbow Ø100", "ədəd", 6, 750, "rain_elbow"),
        ("funnel", "Su qəbuledici qıf", "Rainwater outlet funnel", "ədəd", 6, 771, "rain_funnel"),
        ("clamp", "Metal xamut 100×150", "Downpipe clamp 100 × 150", "ədəd", 60, 792, "rain_clamp")]:
        item(f"wh-rain-{key}", "WH", "roof", az, en, unit, float(qty), [M("AR", 11, [70, y - 10, 477, y + 10], f"Materialların təsnifatı: {az} — {qty}", str(qty))], method="image", rate=rate)

    # Admin building, AR set 2 (p21–36)
    item("ad-wall", "AD", "masonry", "Xarici divarlar 400 mm mişarlanmış əhəng daşından", "External walls, 400 mm sawn limestone",
         "m²", 187.73, [L("AR", 21, "187.73", "DAŞI"), M("AR", 25, [651, 338, 1175, 366], "D1 Xarici divarların (mişarlanmış əhəng daşı) quraşdırılması 0.4 64.3 3.25 187.73", role="schedule")],
         rate="wall_limestone")
    item("ad-part200", "AD", "masonry", "Arakəsmələr 200 mm yüngül boşluqlu kərpicdən (M50)", "Partitions, 200 mm hollow brick (M50)",
         "m²", 149.27, [L("AR", 21, "-149.27", "HÖRGÜ"), M("AR", 25, [651, 368, 1175, 396], "D2 Arakəsmələrin (kərpic) quraşdırılması 0.2 49.45 3.25 149.27", role="schedule")],
         rate="wall_brick200")
    item("ad-part50", "AD", "masonry", "Arakəsmələr 50 mm kərpicdən", "Partitions, 50 mm brick",
         "m²", 13.7, [L("AR", 21, "-13.7", "HÖRGÜ"), M("AR", 25, [651, 397, 1175, 422], "D3 Arakəsmələrin (kərpic) quraşdırılması 0.05 4.19 3.25 13.7", role="schedule")],
         rate="wall_brick50")
    item("ad-fl-d1", "AD", "finish", "Döşəmə D1 (otaq 1, 5): süni qranit 10 mm yapışdırıcıda, sement-qum məhlulu 50 mm", "Floor D1 (rooms 1, 5): porcelain granite 10 mm on adhesive, 50 mm screed",
         "m²", 72.32, [L("AR", 35, "72.32", "qranit")], rate="floor_porcelain")
    item("ad-fl-d2", "AD", "finish", "Döşəmə D2 (otaq 2, 3, 4): laminat 8 mm, dikt 15 mm, reyka 50 mm, tol 2 qat, düzləndirici 60 mm", "Floor D2 (rooms 2, 3, 4): laminate 8 mm on 15 mm plywood, 50 mm battens, 2 layers felt, 60 mm levelling screed",
         "m²", 82.88, [L("AR", 35, "82.88", "Laminat")], rate="floor_laminate")
    item("ad-fl-d3", "AD", "finish", "Döşəmə D3 (otaq 6, 7): metlax 8 mm, sement-qum məhlulu 50 mm", "Floor D3 (rooms 6, 7): ceramic floor tile 8 mm, 50 mm screed",
         "m²", 14.9, [L("AR", 35, "14.9", "Metlax")], rate="floor_tile")
    item("ad-ceil-t1", "AD", "finish", "Tavan T1: alçipan, şpaklovka, 2 qat suya davamlı boya", "Ceiling T1: plasterboard, skim coat, two coats of moisture-resistant paint",
         "m²", round(72.32 + 82.88, 2), [L("AR", 35, "72.32", "Alçipan", x_range=(700, 800)), L("AR", 35, "82.88", x_range=(700, 800))],
         method="derived", formula="72.32 m² (rooms 1, 5) + 82.88 m² (rooms 2, 3, 4)", rate="ceil_gypsum")
    item("ad-ceil-t2", "AD", "finish", "Tavan T2: metal asma tavan (Armstrong)", "Ceiling T2: metal suspended ceiling (Armstrong type)",
         "m²", 14.9, [L("AR", 35, "14.9", "tavan(armstronq)", x_range=(700, 800))], rate="ceil_metal")
    item("ad-wall-wp", "AD", "finish", "Divarlar: suvaq, şpaklovka, rənglənən divar kağızı, 3 qat boya", "Walls: plaster, skim coat, paintable wallpaper, three coats of paint",
         "m²", round(257.08 + 209.56, 2), [L("AR", 35, "257.08"), L("AR", 35, "209.56")], method="derived", formula="257.08 m² (rooms 1, 5) + 209.56 m² (rooms 2, 3, 4)", rate="wall_wallpaper")
    item("ad-wall-tile", "AD", "finish", "Divarlar (otaq 6, 7): suvaq və kafel", "Walls (rooms 6, 7): plaster and ceramic wall tile",
         "m²", 123.76, [L("AR", 35, "123.76")], rate="wall_tile")
    item("ad-fac-33", "AD", "finish", "Fasad F-A, A-F: sement-qum suvaq və 3 qat fasad boyası", "Elevations F-A and A-F: render and three coats of facade paint",
         "m²", 140.5, [M("AR", 33, [120, 755, 421, 818], "Fasad materiallarının spesifikasiyası: Mişarlanmış əhəng daşı, Suvaq, 3 qat boya — 140.5", "140.5")],
         method="image", rate="facade_paint", line="ad-facade")
    item("ad-fac-34", "AD", "finish", "Fasad 1-3, 3-1: sement-qum suvaq və 3 qat fasad boyası", "Elevations 1-3 and 3-1: render and three coats of facade paint",
         "m²", 51.2, [M("AR", 34, [126, 755, 421, 818], "Fasad materiallarının spesifikasiyası: Mişarlanmış əhəng daşı, Suvaq, 3 qat boya — 51.2", "51.2")],
         method="image", rate="facade_paint", line="ad-facade")
    for mark, az, en, count, area, y, rate in [
        ("Q-1", "MDF qapı 900×2100 (h)", "MDF door 900 × 2100 mm", 6, 11.3, 169, "door_mdf"),
        ("Q-2", "MDF qapı 900×2100 (h), sol", "MDF door 900 × 2100 mm, left hand", 2, 3.8, 188, "door_mdf"),
        ("Q-3", "Plastik (PVC) qapı 800×2100 (h)", "PVC door 800 × 2100 mm", 2, 3.4, 209, "door_pvc"),
        ("P-1", "Plastik (PVC) pəncərə 1200×1800 (h)", "PVC window 1200 × 1800 mm", 2, 4.3, 251, "window_pvc"),
        ("P-2", "Plastik (PVC) pəncərə 1400×1800 (h)", "PVC window 1400 × 1800 mm", 1, 2.5, 272, "window_pvc"),
        ("P-3", "Plastik (PVC) pəncərə 2000×1800 (h)", "PVC window 2000 × 1800 mm", 3, 10.8, 293, "window_pvc"),
        ("QP-1", "Alüminium qapı-pəncərə 3000×2400 (h)", "Aluminium door and screen 3000 × 2400 mm", 1, 7.2, 335, "door_alu")]:
        item(f"ad-{mark.lower()}", "AD", "openings", f"{mark} {az}, {count} ədəd", f"{mark} {en}, {count} no.", "m²", area,
             [M("AR", 36, [56, y - 10, 602, y + 10], f"{mark} {az} {count} {area}", str(area))], method="image", rate=rate)
    for key, az, en, unit, qty, y, rate in [
        ("pipe", "Su axıdan boru Ø100", "Downpipe Ø100", "m", 21.8, 364, "downpipe"),
        ("elbow", "Dirsək Ø100", "Downpipe elbow Ø100", "ədəd", 6, 393, "rain_elbow"),
        ("funnel", "Su qəbuledici qıf", "Rainwater outlet funnel", "ədəd", 6, 421, "rain_funnel"),
        ("clamp", "Metal xamut 100×150", "Downpipe clamp 100 × 150", "ədəd", 30, 449, "rain_clamp")]:
        item(f"ad-rain-{key}", "AD", "roof", az, en, unit, float(qty), [M("AR", 30, [651, y - 13, 1186, y + 13], f"Materialların təsnifatı: {az} — {qty}", str(qty))], method="image", rate=rate)


def mep(id, bld, sec, page, rows, rate_prefix, qx):
    """rows: (value, labels, az, en, unit, sample_rate[, kwargs]); qx is the x range of the quantity column."""
    for i, row in enumerate(rows, 1):
        value, labels, az, en, unit, sample = row[:6]
        kw = dict(row[6]) if len(row) > 6 else {}
        kw.setdefault("x_range", qx)
        key = f"{rate_prefix}-{i}"
        RATES[key] = {"unit": unit, "rate": sample, "en": en, "group": "Building services"}
        item(f"{id}-{i}", bld, sec, az, en, unit, float(value.replace(",", ".")), [L("MEP", page, value, *labels, **kw)], rate=key)


def build_mep():
    # Warehouse electrical, MEP p7
    mep("wh-el", "WH", "elec", 7, [
        ("1", ("Güc",), "Güc yeşiyi, ayırıcılı və qoruyuculu 380 V; 25 A", "Power box with isolator and fuses, 380 V, 25 A", "ədəd", 420),
        ("1", ("dəst",), "Asma tipli qutu 60×80×40 sm, IP20; girişdə NSX 3P 25A, C60a 1P C10A – 3 əd, DPN N Vigi 1P+N C16 – 4 əd (BPL)", "Distribution board BPL, surface 60 × 80 × 40 cm, IP20: incomer NSX 3P 25 A, 3 × C60a 1P C10 A, 4 × DPN N Vigi 1P+N C16", "dəst", 1650, {"x_range": (960, 990)}),
        ("3", ("Cərəyan",), "Cərəyan transformatoru 380 V, 25/5 A, TK-20", "Current transformer 380 V, 25/5 A, TK-20", "ədəd", 45),
        ("26", ("5.",), "ЛПП09 2×36 Vt lüminisent lampalı çıraq, IP44", "Fluorescent luminaire ЛПП09 2 × 36 W, IP44", "ədəd", 95),
        ("14", ("6.",), "ЛПП09 2×36 Vt lüminisent çıraq, ES1 qəza bloku ilə, IP44", "Fluorescent luminaire ЛПП09 2 × 36 W with ES1 emergency pack, IP44", "ədəd", 150),
        ("2", ("7.",), "Elektrik açarı ikiyerli 250 V, 10 A, IP20", "Two-gang light switch 250 V, 10 A, IP20", "ədəd", 14),
        ("8", ("8.",), "Ştepsel rozetkası, torpaqlama kontaktlı, 220 V, 16 A", "Socket outlet with earth, 220 V, 16 A", "ədəd", 16),
        ("10", ("9.",), "Kabel N2XH 5×4 mm²", "Cable N2XH 5 × 4 mm²", "m", 12.5),
        ("120", ("10.",), "Kabel N2XH 3×4 mm²", "Cable N2XH 3 × 4 mm²", "m", 8.2),
        ("250", ("11.",), "Kabel N2XH 3×2.5 mm²", "Cable N2XH 3 × 2.5 mm²", "m", 5.6),
        ("250", ("12.",), "PVC boru Ø20 mm", "PVC conduit Ø20 mm", "m", 1.8),
        ("120", ("13.",), "PVC boru Ø25 mm", "PVC conduit Ø25 mm", "m", 2.2),
        ("25", (), "Zolaq polad 4×40 mm (torpaqlama)", "Steel earthing strip 40 × 4 mm", "m", 6.5, {"y_range": (420, 430), "x_range": (935, 1000)}),
    ], "r-wh-el", (955, 1000))
    # Warehouse ventilation, MEP p14
    mep("wh-hv", "WH", "hvac", 14, [("5", ("ədəd",), "Deflektor Ø500", "Roof ventilator (deflector) Ø500", "ədəd", 380)], "r-wh-hv", (720, 745))
    # Warehouse fire water, MEP p20
    mep("wh-fw", "WH", "fire", 20, [
        ("4.0", ("Ø50",), "Polad su borusu Ø50 (ГОСТ 10704-91), S2 yanğın xətti", "Steel water pipe Ø50 (GOST 10704-91), fire main S2", "m", 32),
        ("77.0", ("Ø65",), "Polad su borusu Ø65, S2 yanğın xətti", "Steel water pipe Ø65, fire main S2", "m", 41),
        ("1", ("Ventil",), "Ventil Ø65 (15Б3р)", "Globe valve Ø65 (15B3r)", "ədəd", 145),
        ("4", ("kranı", "dəst"), "Yanğın kranı Ø50, çətənə lifli boru L=20 m ilə", "Fire hose valve Ø50 with 20 m hemp hose", "dəst", 260),
        ("4", ("şkaf",), "Yanğın kranı üçün şkaf", "Fire hose cabinet", "ədəd", 190),
    ], "r-wh-fw", (1035, 1075))
    # Warehouse fire alarm, MEP p25
    alarm_rows = lambda smoke, manual, sounder, cable, base, pipe: [
        ("1", ("nəzarət",), "Ünvanlı yanğın qəbuledici nəzarət cihazı, 4 şleyf", "Addressable fire alarm control panel, 4 loops", "ədəd", 2900),
        ("1", ("Səsli",), "Səsli xəbərverici üçün idarəetmə modulu", "Sounder control module", "ədəd", 110),
        ("1", ("Releli",), "Releli idarəetmə modulu", "Relay control module", "ədəd", 95),
        (smoke, ("Tüstü",), "Tüstü xəbərverici", "Smoke detector", "ədəd", 55),
        (manual, ("Əl-ilə",), "Əl ilə xəbərverici", "Manual call point", "ədəd", 48),
        (sounder, ("İşıq-səs",), "İşıq-səs verən yanğın xəbərvericisi", "Fire alarm sounder beacon", "ədəd", 85),
        ("10", ("Cat6",), "Kabel Cat6 FTP", "Cable Cat6 FTP", "m", 2.4),
        (cable, ("Yanğın", "kabel"), "Yanğın kabeli 2×2×1.5+0.8 JE-H(St)H Bd FE180 PH120", "Fire-resistant cable 2 × 2 × 1.5 + 0.8 JE-H(St)H Bd FE180 PH120", "m", 4.8),
        ("10", ("Naqili",), "PV naqili 1×2.5 mm²", "Wire PV 1 × 2.5 mm²", "m", 1.2),
        ("2", ("Akkumulyator",), "Akkumulyator batareyası 12 V, 7.8 A", "Battery 12 V, 7.8 Ah", "ədəd", 45),
        (base, ("Baza",), "Xəbərverici bazası", "Detector base", "ədəd", 12),
        ("1", ("plata",), "Şəbəkə lövhəsi (plata)", "Network card", "ədəd", 240),
        ("1", ("Fasiləsiz",), "Fasiləsiz qida mənbəyi", "Uninterruptible power supply", "ədəd", 320),
        ("1", ("Universal",), "Universal qutu", "Universal enclosure", "ədəd", 35),
        (pipe, ("Plastik", "Ø30"), "Plastik boru Ø30 mm", "Plastic conduit Ø30 mm", "m", 2.0),
    ]
    mep("wh-fa", "WH", "alarm", 25, alarm_rows("32", "3", "2", "450", "37", "450"), "r-wh-fa", (955, 985))
    # Warehouse CCTV, MEP p66
    mep("wh-cc", "WH", "lowcur", 66, [
        ("3", ("duvar",), "IP videokamera, divar tipli", "IP camera, wall mounted", "ədəd", 340),
        ("2", ("tavan",), "IP videokamera, tavan tipli", "IP camera, ceiling mounted", "ədəd", 310),
        ("1", ("SWITCH",), "Genişləndirmə 12 port (PoE) switch", "PoE switch, 12 ports", "ədəd", 520, {"dy": 7}),
        ("1", ("Videoreqistrator",), "IP videoreqistrator, 12 kanal", "Network video recorder, 12 channels", "ədəd", 640, {"dy": 7}),
        ("1", ("Hard",), "Sərt disk 4 TB", "Hard disk 4 TB", "ədəd", 210),
        ("240", ("Kabel",), "Kabel Cat6a (SFTP)", "Cable Cat6a S/FTP", "m", 3.1),
        ("10", ("PVÇ",), "PVÇ boru d=100 mm", "PVC duct d = 100 mm", "m", 6.5),
        ("10", ("Kronşteyn",), "Kronşteyn", "Camera bracket", "ədəd", 22),
        ("1", ("Qoruyucu",), "Qoruyucu örtük", "Protective housing", "ədəd", 60),
        ("240", ("HF",), "HF tipli odadavamlı boru PVX-25 mm", "Halogen-free conduit 25 mm", "m", 2.6),
        ("5", ("Hirmetiq",), "Hermetik qutu", "Sealed junction box", "ədəd", 18),
        ("1", ("Monitor",), "Monitor 32\"", "Monitor 32 in", "ədəd", 480),
    ], "r-wh-cc", (530, 555))

    # Pump station electrical, MEP p33
    mep("ps-el", "PS", "elec", 33, [
        ("1", ("PLN",), "Metal şkaf 600×500×125 mm, Siemens avtomatları ilə (PLN)", "Panel PLN, steel enclosure 600 × 500 × 125 mm with Siemens breakers", "komp", 1850),
        ("1", ("Wh",), "Elektrik sayğacı 40 A", "Electricity meter 40 A", "ədəd", 160),
        ("60", ("(1х2,5)мм²",), "PV mis naqil 1×2.5 mm²", "Copper wire PV 1 × 2.5 mm²", "m", 1.2),
        ("60", ("(1х4)мм²",), "PV mis naqil 1×4 mm²", "Copper wire PV 1 × 4 mm²", "m", 1.8),
        ("3", ("Budaqlanma",), "Budaqlanma qutusu", "Junction box", "ədəd", 6, {"y_range": (0, 999), "dy": 4}),
        ("10", ("25х4мм",), "Polad zolaq 25×4 mm", "Steel strip 25 × 4 mm", "m", 5.0),
        ("15", ("40х4мм",), "Polad zolaq 40×4 mm", "Steel strip 40 × 4 mm", "m", 6.5),
        ("3", ("Elektrod",), "Elektrod Ф16 mm, L=5 m", "Earth electrode Ø16 mm, L = 5 m", "ədəd", 38),
        ("60", ("ВВГ",), "ВВГ mis kabel 3×2.5 mm²", "Copper cable VVG 3 × 2.5 mm²", "m", 4.2),
        ("50", ("5х2,5",), "ВВГ mis kabel 5×2.5 mm²", "Copper cable VVG 5 × 2.5 mm²", "m", 6.4),
        ("60", ("P20",), "Plastmas boru P20", "Plastic conduit 20 mm", "m", 1.8),
        ("50", ("P25",), "Plastmas boru P25", "Plastic conduit 25 mm", "m", 2.2),
        ("6", ("Közərmə",), "Közərmə lampalı çıraq НПП05-100 Vt", "Bulkhead luminaire НПП05, 100 W", "ədəd", 38),
        ("1", ("PBO-36",), "Çıraq PBO-36, 60 Vt", "Luminaire PBO-36, 60 W", "ədəd", 42),
        ("1", ("ЯТП-025",), "Alçaldıcı transformator ЯТП-025 220/36 V", "Step-down transformer ЯТП-025, 220/36 V", "ədəd", 120),
        ("4", ("Mühafizə",), "Bir qütblü açar, bir səmtli, IP44", "Single-pole switch, IP44", "ədəd", 11),
    ], "r-ps-el", (480, 500))
    # Pump station water, MEP p39
    mep("ps-w", "PS", "plumb", 39, [
        ("8.0", ("Ø32",), "Polad su borusu Ø32 (ГОСТ 3262-75)", "Steel water pipe Ø32 (GOST 3262-75)", "m", 24),
        ("12.0", ("Ø65",), "Polad su borusu Ø65", "Steel water pipe Ø65", "m", 41),
        ("22.0", ("Ø80",), "Polad su borusu Ø80", "Steel water pipe Ø80", "m", 52),
        ("4", ("Siyirtmə",), "Siyirtmə Ø80 (30ч6бр)", "Gate valve Ø80 (30ch6br)", "ədəd", 210),
        ("2", ("Ventil", "Ø65"), "Ventil Ø65 (15Б3р)", "Globe valve Ø65", "ədəd", 145),
        ("3", ("Əks", "Ø65"), "Əks klapan Ø65", "Check valve Ø65", "ədəd", 130),
        ("2", ("Wilo",), "Təsərrüfat-içməli və yanğın su nasosu Wilo Multivert MVI 1605-6/PN16 (1 işlək, 1 ehtiyat)", "Domestic and fire pump Wilo Multivert MVI 1605-6/PN16 (duty and standby)", "ədəd", 6800, {"dy": 7}),
        ("1", ("Drenaj", "nasosu"), "Drenaj nasosu Wilo TS40/10, Q=3.0 m³/saat, H=8.0 m, N=0.60 kVt", "Drainage pump Wilo TS40/10, Q = 3.0 m³/h, H = 8.0 m, 0.60 kW", "ədəd", 950, {"dy": 7}),
        ("2", ("Ventil", "Ø32"), "Ventil Ø32", "Globe valve Ø32", "ədəd", 62),
        ("1", ("Əks", "Ø32"), "Əks klapan Ø32", "Check valve Ø32", "ədəd", 55),
        ("1", ("çala",), "Drenaj üçün çala 500×500×500 (h)", "Drainage sump 500 × 500 × 500 mm", "ədəd", 140),
    ], "r-ps-w", (1040, 1070))

    # Admin electrical, MEP p48
    mep("ad-el", "AD", "elec", 48, [
        ("1", ("komp.",), "BPL lövhəsi: yanmaya və partlayışa davamlı şkaf 420×650×200 mm; MCCB 3P C40A, RCBO C16A 30mA – 3, MCB 3P C63A – 3, MCB 1P B10A – 4, C16A – 7, C32A – 1, paket çevirgəc 40A, sayğac 5A 380V, CT-20 40/5A – 3", "Distribution board BPL, flameproof enclosure 420 × 650 × 200 mm, with MCCB 3P C40 A, 3 × RCBO C16 A 30 mA, 3 × MCB 3P C63 A, 4 × B10 A, 7 × C16 A, 1 × C32 A, 40 A changeover switch, 5 A meter, 3 × CT-20 40/5 A", "komp", 2400),
        ("28", ("2x36",), "LED çıraq 2×36 Vt, IP20", "LED luminaire 2 × 36 W, IP20", "ədəd", 68),
        ("1", ("plafon",), "LED plafon 15 Vt, IP66", "LED bulkhead 15 W, IP66", "ədəd", 34),
        ("12", ("spot",), "LED spot 10 Vt, IP65", "LED downlight 10 W, IP65", "ədəd", 22),
        ("1", ("(çıxış)",), "\"Çıxış\" göstəricisi 1×24 Vt, akkumulyatorlu (çıxış)", "Exit sign 1 × 24 W with battery (exit)", "ədəd", 65),
        ("1", ("sol)",), "\"Çıxış\" göstəricisi 1×24 Vt, akkumulyatorlu (sağ, sol)", "Exit sign 1 × 24 W with battery (left, right)", "ədəd", 65),
        ("3", ("saatlıq",), "3 saatlıq enerji təchizatı bloku", "3-hour emergency power pack", "ədəd", 55),
        ("2", ("açarı,", "bir"), "Elektrik açarı, bir qütblü bir səmtli 6 A, 220 V", "Light switch, one-gang 6 A, 220 V", "ədəd", 9, {"x_range": (1045, 1070)}),
        ("7", ("açarı,iki",), "Elektrik açarı, iki qütblü iki səmtli 6 A, 220 V", "Light switch, two-gang 6 A, 220 V", "ədəd", 12, {"x_range": (1045, 1070)}),
        ("12", ("olan)",), "Ştepsel rozetka 1 gözlü 16 A, 220 V (yerləbirləşdirməli)", "Socket outlet 16 A, 220 V, earthed", "ədəd", 14, {"y_range": (180, 190), "x_range": (1045, 1070)}),
        ("1", ("olan)",), "Ştepsel rozetka 1 gözlü 25 A, 220 V (yerləbirləşdirməli)", "Socket outlet 25 A, 220 V, earthed", "ədəd", 22, {"y_range": (215, 228), "x_range": (1045, 1070)}),
        ("21", ("qutu", "Açar"), "Açar və rozetkalar üçün qutu", "Back box for switches and sockets", "ədəd", 2.5, {"x_range": (1045, 1070)}),
        ("21", ("Budaqlanma",), "Budaqlanma qutusu", "Junction box", "ədəd", 6, {"x_range": (1045, 1070)}),
        ("3", ("elektrod",), "Sinklənmiş dairəvi polad (elektrod) Ø16 mm", "Galvanised round steel earth electrode Ø16 mm", "ədəd", 38, {"x_range": (1045, 1070)}),
        ("30", ("zolaq",), "Sinklənmiş polad zolaq 40×4 mm", "Galvanised steel strip 40 × 4 mm", "m", 6.5, {"x_range": (1045, 1070)}),
        ("1", ("Sıxac",), "Sıxac", "Earthing clamp", "ədəd", 8, {"x_range": (1045, 1070)}),
        ("1", ("Torpaqlanma", "qutusu"), "Torpaqlama qutusu", "Earthing test box", "ədəd", 30, {"x_range": (1045, 1070)}),
    ], "r-ad-el", (455, 480))
    # Admin HVAC, MEP p56
    mep("ad-hv", "AD", "hvac", 56, [
        ("1", ("HV-1",), "HV-1 vurucu ventilyator prio 200E2, Lv=600 m³/saat, H=150 Pa", "Supply fan HV-1 prio 200E2, 600 m³/h, 150 Pa", "ədəd", 780),
        ("1", ("HS-1",), "HS-1 sorucu ventilyator prio 200E2, Ls=600 m³/saat, H=150 Pa", "Extract fan HS-1 prio 200E2, 600 m³/h, 150 Pa", "ədəd", 780),
        ("1", ("HS-2",), "HS-2 sorucu ventilyator K 150 M Sileo, Ls=400 m³/saat", "Extract fan HS-2 K 150 M Sileo, 400 m³/h", "ədəd", 420),
        ("7", ("150x150", "d=0.5mm"), "Sinklənmiş polad hava kəməri 150×150, d=0.5 mm, İzocam izolyasiyalı 13 mm", "Galvanised steel duct 150 × 150 × 0.5 mm, insulated 13 mm", "m", 38, {"y_range": (175, 186)}),
        ("15", ("200x150",), "Hava kəməri 200×150, d=0.5 mm, izolyasiyalı", "Duct 200 × 150 × 0.5 mm, insulated", "m", 42, {"y_range": (195, 206)}),
        ("5", ("250x150",), "Hava kəməri 250×150, d=0.6 mm, izolyasiyalı", "Duct 250 × 150 × 0.6 mm, insulated", "m", 48, {"y_range": (215, 226)}),
        ("3", ("300x150",), "Hava kəməri 300×150, d=0.6 mm, izolyasiyalı", "Duct 300 × 150 × 0.6 mm, insulated", "m", 54, {"y_range": (231, 242)}),
        ("7", ("150x150", "d=0.5mm"), "Sinklənmiş polad hava kəməri 150×150, d=0.5 mm, izolyasiyasız", "Galvanised steel duct 150 × 150 × 0.5 mm, uninsulated", "m", 28, {"y_range": (269, 280)}),
        ("15", ("200x150",), "Hava kəməri 200×150, d=0.5 mm, izolyasiyasız", "Duct 200 × 150 × 0.5 mm, uninsulated", "m", 31, {"y_range": (287, 298)}),
        ("5", ("250x150",), "Hava kəməri 250×150, d=0.6 mm, izolyasiyasız", "Duct 250 × 150 × 0.6 mm, uninsulated", "m", 35, {"y_range": (307, 318)}),
        ("3", ("300x150",), "Hava kəməri 300×150, d=0.6 mm, izolyasiyasız", "Duct 300 × 150 × 0.6 mm, uninsulated", "m", 40, {"y_range": (325, 336)}),
        ("4", ("150x150",), "Mənfəz, cüt sıra 150×150", "Double-deflection grille 150 × 150", "ədəd", 24, {"y_range": (362, 373)}),
        ("2", ("250x250",), "Mənfəz, cüt sıra 250×250", "Double-deflection grille 250 × 250", "ədəd", 32),
        ("1", ("qızdırıcı",), "Elektrikli qızdırıcı 4.8 kVt", "Electric duct heater 4.8 kW", "ədəd", 420),
        ("1", ("Səs",), "Səs boğucu L=0.5 m", "Duct silencer L = 0.5 m", "ədəd", 160),
        ("4", ("Anemostat",), "Anemostat Ø125", "Ceiling diffuser Ø125", "ədəd", 28),
        ("2", ("Panjur(jalüz)",), "Panjur (jalüz) 300×150", "External louvre 300 × 150", "ədəd", 36),
        ("2", ("MDOA-09HFN1(Nel=0.86",), "Kondisioner xarici blok MDOA-09HFN1 (0.86 kVt)", "Split AC outdoor unit MDOA-09HFN1 (0.86 kW)", "ədəd", 640),
        ("1", ("MDOA-18HFN1(Nel=1.6",), "Kondisioner xarici blok MDOA-18HFN1 (1.6 kVt)", "Split AC outdoor unit MDOA-18HFN1 (1.6 kW)", "ədəd", 980),
        ("2", ("MDSA-09HRFN1(Nel=0.86",), "Kondisioner daxili blok MDSA-09HRFN1 (0.86 kVt)", "Split AC indoor unit MDSA-09HRFN1 (0.86 kW)", "ədəd", 360),
        ("1", ("MDSA-18HRFN1(Nel=1.6",), "Kondisioner daxili blok MDSA-18HRFN1 (1.6 kVt)", "Split AC indoor unit MDSA-18HRFN1 (1.6 kW)", "ədəd", 520),
        ("10", ("Ø6.35",), "Mis boru Ø6.35", "Copper refrigerant pipe Ø6.35", "m", 9),
        ("5", ("Ø9.52",), "Mis boru Ø9.52", "Copper refrigerant pipe Ø9.52", "m", 12),
        ("4", ("Ø12.7",), "Mis boru Ø12.7", "Copper refrigerant pipe Ø12.7", "m", 15),
    ], "r-ad-hv", (510, 530))
    mep("ad-fa", "AD", "alarm", 61, alarm_rows("14", "1", "1", "150", "16", "150"), "r-ad-fa", (955, 985))
    # Admin LAN and CCTV, MEP p72
    mep("ad-lan", "AD", "lowcur", 72, [
        ("1", ("Router",), "Router", "Router", "ədəd", 260, {"x_range": (540, 560)}),
        ("3", ("telefon",), "IP telefon aparatı", "IP telephone", "ədəd", 120),
        ("1", ("Gənişləndirmə", "24"), "Genişləndirmə 24 port (PoE) switch", "PoE switch, 24 ports", "ədəd", 780),
        ("1", ("Patch",), "Patch panel 24 port", "Patch panel, 24 ports", "ədəd", 95, {"x_range": (540, 560)}),
        ("12", ("RJ-45",), "Rozetka RJ-45", "Data outlet RJ-45", "ədəd", 14),
        ("280", ("FTP",), "Kabel FTP Cat6a (SFTP)", "Cable Cat6a S/FTP", "m", 3.1),
        ("30", ("FO-8",), "Optik kabel FO-8", "Fibre optic cable FO-8", "m", 4.5),
        ("280", ("HF", "PVX-"), "HF tipli odadavamlı boru PVX-25 mm", "Halogen-free conduit 25 mm", "m", 2.6, {"x_range": (540, 560)}),
        ("1", ("kabinet",), "Rack kabinet, döşəmə tipli 600×600×1196, 19\" 22U", "Floor-standing rack 600 × 600 × 1196 mm, 19 in 22U", "ədəd", 650),
        ("1", ("Rəf",), "Rəf 19\" 1U", "Rack shelf 19 in 1U", "ədəd", 35),
        ("1", ("rozetka", "bloku"), "Elektrik rozetka bloku 19\", 1U, 9 rozetka", "Rack power strip 19 in 1U, 9 outlets", "ədəd", 70),
        ("1", ("Ventilyator",), "Ventilyator bloku DG-Rack 19\" 1U", "Rack fan unit 19 in 1U", "ədəd", 90),
        ("30", ("PVÇ", "d=50mm"), "PVÇ boru d=50 mm", "PVC duct d = 50 mm", "m", 4.0),
        ("1", ("Ötürücü",), "Ötürücü (transceiver)", "Fibre transceiver", "ədəd", 60),
        ("1", ("Access",), "Access Point (Wi-Fi), 25 m radius", "Wi-Fi access point, 25 m range", "ədəd", 180),
        ("1", ("duvar",), "IP videokamera, divar tipli", "IP camera, wall mounted", "ədəd", 340, {"x_range": (1130, 1145)}),
        ("3", ("tavan",), "IP videokamera, tavan tipli", "IP camera, ceiling mounted", "ədəd", 310, {"x_range": (1130, 1145)}),
        ("1", ("Gənişləndirmə", "12"), "Genişləndirmə 12 port (PoE) switch", "PoE switch, 12 ports", "ədəd", 520, {"x_range": (1130, 1145)}),
        ("1", ("Videoreqistrator",), "IP videoreqistrator, 12 kanal", "Network video recorder, 12 channels", "ədəd", 640, {"x_range": (1130, 1145), "dy": 7}),
        ("1", ("Hard",), "Sərt disk 4 TB", "Hard disk 4 TB", "ədəd", 210, {"x_range": (1130, 1145)}),
        ("240", ("Kabel", "Cat6a"), "Kabel Cat6a (SFTP)", "Cable Cat6a S/FTP", "m", 3.1, {"x_range": (1130, 1145)}),
        ("10", ("d=100mm",), "PVÇ boru d=100 mm", "PVC duct d = 100 mm", "m", 6.5, {"x_range": (1130, 1145)}),
        ("40", ("Kronşteyn",), "Kronşteyn", "Camera bracket", "ədəd", 22, {"x_range": (1130, 1145)}),
        ("1", ("Qoruyucu",), "Qoruyucu örtük", "Protective housing", "ədəd", 60, {"x_range": (1130, 1145)}),
        ("240", ("HF", "PVX-"), "HF tipli odadavamlı boru PVX-25 mm", "Halogen-free conduit 25 mm", "m", 2.6, {"x_range": (1130, 1145)}),
        ("4", ("Hirmetiq",), "Hermetik qutu", "Sealed junction box", "ədəd", 18, {"x_range": (1130, 1145)}),
        ("1", ("Monitor",), "Monitor 32\"", "Monitor 32 in", "ədəd", 480, {"x_range": (1130, 1145)}),
        ("1", ("Kompyuter",), "Kompyuter", "Workstation computer", "ədəd", 950, {"x_range": (1130, 1145)}),
    ], "r-ad-lan", (540, 560))
    # Admin water and drainage, MEP p80–81
    mep("ad-w", "AD", "plumb", 80, [
        ("20.0", ("PP",), "Soyuq su: təzyiqli polipropilen boru (PP) dxar=20 mm", "Cold water: PP pressure pipe, 20 mm OD", "m", 6.5, {"y_range": (160, 175)}),
        ("22.0", ("ddax", "20"), "Soyuq su: PP boru dxar=25 mm", "Cold water: PP pressure pipe, 25 mm OD", "m", 8.0, {"y_range": (180, 200)}),
        ("4", ("Ø15",), "Ventil Ø15 (15Б3р)", "Globe valve Ø15", "ədəd", 18),
        ("2", ("Ventil", "Ø20"), "Ventil Ø20", "Globe valve Ø20", "ədəd", 22, {"y_range": (230, 240)}),
        ("20.0", ("PP",), "İsti su: PP boru dxar=20 mm", "Hot water: PP pressure pipe, 20 mm OD", "m", 6.5, {"y_range": (315, 330)}),
        ("6.0", ("ddax", "20"), "İsti su: PP boru dxar=25 mm", "Hot water: PP pressure pipe, 25 mm OD", "m", 8.0, {"y_range": (335, 355)}),
        ("1", ("Ventil", "Ø20"), "Ventil Ø20 (isti su)", "Globe valve Ø20 (hot water)", "ədəd", 22, {"y_range": (360, 370)}),
        ("2", ("yuyan",), "Əl-üz yuyan üçün qarışdırıcı", "Basin mixer tap", "ədəd", 85),
        ("4", ("Duş",), "Duş tapança (avtafa) üçün qarışdırıcı", "Hygiene shower mixer", "ədəd", 70),
        ("1", ("Ariston",), "Elektrik su qızdırıcısı Ariston V=50 l", "Electric water heater Ariston 50 l", "ədəd", 290),
    ], "r-ad-w", (1040, 1070))
    mep("ad-s", "AD", "plumb", 81, [
        ("20.0", ("110",), "Təzyiqsiz PVC kanalizasiya borusu dxar=110 mm", "PVC soil pipe 110 mm OD", "m", 11),
        ("6.0", ("dxar", "50"), "PVC kanalizasiya borusu dxar=50 mm", "PVC waste pipe 50 mm OD", "m", 6),
        ("1", ("yoxlayıcı",), "Plastik yoxlayıcı Ø100", "Cleaning eye Ø100", "ədəd", 14),
        ("2", ("Keramik", "yuyan"), "Keramik əl-üz yuyan", "Ceramic wash basin", "dəst", 160),
        ("4", ("unitaz",), "Keramik unitaz, yuma çəni ilə", "Ceramic WC with cistern", "dəst", 240),
    ], "r-ad-s", (1040, 1070))
    # Admin public address, MEP p86
    mep("ad-pa", "AD", "pa", 86, [
        ("1", ("İdarəetmə",), "İdarəetmə modulu", "Control module", "ədəd", 420),
        ("1", ("2", "Modul"), "Modul", "Module", "ədəd", 180, {"y_range": (120, 135)}),
        ("1", ("yazılması",), "Məlumatların yazılması modulu", "Message recording module", "ədəd", 260),
        ("1", ("Nəzarət",), "Nəzarət bloku", "Supervision unit", "ədəd", 310),
        ("1", ("Qəza",), "Qəza qida mənbəyi", "Emergency power supply", "ədəd", 280),
        ("1", ("qutusu",), "Qida mənbəyinin qutusu", "Power supply enclosure", "ədəd", 60),
        ("1", ("7", "Qida"), "Qida mənbəyi", "Power supply", "ədəd", 150, {"y_range": (200, 212)}),
        ("1", ("artırıcısı",), "Siqnal gücləndiricisi 100 Vt", "Amplifier 100 W", "ədəd", 520),
        ("3", ("6",), "Tavan tipli səsucaldıcı 6 Vt", "Ceiling loudspeaker 6 W", "ədəd", 48, {"y_range": (235, 245)}),
        ("4", ("3",), "Tavan tipli səsucaldıcı 3 Vt", "Ceiling loudspeaker 3 W", "ədəd", 42, {"y_range": (250, 260)}),
        ("1", ("100A/S",), "Akkumulyator 12 V 100 A·s", "Battery 12 V 100 Ah", "ədəd", 330),
        ("150", ("Radiotranslyasiya",), "Radiotranslyasiya naqili LİHCH 2×1.5", "Loudspeaker cable LIHCH 2 × 1.5", "m", 1.9),
        ("1", ("13", "Mikrofon"), "Mikrofon", "Paging microphone", "ədəd", 190, {"y_range": (298, 310)}),
        ("1", ("genişləndirici",), "Mikrofon üçün genişləndirici", "Microphone extension unit", "ədəd", 140),
        ("1", ("15", "Modul"), "Modul", "Module", "ədəd", 180, {"y_range": (330, 340)}),
        ("150", ("HF",), "HF tipli odadavamlı boru PVX-25 mm", "Halogen-free conduit 25 mm", "m", 2.6),
    ], "r-ad-pa", (955, 980))
    # Water tanks 5 and 6, MEP p93 and p100
    for tank, page in (("5", 93), ("6", 100)):
        mep(f"tk{tank}", "TK", "plumb", page, [
            ("5.0", ("Ø50",), f"Su anbarı ({tank}): elektrik qaynaqlı polad boru Ø50 (ГОСТ 10704-91)", f"Tank {tank}: welded steel pipe Ø50 (GOST 10704-91)", "m", 32),
            ("5.0", ("Ø80",), f"Su anbarı ({tank}): polad boru Ø80", f"Tank {tank}: steel pipe Ø80", "m", 52),
            ("5.0", ("Ø100",), f"Su anbarı ({tank}): polad boru Ø100", f"Tank {tank}: steel pipe Ø100", "m", 64),
            ("5.0", ("Ø200",), f"Su anbarı ({tank}): polad boru Ø200", f"Tank {tank}: steel pipe Ø200", "m", 118),
            ("1", ("Üzgəc",), f"Su anbarı ({tank}): üzgəcli klapan Ø50", f"Tank {tank}: float valve Ø50", "ədəd", 160),
            ("1", ("Salnik", "Ø50"), f"Su anbarı ({tank}): salnik Ø50, L=200", f"Tank {tank}: wall sleeve Ø50, L = 200 mm", "ədəd", 45),
            ("1", ("Salnik", "Ø80"), f"Su anbarı ({tank}): salnik Ø80, L=200", f"Tank {tank}: wall sleeve Ø80, L = 200 mm", "ədəd", 55),
            ("1", ("Salnik", "Ø100"), f"Su anbarı ({tank}): salnik Ø100, L=200", f"Tank {tank}: wall sleeve Ø100, L = 200 mm", "ədəd", 65),
            ("1", ("Salnik", "Ø200"), f"Su anbarı ({tank}): salnik Ø200, L=200", f"Tank {tank}: wall sleeve Ø200, L = 200 mm", "ədəd", 95),
        ], f"r-tk{tank}", (1040, 1070))


def build_site():
    rows = [
        (1, "lawn", "Qazon örtüyü (hazır rulon tipli)", "Turf, pre-grown rolls", "m²", 2532.3, "lawn"),
        (3, "paving", "Səki daşı (tamet materialından) 80 mm", "Concrete block paving (tamet) 80 mm", "m²", 404.0, "paving"),
        (4, "kerb", "Bordyur daşı h=300 mm", "Kerb, 300 mm high", "m", 804.0, "kerb"),
        (5, "gravel", "Çınqıl qatı 200 mm (yol, səki və yaşıllıq altında)", "Gravel sub-base 200 mm under roads, paving and lawn", "m³", 1697.06, "gravel"),
        (6, "asph-coarse", "İri dənəli asfaltbeton 60 mm", "Coarse asphalt concrete 60 mm", "m³", 332.94, "asphalt_coarse"),
        (7, "asph-fine", "Xırda dənəli asfaltbeton 40 mm", "Fine asphalt concrete wearing course 40 mm", "m³", 221.96, "asphalt_fine"),
        (8, "carb", "Karbonat qatı 100 mm (yol altında)", "Carbonate base 100 mm under roads", "m³", 554.9, "fill_carbonate"),
        (9, "topsoil", "Qara torpaq 300 mm", "Topsoil 300 mm", "m³", 759.69, "topsoil"),
        (10, "screed", "Sement-qum məhlulu (quru qarışıq) 100 mm, səki altında", "Dry cement-sand bed 100 mm under paving", "m³", 40.4, "sand_cement"),
    ]
    for n, key, az, en, unit, qty, rate in rows:
        cy = 30 + (210 + (n - 1) * 66.7) * 0.547
        item(f"site-{key}", "SITE", "ext", az, en, unit, qty,
             [M("BP", 8, [92, cy - 17, 604, cy + 17], f"{n}. {az} — {qty}", str(qty))], method="image", rate=rate)


# --------------------------------------------------------------------------- rates (sample, not from the package)

RATES = {
    "conc_fdn": {"unit": "m³", "rate": 172.0, "en": "Concrete B25 in foundations, all-in with formwork", "group": "Concrete"},
    "conc_slab_grd": {"unit": "m³", "rate": 138.0, "en": "Concrete B15 in ground slab, placed and finished", "group": "Concrete"},
    "conc_blind": {"unit": "m³", "rate": 108.0, "en": "Concrete B7.5 blinding", "group": "Concrete"},
    "conc_col": {"unit": "m³", "rate": 268.0, "en": "Concrete B25 in columns, all-in with formwork", "group": "Concrete"},
    "conc_beam": {"unit": "m³", "rate": 246.0, "en": "Concrete B25 in beams, all-in with formwork", "group": "Concrete"},
    "conc_slab": {"unit": "m³", "rate": 214.0, "en": "Concrete B25 in suspended slab, all-in with formwork", "group": "Concrete"},
    "rebar_a500": {"unit": "kg", "rate": 1.92, "en": "Rebar A500C, cut, bent and fixed", "group": "Reinforcement"},
    "rebar_ai": {"unit": "kg", "rate": 2.04, "en": "Rebar A-I (A240), cut, bent and fixed", "group": "Reinforcement"},
    "steel_struct": {"unit": "kg", "rate": 4.65, "en": "Structural steel, fabricated, primed and erected", "group": "Steel"},
    "steel_embed": {"unit": "kg", "rate": 4.10, "en": "Embedded steel parts and anchors", "group": "Steel"},
    "crushed_stone": {"unit": "m³", "rate": 38.0, "en": "Crushed stone layer, laid and compacted", "group": "Earthworks and bases"},
    "fill_carbonate": {"unit": "m³", "rate": 27.5, "en": "Carbonate fill, laid and compacted in layers", "group": "Earthworks and bases"},
    "wall_limestone": {"unit": "m²", "rate": 47.0, "en": "Sawn limestone wall 400 mm in cement mortar", "group": "Masonry"},
    "wall_brick200": {"unit": "m²", "rate": 33.0, "en": "Hollow brick partition 200 mm", "group": "Masonry"},
    "wall_brick50": {"unit": "m²", "rate": 17.5, "en": "Brick partition 50 mm", "group": "Masonry"},
    "int_paint": {"unit": "m²", "rate": 11.8, "en": "Internal plaster, skim and three coats of paint", "group": "Finishes"},
    "facade_paint": {"unit": "m²", "rate": 15.6, "en": "External render and three coats of facade paint", "group": "Finishes"},
    "polished_conc": {"unit": "m²", "rate": 14.2, "en": "Polished concrete topping 50 mm", "group": "Finishes"},
    "floor_porcelain": {"unit": "m²", "rate": 41.0, "en": "Porcelain granite on adhesive and screed", "group": "Finishes"},
    "floor_laminate": {"unit": "m²", "rate": 39.5, "en": "Laminate on plywood and battens with screed", "group": "Finishes"},
    "floor_tile": {"unit": "m²", "rate": 29.0, "en": "Ceramic floor tile on screed", "group": "Finishes"},
    "ceil_gypsum": {"unit": "m²", "rate": 25.5, "en": "Plasterboard ceiling, skimmed and painted", "group": "Finishes"},
    "ceil_metal": {"unit": "m²", "rate": 22.0, "en": "Metal suspended ceiling", "group": "Finishes"},
    "wall_wallpaper": {"unit": "m²", "rate": 14.6, "en": "Plaster, skim, paintable wallpaper, three coats", "group": "Finishes"},
    "wall_tile": {"unit": "m²", "rate": 27.5, "en": "Plaster and ceramic wall tile", "group": "Finishes"},
    "roof_sheet": {"unit": "m²", "rate": 17.2, "en": "Profiled metal roof sheeting, fixed", "group": "Roofing"},
    "timber_roof": {"unit": "m³", "rate": 540.0, "en": "Timber roof members, treated and fixed", "group": "Roofing"},
    "flashing": {"unit": "m", "rate": 13.5, "en": "Metal eaves flashing", "group": "Roofing"},
    "gutter": {"unit": "m", "rate": 15.5, "en": "Gutter Ø100", "group": "Roofing"},
    "downpipe": {"unit": "m", "rate": 13.8, "en": "Downpipe Ø100", "group": "Roofing"},
    "rain_elbow": {"unit": "ədəd", "rate": 7.0, "en": "Downpipe elbow", "group": "Roofing"},
    "rain_funnel": {"unit": "ədəd", "rate": 18.0, "en": "Rainwater outlet funnel", "group": "Roofing"},
    "rain_clamp": {"unit": "ədəd", "rate": 2.6, "en": "Downpipe clamp", "group": "Roofing"},
    "door_roller": {"unit": "m²", "rate": 142.0, "en": "Sealed roller shutter door", "group": "Doors and windows"},
    "window_pvc": {"unit": "m²", "rate": 118.0, "en": "PVC window, double glazed", "group": "Doors and windows"},
    "door_mdf": {"unit": "m²", "rate": 188.0, "en": "MDF internal door with frame and ironmongery", "group": "Doors and windows"},
    "door_pvc": {"unit": "m²", "rate": 152.0, "en": "PVC door with frame", "group": "Doors and windows"},
    "door_alu": {"unit": "m²", "rate": 212.0, "en": "Aluminium entrance door and screen", "group": "Doors and windows"},
    "lawn": {"unit": "m²", "rate": 7.4, "en": "Turf rolls, laid", "group": "External works"},
    "paving": {"unit": "m²", "rate": 31.5, "en": "Concrete block paving 80 mm", "group": "External works"},
    "kerb": {"unit": "m", "rate": 17.8, "en": "Precast kerb, bedded", "group": "External works"},
    "gravel": {"unit": "m³", "rate": 31.0, "en": "Gravel sub-base, compacted", "group": "External works"},
    "asphalt_coarse": {"unit": "m³", "rate": 205.0, "en": "Coarse asphalt concrete, laid and rolled", "group": "External works"},
    "asphalt_fine": {"unit": "m³", "rate": 228.0, "en": "Fine asphalt concrete, laid and rolled", "group": "External works"},
    "topsoil": {"unit": "m³", "rate": 15.5, "en": "Topsoil, spread and levelled", "group": "External works"},
    "sand_cement": {"unit": "m³", "rate": 74.0, "en": "Dry cement-sand bed", "group": "External works"},
}

# BOQ lines that combine several takeoff items
LINE_GROUPS = {
    "wh-cols": ("Monolit d/b sütunlar Ms-1…Ms-4 (400×500), 31 ədəd, beton B25", "RC columns Ms-1 to Ms-4 (400 × 500 mm), 31 no., concrete B25"),
    "wh-beams": ("Monolit d/b rigellər MR-1, MR-2, MR-3 (400×500), 7 ədəd, beton B25", "RC beams MR-1, MR-2, MR-3 (400 × 500 mm), 7 no., concrete B25"),
    "wh-facade": ("Fasadlar: sement-qum suvaq və 3 qat fasad boyası (4 fasad)", "Elevations: cement-sand render and three coats of facade paint (4 elevations)"),
    "ad-beams": ("Monolit d/b rigellər MR-1, MR-2, 9 ədəd, beton B25", "RC beams MR-1 and MR-2, 9 no., concrete B25"),
    "ad-facade": ("Fasadlar: sement-qum suvaq və 3 qat fasad boyası", "Elevations: render and three coats of facade paint"),
}

# --------------------------------------------------------------------------- checks


def build_checks():
    checks = [
        {"id": "C-01", "kind": "arithmetic", "severity": "error", "building": "WH",
         "title": "Bracing Şr-2 profile total is overstated by 400 kg",
         "detail": "Each row of the Şr-2 schedule prints a total of 404.40 kg, but 4 × 51.10 kg and 8 × 25.55 kg both give 204.40 kg. The schedule total of 808.80 kg should be 408.80 kg. Şr-1 on the previous sheet uses the same layout and adds up correctly.",
         "expected": 408.80, "printed": 808.80, "unit": "kg",
         "sources": [L("KS", 33, "404.40", "5740"), L("KS", 33, "404.40", "2870"), L("KS", 33, "808.80"), L("KS", 32, "402.28")],
         "items": ["wh-sr2"], "fix": {"item": "wh-sr2", "qty": round(408.80 + 140.6, 2), "label": "Use 408.80 kg + 140.6 kg = 549.40 kg"}},
        {"id": "C-02", "kind": "conflict", "severity": "warn", "building": "WH",
         "title": "Warehouse slab area differs between structure and architecture",
         "detail": "The structural schedule measures the ground slab at 1,109.10 m² (166.37 m³ at 150 mm). The architectural floor build-up uses the room area of 1,122 m², which gives 168.3 m³ of slab and 561 m³ of carbonate. The bill takes concrete from the structural sheet and the floor finish from the architectural sheet.",
         "sources": [L("KS", 11, "1109.10"), L("KS", 11, "166.37", "Beton"), M("AR", 18, [284, 384, 500, 420], "D1: Cilalanmış beton 56.1, Döşəmə qatı 168.3, Beton hazırlıq 112.2, Qırmadaş 112.2, Karbonat 561"), M("AR", 10, [81, 775, 465, 800], "Anbar sahəsi 1 122 m²")],
         "items": ["wh-slab", "wh-blind", "wh-stone", "wh-carb", "wh-floor"]},
        {"id": "C-03", "kind": "conflict", "severity": "warn", "building": "AD",
         "title": "Admin ground slab is 100 mm on the structure and 150 mm on the architecture",
         "detail": "Structural sheet KS-49 specifies a 100 mm slab with 18.1 m³ of B15. The architectural finish schedule lists a 150 mm reinforced concrete slab under every floor type: 10.84 + 12.43 + 2.23 = 25.50 m³. The bill uses the structural value until the designer confirms.",
         "sources": [L("KS", 49, "18.1", "BETON"), L("AR", 35, "10.84"), L("AR", 35, "12.43"), L("AR", 35, "2.23")],
         "items": ["ad-slab"]},
        {"id": "C-04", "kind": "arithmetic", "severity": "info", "building": "AD",
         "title": "Beam MR-2 volume is rounded up",
         "detail": "One MR-2 beam is 0.84 m³ and there are six, which gives 5.04 m³. The schedule prints 5.1 m³.",
         "expected": 5.04, "printed": 5.1, "unit": "m³",
         "sources": [L("KS", 54, "0.84"), L("KS", 54, "5.1", "RİGEL")], "items": ["ad-mr2"],
         "fix": {"item": "ad-mr2", "qty": 5.04, "label": "Use 6 × 0.84 = 5.04 m³"}},
        {"id": "C-05", "kind": "missing", "severity": "warn", "building": "WH",
         "title": "Electricity meter has no quantity",
         "detail": "Row 4 of the warehouse electrical schedule lists a 380 V, 3 × 25 A meter with the quantity cell left empty. The bill leaves it out until a count is given.",
         "sources": [L("MEP", 7, "3x25A", "Sayğac")], "items": []},
        {"id": "C-06", "kind": "arithmetic", "severity": "info", "building": "WH",
         "title": "Earthing material weights do not match their lengths",
         "detail": "A 40 × 4 mm strip weighs 1.256 kg/m. Row 14 (25 m, 32 kg) is consistent, but row 16 prints 20 m and 15 kg, where 20 m weighs 25.1 kg. Row 15 prints 3 m of Ø16 round bar at 36 kg; at 1.58 kg/m that is 4.7 kg. The bill measures earthing by length.",
         "sources": [L("MEP", 7, "15", "kq", dy=9, x_range=(990, 1010)), L("MEP", 7, "36", "kq", dy=9, x_range=(990, 1010))], "items": ["wh-el-13"]},
        {"id": "C-07", "kind": "identity", "severity": "info", "building": "AD",
         "title": "Three admin electrical sheets carry the wrong title",
         "detail": "The drawing index on MEP-42 lists sheets 2, 4 and 5 as general notes, lighting plan and power and earthing plan. Their title blocks read CCTV plan and communications plan. The register uses the index titles.",
         "sources": [L("MEP", 42, "(2)", "Ümumi"), L("MEP", 45, "rabitə", "Mərtəbənin")], "items": []},
        {"id": "C-08", "kind": "identity", "severity": "info", "building": "WH",
         "title": "Warehouse ventilation sheets are titled as the admin building",
         "detail": "Sheets 10 to 14 sit in the warehouse set (cover on MEP-8 reads ANBAR BİNASININ İŞÇİ LAYİHƏSİ) and show the 48 m warehouse, but their title blocks read İnzibati bina. The register files them under the warehouse.",
         "sources": [L("MEP", 14, "İnzibati", "bina")], "items": ["wh-hv-1"]},
        {"id": "C-09", "kind": "review", "severity": "info", "building": "WH",
         "title": "Facade finish area is larger than the wall masonry",
         "detail": "The four elevations schedule 1,245.0 m² of render and paint. The general notes measure 787.4 m² of 400 mm limestone walls. Confirm whether the facade area includes the gables and the band above +7.00.",
         "sources": [L("AR", 5, "787.4", "DAŞI"), M("AR", 14, [116, 755, 417, 815], "Fasad 12-4: 430.6 m²")], "items": ["wh-wall", "wh-fac-14"]},
        {"id": "A-01", "kind": "agree", "severity": "ok", "building": "WH",
         "title": "Column count matches footing count",
         "detail": "Columns Ms-1 to Ms-4 total 21 + 4 + 4 + 2 = 31, which equals the 31 footings MB-1.",
         "sources": [L("KS", 7, "31", "Başmaq"), L("KS", 15, "21", "ədəd")], "items": ["wh-pads", "wh-ms1"]},
        {"id": "A-02", "kind": "agree", "severity": "ok", "building": "WH",
         "title": "Window count on the plan matches the schedule",
         "detail": "The finishes plan shows 21 P-1 windows (8 + 5 on the long sides, 4 + 4 on the gables) and 3 Q-1 doors. The door and window schedule lists 21 and 3.",
         "sources": [M("AR", 10, [200, 180, 990, 545], "P-1 × 21, Q-1 × 3"), M("AR", 19, [56, 196, 1035, 304], "Q-1 3, P-1 21")], "items": ["wh-win", "wh-door"]},
        {"id": "A-03", "kind": "agree", "severity": "ok", "building": "WH",
         "title": "Truss F-1 schedule adds up",
         "detail": "The sixteen profile rows sum to 828.26 kg and the eight plate rows to 253.36 kg, as printed.",
         "sources": [L("KS", 31, "828.26"), L("KS", 31, "253.36")], "items": ["wh-truss"]},
        {"id": "A-04", "kind": "agree", "severity": "ok", "building": "AD",
         "title": "Room areas, finish schedule and total agree",
         "detail": "The seven rooms sum to 170.1 m², the total on the room schedule and the general notes. Rooms 1 + 5 = 72.32 m², rooms 2 + 3 + 4 = 82.88 m² and rooms 6 + 7 = 14.9 m², the three floor areas in the finish schedule.",
         "sources": [M("AR", 24, [651, 215, 972, 430], "Dəhliz 62.24, İşçi otağı 22.4, Nəzarətçi otağı 22.4, İclas otağı 38.08, Tambur 10.08, Sanitar qovşağı 7.45 + 7.45, Cəmi 170.1"), L("AR", 21, "170.1")], "items": ["ad-fl-d1", "ad-fl-d2", "ad-fl-d3"]},
        {"id": "A-05", "kind": "agree", "severity": "ok", "building": "AD",
         "title": "Downpipes agree between architecture and structure",
         "detail": "Both the roof plan and the timber roof schedule give 21.8 m of Ø100 downpipe and 6 outlet funnels.",
         "sources": [M("AR", 30, [651, 351, 1186, 377], "Boru Ø100 — 21.8"), L("KS", 61, "21.8p.m", "BORU-", dy=6)], "items": ["ad-rain-pipe"]},
        {"id": "A-06", "kind": "agree", "severity": "ok", "building": "SITE",
         "title": "Site layers are consistent with their areas",
         "detail": "Gravel area 8,485.3 m² = lawn 2,532.3 + asphalt 5,549.0 + paving 404.0. Every volume equals area × layer thickness: gravel 200 mm, coarse asphalt 60 mm, fine asphalt 40 mm, carbonate 100 mm, topsoil 300 mm, cement-sand bed 100 mm.",
         "sources": [M("BP", 8, [92, 58, 604, 491], "Layihələndirilən sahə elementlərinin və istifadə olunacaq materialların təsnifatı")], "items": ["site-gravel"]},
        {"id": "A-07", "kind": "agree", "severity": "ok", "building": "AD",
         "title": "Masonry areas agree between general notes and wall plan",
         "detail": "External limestone 187.73 m², 200 mm partitions 149.27 m² and 50 mm partitions 13.7 m² appear in both the general notes and the wall types table.",
         "sources": [L("AR", 21, "187.73", "DAŞI"), M("AR", 25, [651, 338, 1175, 422], "D1 187.73, D2 149.27, D3 13.7")], "items": ["ad-wall", "ad-part200", "ad-part50"]},
    ]
    return checks


GAPS = [
    {"az": "Torpaq işləri", "en": "Earthworks", "detail": "No excavation or cut-and-fill quantities. The excavation plans (KS-4, KS-41) give outlines but no volumes, and the grading plan is a flattened image."},
    {"az": "Su anbarları və nasosxananın konstruksiyası", "en": "Tank and pump station structure", "detail": "Only the services sheets are issued for the two 100 m³ tanks and the pump station. Concrete, reinforcement and waterproofing need the structural drawings."},
    {"az": "Qəlib işləri", "en": "Formwork", "detail": "Not measured separately. The sample concrete rates for foundations and frame are all-in with formwork."},
    {"az": "Bünövrə altı hazırlıq qatı", "en": "Blinding under foundations", "detail": "Thickness is given (100 mm, B7.5) but no area, so it is not billed."},
    {"az": "Hidroizolyasiya", "en": "Waterproofing", "detail": "Shown on foundation sections (2 layers of roofing felt in hot bitumen) without quantities."},
    {"az": "Xarici şəbəkələr", "en": "External networks", "detail": "No site water, drainage or power network layouts are in the package."},
    {"az": "Qiymətlər", "en": "Prices", "detail": "The package has no bill, rates or price base. The demo uses a sample AZN rate library that can be edited."},
]


# --------------------------------------------------------------------------- build


def resolve_all(objs, errors, owner):
    out = []
    for s in objs:
        try:
            out.append(s.resolve())
        except NotFound as exc:
            errors.append(f"{owner}: {exc}")
    return out


def main():
    build_structure()
    build_architecture()
    build_mep()
    build_site()
    errors = []
    for it in ITEMS:
        it["src"] = resolve_all(it["src"], errors, it["id"])
        if it["rate"] not in RATES:
            errors.append(f"{it['id']}: unknown rate {it['rate']}")
    checks = build_checks()
    for c in checks:
        c["sources"] = resolve_all(c["sources"], errors, c["id"])
    ids = [i["id"] for i in ITEMS]
    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        errors.append(f"duplicate ids {dup}")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    data = {
        "project": PROJECT, "documents": DOCUMENTS, "buildings": BUILDINGS,
        "sections": [{"id": a, "az": b, "en": c} for a, b, c in SECTIONS],
        "sheets": sheets(), "items": ITEMS, "lineGroups": {k: {"az": a, "en": b} for k, (a, b) in LINE_GROUPS.items()},
        "rates": RATES, "checks": checks, "gaps": GAPS,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    if "-v" in sys.argv:
        for it in ITEMS:
            for s in it["src"]:
                print(f"{it['id']:<18} {it['qty']:>10} {s['sheet']:<7} {s['how']:<5} {s['quote'][:110]}")
    print(f"items {len(ITEMS)}  checks {len(checks)}  sheets {len(data['sheets'])}  -> {OUT}")


if __name__ == "__main__":
    main()
