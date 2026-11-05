# Nobel BOQ BOQ demo: plan

A browser demo that turns the four Qobu PDFs into a priced bill of quantities, where every quantity opens the sheet it was read from with the printed number marked in red.

## What the package gives

| File | Sheets | Text layer | Used for |
|---|---|---|---|
| Qobu Bas plan | 8 | none | Site materials schedule (BP-8), technical indicators (BP-3) |
| Qobu inzibati bina ve anbar | 36 | 4 sheets | Walls, finishes, doors, windows, roofs, facades |
| Qobu konstruksiya | 61 | all | Concrete, reinforcement, steelwork, timber roof |
| Qobu kommunikasiya ümumi | 100 | all | Electrical, HVAC, water, fire, alarm, CCTV, LAN, PA for 5 structures |

Five structures: warehouse, admin building, underground pump station, two 100 m³ water tanks, plus external works.

## How the numbers are made (accuracy)

1. `tools/dump_text.py`, `tools/rows_dump.py`: dump every page's words in displayed (rotated) coordinates. The structure and services PDFs are stored rotated 270°, so coordinates are transformed before use.
2. `tools/build_data.py` holds the takeoff as data. Each item names the sheet, the printed value and the row labels it sits next to. `tools/locate.py` finds that value in that row and returns its box. If the value or the label is not printed there, the build stops. Nothing enters the bill without a source.
3. Flattened sheets (master plan, most architecture) were read by eye at high zoom. Those items carry a hand-set box and are marked "read from image".
4. Derived items (31 footings × 1.80 m³, slab area × layer thickness, truss count × weight) carry their formula and every input's source.
5. Checks recompute schedules: row arithmetic, totals, counts across sheets, and the same quantity on two disciplines. Findings so far:
   - Error: bracing Şr-2 profiles printed 808.80 kg, rows add to 408.80 kg.
   - Conflict: warehouse slab 1,109.10 m² (structure) vs 1,122 m² (architecture).
   - Conflict: admin ground slab 100 mm / 18.1 m³ (structure) vs 150 mm / 25.50 m³ (architecture).
   - Missing quantity, unit-weight mismatches, sheet title errors, plus seven agreements.
6. Rates are not in the package. A sample AZN rate library is labelled as such and every rate is editable.

Result: 323 takeoff items, 16 checks, 205 sheets, all in `app/src/data/qobu.json`.

## Product scope (Constech's features, cut to a demo)

| Constech | Demo |
|---|---|
| Pipeline run screen | "Generate bill" sequence over the real sheets, staged, skippable |
| Drawings workspace with evidence | Sheet register by document, building and discipline; pan and zoom viewer; red evidence boxes; values found on the sheet |
| Bill comparison and inspector | Generated BOQ by building and section; inspector with the sheet crop, Azerbaijani source row, formula, quantity override, rate edit |
| Rates page | Sample rate library, mark-ups in calculation order (overheads, profit, contingency, VAT 18%) |
| Inputs / review issues | Checks page: errors, conflicts, agreements; apply a correction and watch the bill change |
| Excel export | Workbook with summary, bill, takeoff with sources, checks, gaps |
| Assistant, accounts, uploads | Left out |

Language toggle: descriptions in Azerbaijani (original) or English. The source quote is always the original text.

## Design

Subject: a quantity surveyor checking a bill built from Azerbaijani working drawings. The visual language comes from those drawings: white sheets, graphite linework, the designer's blue round stamp, and the reviewer's red pencil.

Palette
- Paper `#F4F4F1`: app ground, the grey of drafting film
- Sheet `#FFFFFF`: working surfaces
- Graphite `#1E2227`: text and rules
- Stamp blue `#2D4A9A`: selection, primary actions
- Redline `#D63F28`: evidence marks and errors only
- Support: line `#E1E2DC`, muted `#6A6E74`, ok `#2E7A4E`, amber `#A2670F`, light table `#2A2E33`

Type
- IBM Plex Sans for interface and prose. It covers Azerbaijani (ə, ğ, ı, İ, ş) and has an engineering pedigree that fits the subject.
- IBM Plex Sans Condensed for codes, quantities and amounts in the bill, with tabular figures, so long Azerbaijani descriptions keep their width.
- Scale 12 / 13 / 14 / 16 / 20 / 28 / 40, weights 400, 500, 600.

Layout
```
+------+---------------------------------------------+-----------+
| rail | page header: title, one line of context      |           |
|      +---------------------------------------------+ inspector |
|      | content: table or sheet viewer               | (slides   |
|      |                                              |  in on    |
|      |                                              |  select)  |
+------+---------------------------------------------+-----------+
```
Left aligned throughout. Numbers right aligned. One accent per screen.

Principles
- The signature is the redline. Selecting any quantity draws a red box around the printed number on the real sheet, stroke animated once. It appears in the inspector, the viewer and the checks.
- One orchestrated motion moment: the generate sequence, where the sheets tile in and are read stage by stage. Everything else moves only in answer to a click (drawer slide, row expand, number change).
- No gradients, emoji, em dashes, all-caps eyebrows or middle-dot meta strings. Sentence case, plain verbs.
- Status is a small coloured dot plus a word, never a coloured card.
- Viewer sits on a dark light-table so sheets read as paper.

Review against the brief: a default build would use Inter, a purple accent and identical KPI cards. Here the colours are taken from the drawings themselves, there is one condensed numeric face, and the overview is a single bill summary built as a table and a bar, not a card grid.

## Screens

1. Start: the package, four files with sheet counts and text-layer status; "Generate bill".
2. Generate: staged sequence over the real sheet thumbnails; ends on the overview.
3. Overview: bill total through the mark-up chain, split by structure and trade, evidence mix (schedule, image, derived), open checks, gaps.
4. Bill: grouped BOQ with codes, AZ/EN descriptions, unit, quantity, rate, amount; search; filter by evidence and building; inspector.
5. Drawings: register and viewer with evidence boxes and the values read from each sheet.
6. Checks: findings with side-by-side crops; apply a correction.
7. Rates: sample library and mark-ups, editable, persisted locally.
8. Export: Excel workbook.

## Build

- `app/`: Vite, React, TypeScript, React Router (hash routes so it runs from any static host), Zustand for overrides and rates (saved in localStorage), ExcelJS for export, Lucide icons, Fontsource for local fonts.
- `app/public/sheets/`: 205 WebP renders at 2× plus thumbnails (`tools/render_sheets.py`).
- Run: `cd app; npm install; npm run dev`.
