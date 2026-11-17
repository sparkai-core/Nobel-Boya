"""SQLite Database & Schema Manager for Storm Takeoff Platform.
Ensures strict multi-tenant data isolation: every query is scoped to user_id.
"""
import sqlite3
import json
import uuid
import hashlib
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "tutulan.db"
QOBU_JSON_PATH = Path(__file__).resolve().parents[1] / "app" / "src" / "data" / "qobu.json"


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()


def init_db():
    conn = get_db()
    cur = conn.cursor()

    # 1. Users Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Quantity Surveyor',
        created_at TEXT NOT NULL
    )
    """)

    # 2. Projects Table (Strictly isolated by user_id)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        title_en TEXT,
        client TEXT,
        designer TEXT,
        issued TEXT,
        place TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 3. User Custom Rates Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_rates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        rate_key TEXT NOT NULL,
        group_name TEXT,
        desc_az TEXT,
        desc_en TEXT,
        unit TEXT NOT NULL,
        rate REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    # 4. BOQ Comparisons Table (Uploaded client BOQ vs AI Generated BOQ)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS boq_comparisons (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        comparison_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    # Seed Default Users
    now = datetime.now(timezone.utc).isoformat()
    u1_id = "user_elmir_001"
    u2_id = "user_rashad_002"

    cur.execute("SELECT id FROM users WHERE email = 'elmir@stormtakeoff.com'")
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (u1_id, "elmir@stormtakeoff.com", hash_pw("demo"), "Elmir Məmmədov", "Lead Quantity Surveyor", now)
        )
        cur.execute(
            "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (u2_id, "rashad@stormtakeoff.com", hash_pw("demo"), "Rəşad Əliyev", "Senior Quantity Surveyor", now)
        )

        # Seed initial Qobu project for User 1 (Elmir) only
        if QOBU_JSON_PATH.exists():
            qobu_data = QOBU_JSON_PATH.read_text(encoding="utf-8")
            qobu_obj = json.loads(qobu_data)
            p = qobu_obj.get("project", {})
            cur.execute("""
            INSERT INTO projects (
                id, user_id, code, title, title_en, client, designer, issued, place, status, data_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "proj_qobu",
                u1_id,
                "qobu",
                p.get("name", "Qobu anbar və inzibati bina"),
                p.get("nameEn", "Qobu warehouse and administration building"),
                p.get("client", "Nobel Energy"),
                p.get("designer", "Proyekt Konstruktor MMC"),
                p.get("issued", "28.09.2026"),
                p.get("place", "Qobu qəs., Abşeron r-nu"),
                "ready",
                qobu_data,
                now,
                now
            ))

    conn.commit()
    conn.close()


def find_user_by_email(email: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email.strip(),))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def find_user_by_id(user_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def list_user_projects(user_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, code, title, title_en, client, designer, issued, place, status, data_json, created_at, updated_at
        FROM projects
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (user_id,))
    rows = []
    for r in cur.fetchall():
        d = dict(r)
        raw_json = d.pop("data_json", "{}")
        try:
            p_data = json.loads(raw_json)
            sheets = [s.get("id") for s in p_data.get("sheets", []) if s.get("id")]
            d["cover_sheets"] = sheets[:4] if sheets else (["BP-7", "AR-10", "KS-7", "MEP-24"] if d["id"] == "proj_qobu" else [])
            d["sheets_count"] = len(sheets) or len(p_data.get("sheets", []))
            d["documents_count"] = len(p_data.get("documents", []))
            # Calculate total bill
            items = p_data.get("items", [])
            rates = p_data.get("rates", {})
            works = 0.0
            for it in items:
                q = float(it.get("qty", 0) or 0)
                rk = it.get("rate", "")
                r_val = rates.get(rk, {})
                rate_num = float(r_val.get("rate", 0) if isinstance(r_val, dict) else (r_val or 0))
                works += q * rate_num
            # Total with standard markups (8% overhead, 6% profit, 5% contingency, 18% VAT) = works * 1.418
            d["total_amount"] = round(works * 1.41804, 2)
            d["documents"] = p_data.get("documents", [])
        except Exception as e:
            d["cover_sheets"] = ["BP-7", "AR-10", "KS-7", "MEP-24"] if d["id"] == "proj_qobu" else []
            d["sheets_count"] = 1
            d["documents_count"] = 1
            d["total_amount"] = 0
            d["documents"] = []
        rows.append(d)
    conn.close()
    return rows


def get_project_for_user(project_id: str, user_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM projects WHERE id = ? AND user_id = ?
    """, (project_id, user_id))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["data"] = json.loads(d["data_json"])
    return d


def save_project_for_user(user_id: str, code: str, title: str, client: str, designer: str, place: str, data_dict: dict, project_id: str = None):
    conn = get_db()
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    pid = project_id or f"proj_{uuid.uuid4().hex[:12]}"
    data_json = json.dumps(data_dict, ensure_ascii=False)

    cur.execute("""
        INSERT INTO projects (
            id, user_id, code, title, title_en, client, designer, issued, place, status, data_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pid,
        user_id,
        code,
        title,
        data_dict.get("project", {}).get("nameEn", title),
        client,
        designer,
        data_dict.get("project", {}).get("issued", datetime.now().strftime("%d.%m.%Y")),
        place,
        "ready",
        data_json,
        now,
        now
    ))
    conn.commit()
    conn.close()
    return pid


def update_project_data(project_id: str, user_id: str, data_dict: dict):
    conn = get_db()
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
        UPDATE projects
        SET data_json = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
    """, (json.dumps(data_dict, ensure_ascii=False), now, project_id, user_id))
    conn.commit()
    conn.close()


def save_boq_comparison(user_id: str, project_id: str, filename: str, comparison_dict: dict):
    conn = get_db()
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cid = f"cmp_{uuid.uuid4().hex[:12]}"
    cur.execute("""
        INSERT INTO boq_comparisons (id, user_id, project_id, filename, comparison_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (cid, user_id, project_id, filename, json.dumps(comparison_dict, ensure_ascii=False), now))
    conn.commit()
    conn.close()
    return cid


def get_latest_boq_comparison(project_id: str, user_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM boq_comparisons
        WHERE project_id = ? AND user_id = ?
        ORDER BY created_at DESC LIMIT 1
    """, (project_id, user_id))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["comparison"] = json.loads(d["comparison_json"])
    return d


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
