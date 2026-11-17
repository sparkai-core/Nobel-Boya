"""SQLite storage. Every project query is scoped to the owning user's id."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "tutulan.db"
QOBU_JSON_PATH = Path(__file__).resolve().parents[1] / "app" / "src" / "data" / "qobu.json"

PBKDF2_ITERATIONS = 310_000


def get_db():
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


# ------------------------------------------------------------------ passwords

def hash_pw(pw: str) -> str:
    """Salted PBKDF2-SHA256, stored as pbkdf2_sha256$iterations$salt$hash."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt.encode("ascii"), PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def check_pw(stored_hash: str, raw_pw: str) -> bool:
    if not stored_hash or raw_pw is None:
        return False
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iters, salt, digest = stored_hash.split("$", 3)
            calc = hashlib.pbkdf2_hmac("sha256", raw_pw.encode("utf-8"), salt.encode("ascii"), int(iters)).hex()
        except (ValueError, TypeError):
            return False
        return hmac.compare_digest(calc, digest)
    # legacy unsalted sha256 hashes from earlier versions; upgraded on the next successful login
    legacy = hashlib.sha256(raw_pw.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)


def needs_rehash(stored_hash: str) -> bool:
    return not (stored_hash or "").startswith(f"pbkdf2_sha256${PBKDF2_ITERATIONS}$")


def set_password(user_id: str, raw_pw: str) -> None:
    conn = get_db()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_pw(raw_pw), user_id))
    conn.commit()
    conn.close()


# ------------------------------------------------------------------- schema

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Quantity Surveyor',
        created_at TEXT NOT NULL
    )""")
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
    )""")
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
    )""")
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
    )""")
    cols = {r["name"] for r in cur.execute("PRAGMA table_info(projects)").fetchall()}
    if "asset_dir" not in cols:
        cur.execute("ALTER TABLE projects ADD COLUMN asset_dir TEXT")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cmp_project ON boq_comparisons(project_id, user_id, created_at)")
    conn.commit()

    if os.getenv("SEED_DEMO", "1") != "0":
        _seed_demo(conn)
    conn.close()


DEMO_USERS = [
    ("user_elmir_001", "elmir@stormtakeoff.com", "Elmir Məmmədov", "Lead Quantity Surveyor"),
    ("user_rashad_002", "rashad@stormtakeoff.com", "Rəşad Əliyev", "Senior Quantity Surveyor"),
    ("user_demo_003", "demo@nobel.az", "Demo User", "Quantity Surveyor"),
]


def _seed_demo(conn):
    """Demo accounts (password 'demo') each get their own copy of the sample project. Disable with SEED_DEMO=0."""
    cur = conn.cursor()
    qobu_data = QOBU_JSON_PATH.read_text(encoding="utf-8") if QOBU_JSON_PATH.exists() else None
    for uid, email, name, role in DEMO_USERS:
        cur.execute("SELECT id FROM users WHERE lower(email) = lower(?)", (email,))
        row = cur.fetchone()
        if row:
            uid = row["id"]
        else:
            cur.execute("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (uid, email, hash_pw("demo"), name, role, _now()))
        if qobu_data is None or email == "rashad@stormtakeoff.com":
            continue  # rashad keeps an empty workspace to show isolation
        pid = "proj_qobu" if email == "elmir@stormtakeoff.com" else f"proj_qobu_{uid[-3:]}"
        cur.execute("SELECT id FROM projects WHERE id = ?", (pid,))
        if cur.fetchone():
            continue
        p = json.loads(qobu_data).get("project", {})
        now = _now()
        cur.execute("""
            INSERT INTO projects (id, user_id, code, title, title_en, client, designer, issued, place, status, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (pid, uid, "qobu", p.get("name", "Qobu"), p.get("nameEn", "Qobu"), p.get("client", ""), p.get("designer", ""),
                     p.get("issued", ""), p.get("place", ""), "ready", qobu_data, now, now))
    conn.commit()


# -------------------------------------------------------------------- users

def find_user_by_email(email: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE lower(email) = lower(?)", ((email or "").strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def find_user_by_id(user_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(email: str, password: str, name: str, role: str = "Quantity Surveyor") -> Dict[str, Any]:
    uid = f"user_{uuid.uuid4().hex[:12]}"
    conn = get_db()
    conn.execute("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                 (uid, email.strip().lower(), hash_pw(password), name, role, _now()))
    conn.commit()
    conn.close()
    return find_user_by_id(uid)


# ----------------------------------------------------------------- projects

def _bill_total(p_data: Dict[str, Any]) -> float:
    rates = p_data.get("rates", {}) or {}
    works = 0.0
    for it in p_data.get("items", []) or []:
        try:
            q = float(it.get("qty", 0) or 0)
        except (TypeError, ValueError):
            continue
        r_val = rates.get(it.get("rate", ""), {})
        try:
            rate_num = float(r_val.get("rate", 0) if isinstance(r_val, dict) else (r_val or 0))
        except (TypeError, ValueError):
            rate_num = 0.0
        works += q * rate_num
    # default markups: 8% overheads, 6% profit, 5% contingency, 18% VAT, compounded
    return round(works * 1.08 * 1.06 * 1.05 * 1.18, 2)


def list_user_projects(user_id: str):
    conn = get_db()
    rows = conn.execute("""
        SELECT id, code, title, title_en, client, designer, issued, place, status, data_json, created_at, updated_at, asset_dir
        FROM projects WHERE user_id = ? ORDER BY created_at DESC""", (user_id,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        raw_json = d.pop("data_json", "{}")
        try:
            p_data = json.loads(raw_json)
        except json.JSONDecodeError:
            p_data = {}
        sheets = p_data.get("sheets", []) or []
        d["cover_sheets"] = [s.get("id") for s in sheets[:4] if s.get("id")]
        d["cover_images"] = [s.get("img") or s.get("id") for s in sheets[:4] if s.get("id")]
        d["sheets_count"] = len(sheets)
        d["items_count"] = len(p_data.get("items", []) or [])
        d["documents_count"] = len(p_data.get("documents", []) or [])
        d["documents"] = p_data.get("documents", []) or []
        d["total_amount"] = _bill_total(p_data)
        out.append(d)
    conn.close()
    return out


def get_project_for_user(project_id: str, user_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["data"] = json.loads(d.pop("data_json"))
    return d


def save_project_for_user(user_id: str, code: str, title: str, client: str, designer: str, place: str,
                          data_dict: dict, project_id: Optional[str] = None, asset_dir: Optional[str] = None):
    conn = get_db()
    now = _now()
    pid = project_id or f"proj_{uuid.uuid4().hex[:12]}"
    conn.execute("""
        INSERT INTO projects (id, user_id, code, title, title_en, client, designer, issued, place, status, data_json, created_at, updated_at, asset_dir)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (pid, user_id, code, title, data_dict.get("project", {}).get("nameEn", title), client, designer,
                  data_dict.get("project", {}).get("issued", datetime.now().strftime("%d.%m.%Y")), place, "ready",
                  json.dumps(data_dict, ensure_ascii=False), now, now, asset_dir))
    conn.commit()
    conn.close()
    return pid


def update_project_data(project_id: str, user_id: str, data_dict: dict):
    conn = get_db()
    conn.execute("UPDATE projects SET data_json = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                 (json.dumps(data_dict, ensure_ascii=False), _now(), project_id, user_id))
    conn.commit()
    conn.close()


def save_boq_comparison(user_id: str, project_id: str, filename: str, comparison_dict: dict):
    conn = get_db()
    cid = f"cmp_{uuid.uuid4().hex[:12]}"
    conn.execute("""
        INSERT INTO boq_comparisons (id, user_id, project_id, filename, comparison_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)""", (cid, user_id, project_id, filename, json.dumps(comparison_dict, ensure_ascii=False), _now()))
    conn.commit()
    conn.close()
    return cid


def get_latest_boq_comparison(project_id: str, user_id: str):
    conn = get_db()
    row = conn.execute("""
        SELECT * FROM boq_comparisons WHERE project_id = ? AND user_id = ?
        ORDER BY created_at DESC LIMIT 1""", (project_id, user_id)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["comparison"] = json.loads(d["comparison_json"])
    return d


if __name__ == "__main__":
    init_db()
    print("Database initialized at:", DB_PATH)
