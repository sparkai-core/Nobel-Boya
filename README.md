# Nobel BOQ

A construction platform with three modules:

| Module | State | Where the data lives |
|---|---|---|
| **Estimate** (drawing takeoff, bill of quantities, rates, client BOQ comparison, checks, export) | **Working end to end** | FastAPI server + SQLite + sheet images on disk |
| **Projects / PM** (portfolio, programme, progress, site, records, control) | Demo | Browser only (`localStorage`), seeded sample data |
| **Procurement + Vendor portal** (requests, RFQs, quotes, approvals, POs, receipts, stock, invoices, payments) | Demo | Browser only (`localStorage`), seeded sample data |

Every quantity in the Estimate module opens the drawing sheet it was read from, with the printed value boxed.

---

## 1. Architecture

```
Browser (React + Vite, HashRouter)
  │  /#/...                      pages
  │  /api/...                    JSON API (Bearer token)
  │  /sheets/<project>/<id>.webp sheet images
  ▼
FastAPI (server/app.py) ── one process, one container
  ├─ auth.py            signed session tokens, login throttling, password rules
  ├─ db.py              SQLite: users, projects (dataset JSON), boq_comparisons
  ├─ takeoff_engine.py  PDF → sheets, quantities with evidence boxes, checks
  ├─ tabular.py         shared CSV/XLSX/XLS reader (headers, number formats)
  ├─ rates_parser.py    rate schedule import + merge into the project rate library
  └─ boq_comparator.py  client bill vs. drawing quantities
DATA_DIR (persistent disk in production)
  ├─ tutulan.db         SQLite (WAL)
  ├─ .secret_key        token signing key if SECRET_KEY is not set
  └─ sheets/<uuid>/     WebP renders per project (full + .t thumbnail)
```

In production a single Docker container serves both the built frontend (`app/dist`) and the API from one origin. No CORS and no `VITE_API_URL` are needed.

### Repository

| Path | Contents |
|---|---|
| `server/` | API and estimation engine (Python 3.11) |
| `server/tests/` | pytest suite: parsers, engine on synthetic drawings, API security, reference recall |
| `app/src/` | React app. Estimate pages in `pages/*.tsx`; PM, Procurement and Vendor in `pages/pm`, `pages/procurement`, `pages/projects`, `pages/vendor` |
| `app/src/lib/api.ts` | The only place the frontend talks to the server |
| `app/src/lib/store.ts` | Estimate state: session token, active project, local rate/quantity overrides |
| `app/src/ops/` | PM/Procurement/Vendor demo: `types.ts` (entities), `store.ts` + `store-phase2.ts` (actions), `seed/` (sample data), `select.ts` (derived views, scoring, CPM) |
| `app/src/data/qobu.json` | Reference project (Qobu warehouse, 205 sheets, hand-verified). Also the default rate library |
| `app/public/sheets/` | Renders of the reference project's sheets |
| `drawings/` | The reference project's source PDFs |
| `tools/` | Pipeline that built `qobu.json` by hand-checked location of every value |
| `Dockerfile`, `render.yaml` | Production deployment (Render) |
| `vercel.json`, `netlify.toml` | Static demo deployment (no server; see 4.3) |

---

## 2. Run locally

Backend (Python 3.11+):

```bash
py -3 -m pip install -r server/requirements-dev.txt
py -3 -m uvicorn app:app --app-dir server --port 8090 --reload
```

Frontend (Node 20+), in another terminal:

```bash
cd app && npm ci && npm run dev     # http://localhost:5190, proxies /api and /sheets to :8090
```

Demo accounts (created when `SEED_DEMO=1`, the default): `demo@nobel.az`, `elmir@stormtakeoff.com`, `rashad@stormtakeoff.com`, all with password `demo`. Without `DATA_DIR` the database is `server/tutulan.db` and new sheet images go to `app/public/sheets/<uuid>/`.

Tests:

```bash
cd server && py -3 -m pytest tests -q
```

`test_reference_project_recall` reads the Qobu PDFs in `drawings/` and requires ≥95% of the hand-verified quantities to be found (currently 269/276). Run it after any engine change.

---

## 3. Estimate module: how it works

### 3.1 Takeoff engine (`server/takeoff_engine.py`)

Rule: **a quantity enters the bill only if it is printed on a sheet.** Nothing is estimated. Each item cites the sheet and the box around the printed value and its row label, in displayed (rotation-corrected) page points.

Per page:

1. Words with `page.rotation_matrix` applied. Margin stamps are dropped, including legacy-font ones such as "Яслин" or "Имза". Superscripts are merged (`m` + raised `2` gives `m²`), as is `Ø 8` → `Ø8`.
2. **Title block.** Its region is located from title-block keywords in the bottom-right. Its words are removed, so a schedule line sharing a text row with it keeps its own words. Its text is kept for naming.
3. **Calculation reports** (heat loss, energy, explanatory notes) are skipped.
4. Readers, in this order:
   - **Steel consumption tables** ("Polad sərfi cədvəli"): diameter columns, class subtotals (`Cəmi` or `Yekun`, either convention), grand total, optional concrete column. Arithmetic is cross-checked and mismatches become checks. Tables headed "for one element" get a review check.
   - **Metal specification** (`KÜTLƏSİ … YEKUN`): element totals.
   - **Unit-column specification tables** (equipment, cable, pipe). The quantity sits next to the unit, and the side is decided per column by majority. Ditto marks are supported. At least 3 aligned rows are required.
   - **Material statements** ("Material: Beton B25 - 15.36 m³"). They are dropped if they are a parameter (`V = 100 m³`), a note or prose, a design load, or a drawing-list entry. Concrete volumes are named after the nearest element heading or mark (`Btv-1`, `Mk-1`), else the title block.
   - **Header-unit schedules** ("Sahə, m²", "Həcm", "Qty"). These run only on pages where nothing else was found, and need a material word in the label.
5. Areas and lengths of an element become **evidence on its concrete line**, matched by position or by element mark across sheets, not separate bill lines.
6. Unread schedule pages and image-only pages become checks, so they get measured by hand. OCR exists (Tesseract, `OCR_DISABLED=0`) but is **off by default**: on 37 scanned CAD sheets it took 7 minutes and found no usable quantities (see 4.1). OCR'd results would be marked `method: "image"`, and an OCR'd page with nothing read is still flagged as image-only.

Vocabulary is Azerbaijani, English and Russian, including legacy Cyrillic-encoded Azerbaijani CAD fonts (`kw()` / `_LEGACY_AZ`). It is matched at word starts. Item → rate mapping is grade-aware: a B20 slab does not take the library's B25 slab rate; it gets its own unpriced key.

**Measured quality.** Qobu reference: 269/276 hand-verified quantities, plus 4 genuinely printed extras, nothing invented. Blind test on another office's 30 PDFs (Hadrut Depo, 346 pages): every reviewed line was printed on the drawings; 204 image-only pages flagged.

**Known limits:**
- Counts printed only on another sheet: per-element schedules carry one element and raise a review check.
- Bar-bending schedules supplied as Excel are not imported.
- Client BOQs as PDF are not supported (Excel/CSV only).
- Scanned (image-only) drawings are not read; they are flagged for manual takeoff. Reading them needs a better approach than plain OCR (for example a vision model for table regions), run as a background job, not inside the upload request.

### 3.2 Rates (`tabular.py`, `rates_parser.py`)

- `.csv` / `.xlsx` / `.xls`. The header row is found anywhere in the first 40 rows; roles are matched by whole words ("Unit Rate" is a rate, "Item Description" is a description, "Vahid qiymət" is a rate).
- Numbers in `1,250.50`, `1.250,50` and `1 250,50` formats; currency symbols are ignored.
- Matching order: code (case, space, dot, dash and underscore insensitive) → exact description → token similarity ≥ 0.75 with a compatible unit. A matched rate keeps its description and group; only the price changes. A per-tonne price is converted for per-kg rates. An incompatible unit is reported as a conflict and not applied.
- Every updated, added, unchanged, skipped and conflicting row is returned to the UI.

### 3.3 Client BOQ comparison (`boq_comparator.py`)

Unit-compatible (kg and t convert), one-to-one matching. Different element types (column / slab / wall …) or concrete grades never match. A client line can match a group of items that share a rate (e.g. all A500C reinforcement). Results include quantity variance, rate variance, and items the client missed.

### 3.4 Security

- **Sessions:** HMAC-SHA256 signed tokens with expiry (`TOKEN_TTL_HOURS`). Signing key from `SECRET_KEY`, else generated once into `DATA_DIR/.secret_key`.
- **Passwords:** PBKDF2-SHA256 with salt. Legacy hashes are upgraded on login. Minimum 8 characters for new accounts.
- **Login throttling:** 5 failures per email or 20 per IP in 15 minutes. Behind a proxy this needs `FORWARDED_ALLOW_IPS` (set in the Dockerfile).
- **Data isolation:** every project query is scoped to the owner.
- **Uploads:** size and page limits.
- **Sheet images:** under unguessable per-project folders. They are not access-checked, because `<img>` cannot send bearer tokens.
- **Response headers:** nosniff, frame-deny.
- **Not implemented:** email verification and 2-step authentication (by decision), roles, password reset.

---

## 4. Deployment

### 4.1 Render (production: the Estimate module works fully)

1. Render dashboard → **New → Blueprint** → select this repository. `render.yaml` creates one Docker web service with a 10 GB disk at `/data` and generates `SECRET_KEY`.
2. Wait for the health check (`/api/health`) to pass, then open the service URL.
3. For real use, set `SEED_DEMO=0`, so no demo accounts with password `demo` are created, and decide on `ALLOW_SIGNUP`.

| Variable | Default | Meaning |
|---|---|---|
| `DATA_DIR` | `/data` | Database, signing key, sheet images. Must be the persistent disk |
| `SECRET_KEY` | generated | Session signing key. Changing it signs everyone out |
| `SEED_DEMO` | `1` | Create demo accounts and the sample project |
| `ALLOW_SIGNUP` | `1` | Allow self-registration |
| `MAX_CONCURRENT_TAKEOFFS` | `1` | Drawing sets processed at once |
| `MAX_PDF_MB` / `MAX_PDF_PAGES` | `200` / `500` | Upload limits |
| `TOKEN_TTL_HOURS` | `12` | Session length |
| `CORS_ORIGINS` | localhost dev ports | Only needed if the frontend is hosted elsewhere (4.2) |
| `OCR_DISABLED` | `1` | `0` turns on OCR of image-only sheets: slow, and not useful on CAD scans so far |

**Sizing, measured in the production container (2 GB limit):**

| Upload | Time | Peak memory |
|---|---|---|
| 61 text sheets (Qobu structure) | 17 s | 276 MB |
| 37 scanned sheets with OCR on | 411 s | 609 MB (0 quantities, so OCR stays off) |

- A persistent disk needs a paid instance.
- Rasterising sheets is the memory-heavy step: each page is rendered at up to 6000 px on its long side, one page at a time.
- `render.yaml` uses `standard` (2 GB). Starter (512 MB) is below the measured peak for OCR, and too close for large A0 sets. With `MAX_CONCURRENT_TAKEOFFS=1`, uploads are processed one at a time.
- Keep `numInstances: 1` while the database is SQLite.
- Processing runs inside the upload request. Text sets finish in seconds to a minute. Very large sets or OCR need a background job queue first (upload returns immediately, page polls for progress). This is planned with the Postgres move in section 5.

**Backups:** the disk holds all user data. Enable Render disk snapshots, or copy `tutulan.db` periodically using SQLite's `.backup` command, not a file copy, because of WAL mode.

### 4.2 Frontend elsewhere (optional)

To keep the frontend on Vercel or Netlify:
- set `VITE_API_URL=https://<render-service>` in the frontend build;
- set `CORS_ORIGINS=https://<frontend-domain>` on the server.

### 4.3 Static demo only (Vercel/Netlify without a server)

`vercel.json` / `netlify.toml` deploy only the frontend. When no API answers, `api.ts` detects it (404/405, the host's `index.html`, or no connection). The demo account (`demo@nobel.az` / `demo`) then opens a read-only demo of the bundled sample project; uploads and saving explain that they need the server.

---

## 5. Making Projects, Procurement and the Vendor portal real

They are currently front-end demos. One zustand store (`app/src/ops/store.ts` + `store-phase2.ts`, persisted to `localStorage` as `nobel.ops.v1`) holds everything. Data is seeded from `app/src/ops/seed/`, and the business logic is in store actions and `select.ts`. The entity model in `app/src/ops/types.ts` (`OpsData`) is the starting point for the database schema.

### 5.1 Target architecture

Keep the single FastAPI service and add one router per module:

```
server/
  ops/
    models.py        tables mirroring app/src/ops/types.ts
    pm.py            /api/pm/...        programmes, activities, links, milestones, progress, delays, RFIs, changes, inspections, IPCs, site (workers, attendance, incidents, permits)
    procurement.py   /api/proc/...      vendors, materials, MRs, RFQs, quotes, approvals, POs, GRNs, stock, movements, invoices, pay runs, payments, exceptions
    vendor.py        /api/vendor/...    vendor-facing subset: their RFQs, quotes, orders, deliveries, invoices, documents
    files.py         uploads/downloads with access checks
    jobs.py          reminders, overdue alerts, expiring documents
```

**Database: move to PostgreSQL before these modules go live.**
- Procurement and the vendor portal have many concurrent writers; SQLite allows one writer at a time and one instance.
- Use Render's managed Postgres, SQLAlchemy 2 + Alembic migrations, and `DATABASE_URL`.
- Migrate the Estimate tables at the same time. Projects' `data_json` can stay as JSONB at first.

**Identity and permissions:**
- Add `organisations` and `memberships(user, org, role)`.
- Internal roles: `admin`, `estimator`, `planner`, `site`, `buyer`, `approver`, `finance`.
- Vendors are separate organisations with role `vendor`.
- Every query is scoped by organisation **and** checked against role.
- Vendor users must only ever see records linked to their vendor id. Put this in one dependency used by every vendor route, and test it.
- Approvals need limits per role (e.g. PO value thresholds) and an audit trail: who, when, what changed. The `HistoryEvent`/`FeedEvent` types already model this.
- Vendor onboarding: invite links (signed, expiring tokens like the session tokens) that let a vendor set a password. Sending the link by email is optional; it can be copied and shared.

**Files:**
- Quotes, invoices, delivery notes, permits, photos.
- Start on the Render disk under `DATA_DIR/files/<org>/<uuid>`, served through an access-checked endpoint (not static).
- Move to S3-compatible storage once volume grows.

**Background work:** reminders, RFQ deadlines, expiring vendor documents and stock re-order alerts. Run them as a Render Cron Job calling an internal endpoint, or as a small worker.

**Links to Estimate:**
- BOQ lines → material requests (quantities and rates from the bill).
- PO and invoice prices → feed back into the rate library.
- Programme activities → BOQ sections for earned value.

### 5.2 Frontend migration

1. Keep the components. Replace the ops store's data source module by module:
   - store actions call new functions in `app/src/lib/api.ts`;
   - lists load from the server;
   - a server-backed store replaces `persist`. TanStack Query is a good fit.
2. Remove `seed/` data from production builds once a module is server-backed. Keep it for the static demo (4.3).
3. Vendor portal (`pages/vendor`, `VpShell.tsx`): separate login landing and a vendor-only route guard.

### 5.3 Suggested order

1. Postgres + migrations + organisations/roles (no UI change).
2. Procurement core: vendors, materials, MR → RFQ → quote → approval → PO → GRN, with audit trail.
3. Vendor portal on top of 2: invites, RFQ inbox, quote submission, orders, invoices.
4. Finance: invoices matched to PO and GRN, pay runs, payments.
5. PM: programme (activities, links; CPM already in `select.ts`), progress and snapshots, delays, RFIs, changes, inspections, IPCs.
6. Site: workers, attendance, incidents, permits, PPE checks.

For each step:
- write pytest coverage for permissions, especially vendor isolation, before UI wiring;
- keep the demo mode working for the static deployment.

---

## 6. Conventions for contributors

- **Engine changes:**
  - run `pytest tests` (includes the Qobu recall test, ≥95%);
  - also run a blind check on drawings from another office;
  - never add a rule that produces a number not printed on the sheet.
- **New tabular formats:** add header vocabulary in `tabular.classify_header`, and cover it with a test in `tests/test_parsers.py`.
- **Frontend:** call the server only through `lib/api.ts`. The 401 handler and the static-demo fallback live there.
- **Secrets and data** (`*.db`, `.secret_key`, `app/public/sheets/<uuid>/`) are git- and docker-ignored. Keep them that way.
