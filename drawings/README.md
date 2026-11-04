# Project Drawings: Qobu Warehouse & Administrative Complex

Working-design package for a warehouse (*anbar*) and administrative building (*inzibati bina*) at Qobu, Abşeron district, Baku, Azerbaijan.

- **Client:** Cəfərov Mədət İslam oğlu
- **Design Firm:** "Storm Building" MMC
- **Project Date:** 2026
- **Language:** Azerbaijani (AZ)
- **Total Drawing Sheets:** 205 sheets across 4 volumes

---

## 📐 Drawing Set Inventory

| Package File | Sheets | Discipline | Coordinate Orientation | Text Layer | Key Extraction Scope |
|---|---|---|---|---|---|
| `Qobu Bas plan28.09.2026.pdf` | 8 | Master Plan (*Baş plan*) | 0° Landscape | Flattened / Image | Site zoning, building footprint (1,398.2 m² / 14.0%), landscaping (2,532.3 m² / 25.3%), site hardscape, external parking canopy, utility reservations. |
| `Qobu inzibati bina ve anbar 28.09.2026.pdf` | 36 | Architecture (*Memarlıq*) | 0° Landscape | Partial (4 sheets text, remainder flattened) | 48 × 24 m warehouse hall (1,122 m²), 6 m column grid, 2-story admin block, partition walls, room areas, floor/wall/ceiling finish schedules, window & door schedules. |
| `Qobu konstruksiya.pdf` | 61 | Structural (*Konstruksiya*) | 270° Portrait-stored | 100% Vector (all 61 sheets) | Pad footings (31 no.), strip foundations, RC columns, ground slab (+0.00), intermediate slab (+3.30), steel trusses F-1, purlins, bracing, rebar consumption tables (A500C, A-I). Seismicity: 8. |
| `Qobu kommunikasiya ümumi.pdf` | 100 | MEP & Utilities (*Kommunikasiya*) | 270° Portrait-stored | 100% Vector (all 100 sheets) | Electrical power, lighting, single-line diagrams, HVAC ventilation & heating, domestic water, drainage, firefighting, fire alarm, CCTV, LAN, PA systems for warehouse, admin, pump house, and two 100 m³ water tanks. |

---

## 🔍 Data Extraction Notes

1. **Text Rotation:** The structural (`KS`) and MEP (`MEP`) sets are physically authored with sheets rotated 270° in the PDF container. The coordinate extraction pipeline in `tools/locate.py` multiplies entity vectors by `page.rotation_matrix` before resolving bounding boxes, ensuring that coordinates displayed on screen match the visual orientation.
2. **Flattened Sheets:** Master Plan sheets and 32 architectural sheets have vector linework but rasterized or non-standard text. These were measured and verified with pixel-accurate bounding boxes categorized as `"how": "image"` in the takeoff audit trail.
3. **Cyrillic & Legacy Encodings:** Sheets utilizing legacy Cyrillic-mapped Azerbaijani font encodings are normalized to modern Azerbaijani Latin characters (`ə`, `ı`, `ş`, `ç`, `ğ`, `ö`, `ü`).

