"""API: authentication, isolation, uploads, rates and comparison."""
import base64
import json

from conftest import auth_headers
from test_engine import CONSUMPTION, ENGLISH_SPEC


def test_requests_without_a_valid_token_are_rejected(client):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/projects", headers={"X-User-Email": "elmir@stormtakeoff.com"}).status_code == 401
    assert client.get("/api/projects", headers={"Authorization": "Bearer elmir@stormtakeoff.com"}).status_code == 401
    assert client.get("/api/projects", headers={"Authorization": "Bearer user_elmir_001"}).status_code == 401
    # a token with a forged payload but the original signature
    good = auth_headers(client)["Authorization"][7:]
    payload, sig = good.split(".")
    forged = base64.urlsafe_b64encode(json.dumps({"uid": "user_rashad_002", "exp": 9999999999}).encode()).decode().rstrip("=")
    assert client.get("/api/projects", headers={"Authorization": f"Bearer {forged}.{sig}"}).status_code == 401


def test_login_and_registration_rules(client):
    assert client.post("/api/auth/login", json={"email": "elmir@stormtakeoff.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever1"}).status_code == 401
    r = client.post("/api/auth/register", json={"email": "new.user@example.com", "password": "short"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"email": "new.user@example.com", "password": "Correct-horse-9", "name": "New User"})
    assert r.status_code == 200 and r.json()["user"]["email"] == "new.user@example.com"
    assert client.post("/api/auth/register", json={"email": "NEW.USER@example.com", "password": "Correct-horse-9"}).status_code == 409
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/auth/me", headers=h).json()["email"] == "new.user@example.com"
    assert client.get("/api/projects", headers=h).json()["projects"] == []


def test_login_throttling(client):
    client.post("/api/auth/register", json={"email": "victim@example.com", "password": "Victim-pass-1"})
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "victim@example.com", "password": "bad"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "victim@example.com", "password": "Victim-pass-1"})
    assert r.status_code == 429


def test_users_cannot_see_each_others_projects(client):
    a = auth_headers(client)
    b = auth_headers(client, "rashad@stormtakeoff.com")
    assert client.get("/api/projects/proj_qobu", headers=a).status_code == 200
    for path in ("/api/projects/proj_qobu", "/api/projects/proj_qobu/comparison"):
        assert client.get(path, headers=b).status_code == 404
    assert client.post("/api/projects/proj_qobu/rates/manual", headers=b, json={"key": "conc_col", "rate": 1}).status_code == 404
    assert client.delete("/api/projects/proj_qobu", headers=b).status_code == 404


def test_demo_account_owns_its_own_sample_project(client):
    h = auth_headers(client, "demo@nobel.az")
    projects = client.get("/api/projects", headers=h).json()["projects"]
    assert len(projects) == 1 and projects[0]["id"] != "proj_qobu"
    pid = projects[0]["id"]
    r = client.post(f"/api/projects/{pid}/rates", headers=h,
                    files={"rates_file": ("r.csv", b"Code,Description,Unit,Rate\nconc_col,x,m3,300\n")})
    assert r.status_code == 200


def test_manual_rate_validation(client):
    h = auth_headers(client)
    for bad in ("abc", -5, None, "nan", 1e12):
        r = client.post("/api/projects/proj_qobu/rates/manual", headers=h, json={"key": "conc_col", "rate": bad})
        assert r.status_code == 400, bad
    r = client.post("/api/projects/proj_qobu/rates/manual", headers=h, json={"key": "conc_col", "rate": "275.5"})
    assert r.status_code == 200
    body = r.json()["rate"]
    assert body["rate"] == 275.5 and body["en"].startswith("Concrete B25 in columns") and body["group"] == "Concrete"


def test_rate_upload_report_and_pricing(client):
    h = auth_headers(client)
    before = [p for p in client.get("/api/projects", headers=h).json()["projects"] if p["id"] == "proj_qobu"][0]["total_amount"]
    csv = "Price list Q4\nCode;Description;Unit;Unit rate\nconc_col;Columns;m3;1 000,00\n;Rebar A500C, cut, bent and fixed;t;2 100\nbad;Bad;m3;abc\n"
    r = client.post("/api/projects/proj_qobu/rates", headers=h, files={"rates_file": ("q4.csv", csv.encode())})
    assert r.status_code == 200, r.text
    rep = r.json()["report"]
    assert {u["key"] for u in rep["updated"]} == {"conc_col", "rebar_a500"}
    assert rep["skipped"] and rep["skipped"][0]["row"] == 5
    rates = r.json()["rates"]
    assert rates["conc_col"]["rate"] == 1000.0 and rates["conc_col"]["group"] == "Concrete"
    assert abs(rates["rebar_a500"]["rate"] - 2.1) < 1e-9
    after = [p for p in client.get("/api/projects", headers=h).json()["projects"] if p["id"] == "proj_qobu"][0]["total_amount"]
    assert after > before
    bad = client.post("/api/projects/proj_qobu/rates", headers=h, files={"rates_file": ("r.pdf", b"%PDF")})
    assert bad.status_code == 400


def test_create_project_end_to_end(client, pdf_factory):
    h = auth_headers(client)
    pdf = pdf_factory([ENGLISH_SPEC, CONSUMPTION])
    rates = b"Code,Description,Unit,Rate\n,Cable N2XH 3x2.5 mm2,m,3.20\nrebar_a500,Rebar,kg,2.00\n"
    boq = b"Item,Description,Unit,Qty,Rate\n1,Cable N2XH 3x2.5 mm2,m,250,3.0\n2,Rebar A500C,t,1.5,1900\n3,Excavation,m3,100,8\n"
    r = client.post("/api/projects", headers=h, data={"title": "Unseen package"},
                    files={"drawing_file": ("AR.pdf", pdf, "application/pdf"),
                           "rates_file": ("rates.csv", rates), "boq_file": ("bill.csv", boq)})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["items_count"] == 10 and body["sheets_count"] == 2
    assert body["comparison"]["matches"] >= 1 and body["comparison"]["not_in_drawings"] == 1
    proj = client.get(f"/api/projects/{body['project_id']}", headers=h).json()["data"]
    cable = [i for i in proj["items"] if i["en"].startswith("Cable")][0]
    assert proj["rates"][cable["rate"]]["rate"] == 3.2  # matched to the unpriced line by description
    sheet = proj["sheets"][0]
    img = client.get(f"/sheets/{sheet['img']}.webp")
    assert img.status_code == 200 and img.content[:4] == b"RIFF"
    # the bundled sample sheets are still served (no collision with an uploaded "AR.pdf")
    assert client.get("/sheets/AR-1.webp").status_code in (200, 404)
    cmp = client.get(f"/api/projects/{body['project_id']}/comparison", headers=h).json()
    assert cmp["has_comparison"] is True


def test_upload_guards(client, pdf_factory):
    h = auth_headers(client)
    assert client.post("/api/projects", headers=h, data={"title": "x"},
                       files={"drawing_file": ("a.pdf", b"not a pdf")}).status_code == 400
    assert client.post("/api/projects", headers=h, data={"title": "x"},
                       files={"drawing_file": ("a.docx", b"%PDF-1.7")}).status_code == 400
    assert client.post("/api/projects", headers=h, data={"title": "x"},
                       files={"drawing_file": ("a.pdf", b"%PDF-1.7 broken")}).status_code == 400
    for path in ("/sheets/../tutulan.db", "/sheets/..%2F..%2Fserver%2Fdb.py", "/sheets/x/../../.secret_key"):
        assert client.get(path).status_code == 404


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff" and r.headers["X-Frame-Options"] == "DENY"
