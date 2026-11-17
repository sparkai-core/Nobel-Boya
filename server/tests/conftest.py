import os
import sys
import tempfile
from pathlib import Path

# Isolated data directory for every test run: never touches the real database or sheets.
_TMP = tempfile.mkdtemp(prefix="nobel-test-")
os.environ["DATA_DIR"] = _TMP
os.environ["SEED_DEMO"] = "1"
os.environ["OCR_DISABLED"] = "1"
os.environ.setdefault("SECRET_KEY", "test-secret-key")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pymupdf  # noqa: E402
import pytest  # noqa: E402


_FONT = pymupdf.Font("cjk")  # bundled fallback font that covers Azerbaijani letters (ə, ğ, ı, ş)


def add_unicode_font(page):
    page.insert_font(fontname="U", fontbuffer=_FONT.buffer)


def make_pdf(pages, rotation=0, size=(1190, 842)):
    """pages: list of lists of (x, y, text, fontsize). Coordinates are in the page as displayed."""
    doc = pymupdf.open()
    for items in pages:
        # A rotated sheet as CAD exports it: the page carries /Rotate and the text is drawn
        # counter-rotated, so it reads upright on screen at the given displayed coordinates.
        w, h = size if not rotation % 180 else (size[1], size[0])
        page = doc.new_page(width=w, height=h)
        add_unicode_font(page)
        if rotation:
            page.set_rotation(rotation)
        for x, y, text, fs in items:
            pt = pymupdf.Point(x, y) * page.derotation_matrix
            page.insert_text(pt, text, fontsize=fs, fontname="U", rotate=rotation)
    return doc.tobytes()


@pytest.fixture
def pdf_factory():
    return make_pdf


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    import app as app_module
    with TestClient(app_module.app, raise_server_exceptions=False) as c:
        yield c


def auth_headers(client, email="elmir@stormtakeoff.com", password="demo"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
