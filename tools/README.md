# Tutulan Drawing Takeoff & Extraction Pipeline

This directory contains deterministic Python tools to ingest, extract, parse, and verify quantities and redline evidence boxes from the Qobu construction drawing set.

## 📁 Pipeline Tools

| Script | Purpose | Output |
|---|---|---|
| `build_data.py` | Main takeoff dataset synthesizer. Matches quantities to cited rows, derives composite elements, attaches formulas, cross-discipline checks, and outputs JSON. | `app/src/data/qobu.json` |
| `locate.py` | Core coordinate engine. Locates printed values on text-layer sheets, accounts for drawing rotation matrix (270° orientation), and computes exact bounding boxes with row quote context. | Evidence bounding boxes `[x0, y0, x1, y1]` |
| `verify_boxes.py` | Automated audit check. Renders sampled evidence crops to verify that redline boxes accurately frame the printed numbers on the source sheets. | `work/crops/verify_*.png` |
| `render_sheets.py` | Multi-resolution sheet rasterizer. Converts all 205 drawing sheets into 2× resolution WebP and thumbnail WebP for the browser canvas viewer. | `app/public/sheets/*.webp` |
| `dump_text.py` | Extracts text and ruled table lines from all vector PDF pages. | `work/text/*.txt` |
| `rows_dump.py` | Groups page words by physical Y-coordinate into structured text rows for schedule inspection. | `work/rows/*.txt` |
| `crop.py` | High-zoom rasterizer for manual inspection of specific coordinate regions on flattened or complex sheets. | `work/crops/*.png` |
| `words.py` | CLI utility to inspect word boundaries and coordinates in a specified sheet region. | Terminal stdout |
| `contact_sheet.py` | Generates tiled contact sheets of drawing pages for quick visual navigation. | `work/crops/contact_*.png` |
| `paths.py` | Path resolver that prioritizes `drawings/` with root fallback and handles UTF-8 / Windows filesystem encoding differences. | Path instances |

---

## 🚀 Running the Pipeline

### 1. Requirements
Ensure Python 3.10+ is installed with dependencies:
```bash
pip install -r tools/requirements.txt
```

### 2. Full Takeoff Dataset Rebuild
To regenerate the application dataset from drawings:
```bash
python tools/build_data.py
```
Output:
```
items 323  checks 16  sheets 205  -> app/src/data/qobu.json
```

### 3. Verify Redline Evidence Boxes
To ensure redline evidence boxes line up with source drawings:
```bash
python tools/verify_boxes.py
```

### 4. Sheet Rasterization (if updating drawing sets)
```bash
python tools/render_sheets.py
```
Rasterizes all 205 sheets at 2× zoom for pristine, retina-sharp blueprint viewing in the React canvas.
