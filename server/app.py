"""Nobel BOQ API: authentication, drawing takeoff, rate schedules and BOQ comparison.

Every project endpoint requires a signed bearer token and only touches projects owned
by that user.
"""
import asyncio
import logging
import math
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

import takeoff_engine
from auth import issue_token, password_problem, throttle, validate_email, verify_token
from boq_comparator import compare_boqs, parse_client_boq_report
from db import (
    check_pw,
    create_user,
    find_user_by_email,
    find_user_by_id,
    get_db,
    get_latest_boq_comparison,
    get_project_for_user,
    init_db,
    list_user_projects,
    needs_rehash,
    save_boq_comparison,
    save_project_for_user,
    set_password,
    update_project_data,
)
from rates_parser import merge_rates, parse_rate_rows
from tabular import SUPPORTED_EXTENSIONS, TableError

log = logging.getLogger("nobel")
logging.basicConfig(level=logging.INFO)

MAX_PDF_BYTES = int(os.getenv("MAX_PDF_MB", "200")) * 1024 * 1024
MAX_TABLE_BYTES = int(os.getenv("MAX_TABLE_MB", "20")) * 1024 * 1024
MAX_PAGES = int(os.getenv("MAX_PDF_PAGES", "500"))
MAX_RATE = 10_000_000.0
ALLOW_SIGNUP = os.getenv("ALLOW_SIGNUP", "1") != "0"
_jobs = asyncio.Semaphore(int(os.getenv("MAX_CONCURRENT_TAKEOFFS", "2")))

app = FastAPI(title="Nobel BOQ API", version="3.0.0")

_origins = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5190,http://127.0.0.1:5173,http://127.0.0.1:5190",
).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. The error has been logged."})


# Sheet images: new projects live under DATA_DIR/sheets/<project folder>/; the bundled sample
# project's sheets ship with the frontend build. Look in each place, in that order.
SHEET_DIRS = [takeoff_engine.SHEETS_DIR,
              Path(__file__).resolve().parents[1] / "app" / "dist" / "sheets",
              Path(__file__).resolve().parents[1] / "app" / "public" / "sheets"]
takeoff_engine.SHEETS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/sheets/{path:path}")
def sheet_image(path: str):
    if not re.fullmatch(r"(?:[A-Za-z0-9_-]{1,64}/)?[A-Za-z0-9_.-]{1,80}\.webp", path) or ".." in path:
        raise HTTPException(status_code=404, detail="Not found")
    for base in SHEET_DIRS:
        f = (base / path).resolve()
        if f.is_file() and base.resolve() in f.parents:
            return FileResponse(f, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})
    raise HTTPException(status_code=404, detail="Not found")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"ok": True, "ocr": takeoff_engine.ocr_available()}


# --------------------------------------------------------------------- auth

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    uid = verify_token(authorization[7:].strip())
    user = find_user_by_id(uid) if uid else None
    if not user:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return user


def _public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}


def _session(user: dict) -> dict:
    token, exp = issue_token(user["id"])
    return {"token": token, "expires_at": exp, "user": _public_user(user)}


@app.post("/api/auth/login")
def login(payload: dict, request: Request):
    email = str(payload.get("email", "")).strip().lower()
    pw = str(payload.get("password", ""))
    if not email or not pw:
        raise HTTPException(status_code=400, detail="Enter your email and password.")
    ip = request.client.host if request.client else "?"
    wait = throttle.blocked(email, ip)
    if wait:
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {math.ceil(wait / 60)} minutes.")
    user = find_user_by_email(email)
    if not user or not check_pw(user["password_hash"], pw):
        throttle.fail(email, ip)
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    throttle.success(email)
    if needs_rehash(user["password_hash"]):
        set_password(user["id"], pw)
    return _session(user)


@app.post("/api/auth/register")
def register(payload: dict, request: Request):
    if not ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="New accounts are created by an administrator.")
    email = str(payload.get("email", "")).strip().lower()
    pw = str(payload.get("password", ""))
    name = str(payload.get("name", "")).strip()[:80] or email.split("@")[0].replace(".", " ").title()
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    problem = password_problem(pw)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    ip = request.client.host if request.client else "?"
    if throttle.blocked(email, ip):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    if find_user_by_email(email):
        throttle.fail(email, ip)
        raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in instead.")
    return _session(create_user(email, pw, name))


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return _public_user(user)


@app.post("/api/auth/password")
def change_password(payload: dict, user: dict = Depends(get_current_user)):
    if not check_pw(user["password_hash"], str(payload.get("current", ""))):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    problem = password_problem(str(payload.get("new", "")))
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    set_password(user["id"], str(payload["new"]))
    return {"success": True}


# ----------------------------------------------------------------- uploads

async def _read_upload(f: UploadFile, limit: int, what: str) -> bytes:
    chunks, size = [], 0
    while True:
        chunk = await f.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > limit:
            raise HTTPException(status_code=413, detail=f"The {what} is larger than {limit // (1024 * 1024)} MB.")
        chunks.append(chunk)
    return b"".join(chunks)


def _check_table_name(name: Optional[str], what: str) -> str:
    fn = (name or "").strip()
    if not fn.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail=f"The {what} must be .csv, .xlsx or .xls.")
    return Path(fn).name[:200]


def _clean(s: str, n: int = 200) -> str:
    return re.sub(r"[\x00-\x1f]", "", (s or "")).strip()[:n]


# ----------------------------------------------------------------- projects

@app.get("/api/projects")
def get_projects(user: dict = Depends(get_current_user)):
    return {"projects": list_user_projects(user["id"])}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    return proj


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    conn = get_db()
    conn.execute("DELETE FROM boq_comparisons WHERE project_id = ? AND user_id = ?", (project_id, user["id"]))
    conn.execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user["id"]))
    conn.commit()
    conn.close()
    if proj.get("asset_dir"):
        shutil.rmtree(takeoff_engine.SHEETS_DIR / proj["asset_dir"], ignore_errors=True)
    return {"success": True}


@app.post("/api/projects")
async def create_new_project(
    drawing_file: UploadFile = File(...),
    title: str = Form(...),
    client: str = Form("Client"),
    designer: str = Form("Engineering Office"),
    place: str = Form("Project Location"),
    rates_file: Optional[UploadFile] = File(None),
    boq_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    title, client, designer, place = _clean(title, 120), _clean(client), _clean(designer), _clean(place)
    if not title:
        raise HTTPException(status_code=400, detail="Give the project a name.")
    if not (drawing_file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="The drawing set must be a PDF.")
    pdf_bytes = await _read_upload(drawing_file, MAX_PDF_BYTES, "drawing set")
    if not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="The drawing file is not a valid PDF.")

    # read the optional files first so a bad rate or bill file fails fast
    rate_rows, rates_report, cmp_bytes, cmp_name = None, None, None, None
    warnings = []
    if rates_file is not None and rates_file.filename:
        rname = _check_table_name(rates_file.filename, "rate file")
        rbytes = await _read_upload(rates_file, MAX_TABLE_BYTES, "rate file")
        try:
            rate_rows, rates_report = parse_rate_rows(rbytes, rname)
        except TableError as e:
            raise HTTPException(status_code=400, detail=f"Rate file: {e}")
    if boq_file is not None and boq_file.filename:
        cmp_name = _check_table_name(boq_file.filename, "client bill")
        cmp_bytes = await _read_upload(boq_file, MAX_TABLE_BYTES, "client bill")

    try:
        import pymupdf
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as d:
            if d.needs_pass:
                raise HTTPException(status_code=400, detail="The PDF is password-protected. Upload an unlocked copy.")
            if len(d) > MAX_PAGES:
                raise HTTPException(status_code=400, detail=f"The PDF has {len(d)} pages; the limit is {MAX_PAGES}.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The PDF could not be opened. It may be damaged.")

    asset_dir = uuid.uuid4().hex
    try:
        async with _jobs:
            project_data = await run_in_threadpool(
                takeoff_engine.process_uploaded_drawing_package,
                pdf_bytes, Path(drawing_file.filename).name, title, client, designer, place, None, asset_dir,
            )
    except Exception:
        shutil.rmtree(takeoff_engine.SHEETS_DIR / asset_dir, ignore_errors=True)
        log.exception("Takeoff failed for %s", drawing_file.filename)
        raise HTTPException(status_code=500, detail="The drawing set could not be processed. Check that it is a drawing PDF and try again.")

    if rate_rows is not None:
        merged, merge_report = merge_rates(project_data["rates"], rate_rows, source_name=rates_file.filename)
        project_data["rates"] = merged
        rates_report.update(merge_report)
        if not merge_report["updated"] and not merge_report["added"]:
            warnings.append("The rate file was read, but no rate in it matched or added anything.")

    code_slug = re.sub(r"[^a-zA-Z0-9]", "", title.lower())[:12] or "proj"
    project_id = save_project_for_user(user["id"], code_slug, title, client, designer, place, project_data, asset_dir=asset_dir)

    comparison_summary = None
    if cmp_bytes is not None:
        try:
            lines, _rep = parse_client_boq_report(cmp_bytes, cmp_name)
            cmp_data = compare_boqs(lines, project_data)
            save_boq_comparison(user["id"], project_id, cmp_name, cmp_data)
            comparison_summary = cmp_data["summary"]
        except TableError as e:
            warnings.append(f"Client bill not compared: {e}")

    return {
        "success": True,
        "project_id": project_id,
        "title": title,
        "sheets_count": len(project_data.get("sheets", [])),
        "items_count": len(project_data.get("items", [])),
        "checks_count": len(project_data.get("checks", [])),
        "rates_report": rates_report,
        "comparison": comparison_summary,
        "warnings": warnings,
    }


# --------------------------------------------------------- rates & comparison

def _owned(project_id: str, user: dict) -> dict:
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    return proj


@app.post("/api/projects/{project_id}/rates")
async def upload_project_rates(project_id: str, rates_file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    proj = _owned(project_id, user)
    name = _check_table_name(rates_file.filename, "rate file")
    content = await _read_upload(rates_file, MAX_TABLE_BYTES, "rate file")
    try:
        rows, report = parse_rate_rows(content, name)
    except TableError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not rows:
        raise HTTPException(status_code=400, detail="No usable rate rows were found in the file." +
                            (f" {len(report['skipped'])} row(s) were skipped; the first: row {report['skipped'][0]['row']}, {report['skipped'][0]['reason']}." if report["skipped"] else ""))
    p_data = proj["data"]
    merged, merge_report = merge_rates(p_data.get("rates", {}) or {}, rows, source_name=name)
    p_data["rates"] = merged
    update_project_data(project_id, user["id"], p_data)
    report.update(merge_report)
    return {
        "success": True,
        "updated_rates_count": len(merge_report["updated"]) + len(merge_report["added"]),
        "report": report,
        "rates": merged,
    }


@app.post("/api/projects/{project_id}/rates/manual")
def update_or_add_manual_rate(project_id: str, payload: dict, user: dict = Depends(get_current_user)):
    proj = _owned(project_id, user)
    try:
        rate_val = float(payload.get("rate"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="The rate must be a number.")
    if not math.isfinite(rate_val) or rate_val < 0 or rate_val > MAX_RATE:
        raise HTTPException(status_code=400, detail="The rate must be zero or a positive number.")

    en = _clean(str(payload.get("en") or ""), 200)
    key = _clean(str(payload.get("key") or ""), 80)
    if not key:
        key = re.sub(r"[^a-z0-9]+", "_", en.lower()).strip("_")[:60] or f"rate_{uuid.uuid4().hex[:6]}"
    p_data = proj["data"]
    rates = p_data.get("rates", {}) or {}
    existing = rates.get(key) if isinstance(rates.get(key), dict) else {}
    item = {
        **existing,
        "rate": round(rate_val, 4),
        "unit": _clean(str(payload.get("unit") or ""), 12) or existing.get("unit") or "m³",
        "en": en or existing.get("en") or key,
        "az": _clean(str(payload.get("az") or ""), 200) or existing.get("az") or en or existing.get("en") or key,
        "group": _clean(str(payload.get("group") or ""), 60) or existing.get("group") or "Custom rates",
        "source": "manual",
    }
    rates[key] = item
    p_data["rates"] = rates
    update_project_data(project_id, user["id"], p_data)
    return {"success": True, "key": key, "rate": item, "all_rates": rates}


@app.post("/api/projects/{project_id}/compare")
async def upload_comparison_boq(project_id: str, boq_file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    proj = _owned(project_id, user)
    name = _check_table_name(boq_file.filename, "client bill")
    content = await _read_upload(boq_file, MAX_TABLE_BYTES, "client bill")
    try:
        lines, report = parse_client_boq_report(content, name)
    except TableError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not lines:
        raise HTTPException(status_code=400, detail="No bill lines with a description and a quantity were found.")
    cmp_data = compare_boqs(lines, proj["data"])
    cmp_data["report"] = report
    save_boq_comparison(user["id"], project_id, name, cmp_data)
    return {"success": True, "filename": name, "summary": cmp_data["summary"], "lines": cmp_data["lines"], "report": report}


@app.get("/api/projects/{project_id}/comparison")
def get_comparison(project_id: str, user: dict = Depends(get_current_user)):
    _owned(project_id, user)
    res = get_latest_boq_comparison(project_id, user["id"])
    if not res:
        return {"has_comparison": False, "summary": None, "lines": []}
    return {
        "has_comparison": True,
        "filename": res.get("filename"),
        "created_at": res.get("created_at"),
        "summary": res["comparison"].get("summary"),
        "lines": res["comparison"].get("lines", []),
    }


# Built frontend for single-server deployments (Render, Docker, VPS)
DIST_DIR = Path(__file__).resolve().parents[1] / "app" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=os.getenv("RELOAD", "0") == "1")
