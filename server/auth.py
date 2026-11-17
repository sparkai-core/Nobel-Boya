"""Session tokens and login throttling.

Tokens are HMAC-SHA256 signed, carry the user id and an expiry, and are checked on
every request. The signing key comes from SECRET_KEY, or is generated once and kept
in DATA_DIR/.secret_key (readable by the server user only).
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from db import DATA_DIR

TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_HOURS", "12")) * 3600
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,24}$")
MIN_PASSWORD = 8


def _load_secret() -> bytes:
    env = os.getenv("SECRET_KEY")
    if env:
        return env.encode("utf-8")
    path = Path(DATA_DIR) / ".secret_key"
    if path.exists():
        return path.read_bytes().strip()
    key = secrets.token_hex(32).encode("ascii")
    path.write_bytes(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


_SECRET = _load_secret()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue_token(user_id: str) -> Tuple[str, int]:
    exp = int(time.time()) + TOKEN_TTL_SECONDS
    payload = _b64(json.dumps({"uid": user_id, "exp": exp, "n": secrets.token_hex(6)}, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_SECRET, payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{sig}", exp


def verify_token(token: str) -> Optional[str]:
    """Return the user id for a valid, unexpired token, else None."""
    try:
        payload, sig = token.split(".", 1)
        expect = _b64(hmac.new(_SECRET, payload.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(expect, sig):
            return None
        data = json.loads(_unb64(payload))
        if int(data.get("exp", 0)) < time.time():
            return None
        uid = data.get("uid")
        return uid if isinstance(uid, str) else None
    except (ValueError, json.JSONDecodeError, TypeError):
        return None


def validate_email(email: str) -> bool:
    return bool(EMAIL_RE.match(email or ""))


def password_problem(pw: str) -> Optional[str]:
    if not pw or len(pw) < MIN_PASSWORD:
        return f"Use a password of at least {MIN_PASSWORD} characters."
    if len(pw) > 256:
        return "Password is too long."
    if pw.isdigit() or pw.lower() in {"password", "password1", "12345678", "qwertyui"}:
        return "Choose a less common password."
    return None


class LoginThrottle:
    """At most MAX_FAILURES failed logins per email and per IP in WINDOW seconds."""
    MAX_FAILURES = 5
    WINDOW = 15 * 60

    def __init__(self):
        self._fails: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> List[float]:
        lst = [t for t in self._fails.get(key, []) if now - t < self.WINDOW]
        self._fails[key] = lst
        return lst

    def blocked(self, email: str, ip: str) -> int:
        """Seconds until the next attempt is allowed (0 if allowed)."""
        now = time.time()
        with self._lock:
            waits = []
            for key in (f"e:{email}", f"i:{ip}"):
                lst = self._recent(key, now)
                limit = self.MAX_FAILURES if key.startswith("e:") else self.MAX_FAILURES * 4
                if len(lst) >= limit:
                    waits.append(int(self.WINDOW - (now - lst[0])) + 1)
            return max(waits, default=0)

    def fail(self, email: str, ip: str) -> None:
        now = time.time()
        with self._lock:
            for key in (f"e:{email}", f"i:{ip}"):
                self._recent(key, now).append(now)

    def success(self, email: str) -> None:
        with self._lock:
            self._fails.pop(f"e:{email}", None)


throttle = LoginThrottle()
