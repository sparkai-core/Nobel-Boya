# Nobel BOQ

A bill of quantities generated from a drawing package, where every quantity opens the sheet it was read from with the printed value marked.

The demo project is the Qobu warehouse and administration building (Absheron district, Azerbaijan). It has four PDF files and 205 sheets in Azerbaijani, from Storm Building MMC, issued 28.09.2026.

## What it does

- Reads the schedules in the structural, architectural, services and master-plan sheets, giving 323 quantities on 59 sheets.
- Builds a priced bill of 313 lines, grouped by structure and trade, in Azerbaijani or English.
- Opens the source sheet for any line, with the cited value boxed in red and the original row text quoted.
- Runs 16 cross-checks on the drawings: 1 arithmetic error, 3 conflicts, 5 notes and 7 agreements. A correction can be applied to the bill or the printed value kept.
- Lets you edit any rate, the mark-ups, or a quantity, with the reason recorded.
- Exports an Excel workbook (summary, bill, takeoff with sources, checks, rates, gaps) and a printable PDF bill.

Rates are a sample AZN library. The package contains no prices.

## Repository

| Path | Contents |
|---|---|
| `app/` | React, Vite and TypeScript app. Static build, no backend |
| `app/src/data/qobu.json` | Generated dataset: sheets, takeoff with evidence boxes, checks, sample rates |
| `app/public/sheets/` | 205 sheet renders and thumbnails (WebP) |
| `drawings/` | The four source PDFs |
| `tools/` | Python pipeline that renders sheets and builds the dataset |
| `render.yaml` | Render static-site blueprint |
| `AUTOMATIC-BOQ-REQUIREMENTS.md` | Data required to move from this demo to automatic measurement |

## Run locally

Requires Node 20 or later.

```bash
cd app
npm ci
npm run dev       # http://localhost:5190
```

Production build: `npm run build` (output in `app/dist`), then `npm run preview`.

## Rebuild the dataset (optional)

Requires Python 3.11 or later with `pymupdf` and `pillow`.

```bash
py -3 tools/render_sheets.py   # sheet images into app/public/sheets
py -3 tools/build_data.py      # app/src/data/qobu.json; fails if a cited value is not printed on its sheet
py -3 tools/verify_boxes.py    # contact sheets of the hand-placed evidence boxes, for review
```

## Deploy on Render

The app is a static site. `render.yaml` holds the settings below.

| Setting | Value |
|---|---|
| Service type | Static Site |
| Root directory | empty (repository root) |
| Build command | `cd app && npm ci --include=dev && npm run build` |
| Publish directory | `app/dist` |
| Environment variable | `NODE_VERSION` = `22` |

Routes use the URL hash (`/#/bill`), so no rewrite rules are needed.
