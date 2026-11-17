"""Storm Takeoff FastAPI Backend with SQLite Persistence & Multi-Tenant Isolation.
Provides authenticated endpoints for autonomous takeoff, rates upload, and BOQ comparison.
"""
import io
import os
import json
import uuid
import re
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import (
    init_db,
    find_user_by_email,
    find_user_by_id,
    list_user_projects,
    get_project_for_user,
    save_project_for_user,
    update_project_data,
    save_boq_comparison,
    get_latest_boq_comparison,
    hash_pw,
    check_pw,
    get_db,
)
from takeoff_engine import process_uploaded_drawing_package
from rates_parser import parse_rates_file
from boq_comparator import parse_client_boq, compare_boqs

app = FastAPI(
    title="Storm Takeoff API",
    description="Autonomous Quantity Takeoff, Multi-Tenant SQLite Database, and Drawing Verification",
    version="2.0.0"
)

# Enable CORS for frontend Vite dev server (port 5190, 5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount public sheets static directory so any newly rasterized sheet is accessible
DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parents[1] / "app" / "public"))
PUBLIC_SHEETS = DATA_DIR / "sheets"
PUBLIC_SHEETS.mkdir(parents=True, exist_ok=True)
app.mount("/sheets", StaticFiles(directory=str(PUBLIC_SHEETS)), name="sheets")


@app.on_event("startup")
def on_startup():
    init_db()


def get_current_user(authorization: Optional[str] = Header(None), x_user_email: Optional[str] = Header(None)):
    """Authenticate request using Bearer token or User Email header."""
    email = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        # In this lightweight architecture, token is user_id or email
        if "@" in token:
            email = token
        else:
            u = find_user_by_id(token)
            if u:
                return u
    if not email and x_user_email:
        email = x_user_email.strip()

    if not email:
        # Fallback to default user for seamless demo interaction
        email = "elmir@stormtakeoff.com"

    user = find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found or invalid session")
    return user


# ---------------------------------------------------------------- AUTH ENDPOINTS

@app.post("/api/auth/login")
def login(payload: dict):
    email = payload.get("email", "").strip()
    pw = payload.get("password", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = find_user_by_email(email)
    if not user:
        # Auto-create user for frictionless multi-user onboarding
        name = email.split("@")[0].replace(".", " ").title()
        now_str = ""
        conn = get_db()
        cur = conn.cursor()
        uid = f"user_{uuid.uuid4().hex[:8]}"
        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (uid, email.lower(), hash_pw(pw or "demo"), name, "Quantity Surveyor", now_str)
        )
        conn.commit()
        conn.close()
        user = find_user_by_email(email)
    else:
        # Verify password for existing users
        if not check_pw(user["password_hash"], pw or "demo"):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "token": user["id"],
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }


# ------------------------------------------------------------ PROJECTS ENDPOINTS

@app.get("/api/projects")
def get_projects(user: dict = Depends(get_current_user)):
    """List projects strictly belonging to the authenticated user."""
    projects = list_user_projects(user["id"])
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str, user: dict = Depends(get_current_user)):
    """Fetch project details and complete dataset for the authenticated user."""
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        # Backwards compatibility check for the demo 'qobu' project
        if project_id in ["qobu", "proj_qobu"]:
            demo_proj = get_project_for_user("proj_qobu", user["id"])
            if demo_proj:
                return demo_proj
        raise HTTPException(status_code=404, detail="Project not found or belongs to another user")
    return proj


@app.post("/api/projects")
async def create_new_project(
    drawing_file: UploadFile = File(...),
    title: str = Form(...),
    client: str = Form("Client"),
    designer: str = Form("Engineering Office"),
    place: str = Form("Project Location"),
    rates_file: Optional[UploadFile] = File(None),
    boq_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    """Create a new project from uploaded drawings, parse schedules, and generate BOQ."""
    # 1. Validate drawing file type
    fn = drawing_file.filename.lower()
    if not fn.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid drawing file format. Only PDF drawing sets (.pdf) are supported.")

    pdf_bytes = await drawing_file.read()
    if not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF document.")

    # 2. Parse optional custom rates file
    custom_rates = {}
    if rates_file and rates_file.filename:
        r_fn = rates_file.filename.lower()
        if not (r_fn.endswith(".csv") or r_fn.endswith((".xlsx", ".xls"))):
            raise HTTPException(status_code=400, detail="Invalid rates file format. Only .csv, .xlsx, or .xls are supported.")
        rates_bytes = await rates_file.read()
        try:
            parsed = parse_rates_file(rates_bytes, rates_file.filename)
            custom_rates = {k: v["rate"] for k, v in parsed.items()}
        except Exception as e:
            print("Warning: failed to parse uploaded rates:", e)

    # 3. Autonomous Takeoff & BOQ Generation
    try:
        project_data = process_uploaded_drawing_package(
            pdf_bytes=pdf_bytes,
            filename=drawing_file.filename,
            project_title=title,
            client=client,
            designer=designer,
            place=place,
            custom_rates=custom_rates
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process drawing package: {str(exc)}")

    # 4. Save project to SQLite under the authenticated user
    code_slug = re.sub(r"[^a-zA-Z0-9]", "", title.lower())[:12] or "proj"
    project_id = save_project_for_user(
        user_id=user["id"],
        code=code_slug,
        title=title,
        client=client,
        designer=designer,
        place=place,
        data_dict=project_data
    )

    # 5. Process optional Client BOQ for comparison
    comparison_summary = None
    if boq_file and boq_file.filename:
        b_fn = boq_file.filename.lower()
        if b_fn.endswith((".xlsx", ".xls", ".csv")):
            boq_bytes = await boq_file.read()
            try:
                client_lines = parse_client_boq(boq_bytes, boq_file.filename)
                cmp_data = compare_boqs(client_lines, project_data)
                save_boq_comparison(user["id"], project_id, boq_file.filename, cmp_data)
                comparison_summary = cmp_data.get("summary")
            except Exception as e:
                print("Warning: failed to parse comparison BOQ:", e)

    return {
        "success": True,
        "project_id": project_id,
        "title": title,
        "sheets_count": len(project_data.get("sheets", [])),
        "items_count": len(project_data.get("items", [])),
        "comparison": comparison_summary
    }


# ------------------------------------------------------------- RATES & COMPARISON

@app.post("/api/projects/{project_id}/rates")
async def upload_project_rates(
    project_id: str,
    rates_file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload CSV or Excel rates schedule to update an existing project's pricing."""
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    fn = rates_file.filename.lower()
    if not (fn.endswith(".csv") or fn.endswith((".xlsx", ".xls"))):
        raise HTTPException(status_code=400, detail="Unsupported format. Only .csv, .xlsx, and .xls rate schedules are accepted.")

    content = await rates_file.read()
    try:
        new_rates = parse_rates_file(content, rates_file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse rates: {str(e)}")

    # Update project rates dictionary
    p_data = proj["data"]
    existing_rates = p_data.get("rates", {})
    for k, v in new_rates.items():
        existing_rates[k] = v
    p_data["rates"] = existing_rates

    update_project_data(project_id, user["id"], p_data)

    return {
        "success": True,
        "updated_rates_count": len(new_rates),
        "rates": existing_rates
    }


@app.post("/api/projects/{project_id}/rates/manual")
def update_or_add_manual_rate(
    project_id: str,
    payload: dict,
    user: dict = Depends(get_current_user)
):
    """Manually update or add an individual rate item in the project rate library."""
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    rate_val = payload.get("rate")
    if rate_val is None:
        raise HTTPException(status_code=400, detail="Rate value is required")

    key = payload.get("key") or re.sub(r"[^a-zA-Z0-9]+", "-", payload.get("en", "rate").lower()).strip("-")
    if not key:
        key = f"rate-{uuid.uuid4().hex[:6]}"

    p_data = proj["data"]
    rates = p_data.get("rates", {})

    existing = rates.get(key, {})
    if isinstance(existing, dict):
        updated_item = {
            "rate": float(rate_val),
            "unit": payload.get("unit") or existing.get("unit") or "m³",
            "en": payload.get("en") or existing.get("en") or key,
            "az": payload.get("az") or existing.get("az") or payload.get("en") or key,
            "group": payload.get("group") or existing.get("group") or "Custom rates"
        }
    else:
        updated_item = {
            "rate": float(rate_val),
            "unit": payload.get("unit", "m³"),
            "en": payload.get("en", key),
            "az": payload.get("az", payload.get("en", key)),
            "group": payload.get("group", "Custom rates")
        }

    rates[key] = updated_item
    p_data["rates"] = rates
    update_project_data(project_id, user["id"], p_data)

    return {
        "success": True,
        "key": key,
        "rate": updated_item,
        "all_rates": rates
    }


@app.post("/api/projects/{project_id}/compare")
async def upload_comparison_boq(
    project_id: str,
    boq_file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload client Excel/CSV BOQ to compare against the project's generated quantities."""
    proj = get_project_for_user(project_id, user["id"])
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    fn = boq_file.filename.lower()
    if not (fn.endswith((".xlsx", ".xls")) or fn.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Unsupported BOQ format. Please upload .xlsx or .csv.")

    content = await boq_file.read()
    try:
        client_lines = parse_client_boq(content, boq_file.filename)
        cmp_data = compare_boqs(client_lines, proj["data"])
        save_boq_comparison(user["id"], project_id, boq_file.filename, cmp_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to compare BOQ: {str(e)}")

    return {
        "success": True,
        "filename": boq_file.filename,
        "summary": cmp_data["summary"],
        "lines": cmp_data["lines"]
    }


@app.get("/api/projects/{project_id}/comparison")
def get_comparison(project_id: str, user: dict = Depends(get_current_user)):
    """Fetch the latest BOQ comparison results for a project."""
    res = get_latest_boq_comparison(project_id, user["id"])
    if not res:
        return {"has_comparison": False, "summary": None, "lines": []}
    return {
        "has_comparison": True,
        "filename": res.get("filename"),
        "created_at": res.get("created_at"),
        "summary": res["comparison"].get("summary"),
        "lines": res["comparison"].get("lines", [])
    }


# Mount built React frontend for full-stack unified deployment on Render / VPS / Docker
DIST_DIR = Path(__file__).resolve().parents[1] / "app" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
