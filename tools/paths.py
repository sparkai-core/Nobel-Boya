"""Common path resolution for Qobu drawing PDFs and data targets."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "BP": "Qobu Bas plan28.09.2026.pdf",
    "AR": "Qobu inzibati bina ve anbar 28.09.2026.pdf",
    "KS": "Qobu konstruksiya.pdf",
    "MEP": "Qobu kommunikasiya \xfcmumi.pdf",
}

def resolve_pdf(code_or_name: str) -> Path:
    """Resolve drawing PDF path, searching drawings/ first, then ROOT with unicode fallback."""
    filename = FILES.get(code_or_name, code_or_name)
    search_dirs = [ROOT / "drawings", ROOT]
    for d in search_dirs:
        p = d / filename
        if p.exists():
            return p
        # Fuzzy match for unicode filenames like ümumi
        if d.exists():
            prefix = filename[:12]
            for f in d.glob("*.pdf"):
                if f.name.startswith(prefix):
                    return f
    raise FileNotFoundError(f"Drawing for '{code_or_name}' ({filename}) not found in {[str(d) for d in search_dirs]}")

