"""Create a login account, or reset its password, from the command line.

    python create_user.py --email info@boya.az --name "Boya"
    python create_user.py --email info@boya.az --reset-password

The password is asked twice and never echoed, so it does not end up in the shell
history or in any file. Run it where the database lives: locally next to tutulan.db,
or on Render from the service Shell (DATA_DIR=/data is already set there).
Turning ALLOW_SIGNUP off afterwards keeps the site invite-only.
"""
import argparse
import getpass
import os
import sys

# Creating an account must never add the demo accounts as a side effect.
os.environ.setdefault("SEED_DEMO", "0")

from auth import password_problem, validate_email  # noqa: E402
from db import DB_PATH, create_user, find_user_by_email, init_db, set_password  # noqa: E402


def ask_password() -> str:
    if not sys.stdin.isatty():
        # Piped input (e.g. a deploy script): one line, checked like typed input.
        pw = sys.stdin.readline().rstrip("\r\n")
        problem = password_problem(pw)
        if problem:
            raise SystemExit(problem)
        return pw
    while True:
        pw = getpass.getpass("Password: ")
        problem = password_problem(pw)
        if problem:
            print(problem)
            continue
        if getpass.getpass("Repeat password: ") != pw:
            print("The two passwords differ. Try again.")
            continue
        return pw


def main() -> int:
    ap = argparse.ArgumentParser(description="Create a Nobel BOQ login account.")
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", help="Name shown in the app, e.g. the company name")
    ap.add_argument("--role", default="Quantity Surveyor")
    ap.add_argument("--reset-password", action="store_true", help="Set a new password for an existing account")
    args = ap.parse_args()

    email = args.email.strip().lower()
    if not validate_email(email):
        print(f"Not a valid email address: {email}")
        return 1

    init_db()
    existing = find_user_by_email(email)

    if args.reset_password:
        if not existing:
            print(f"No account for {email}.")
            return 1
        set_password(existing["id"], ask_password())
        print(f"Password changed for {email} ({DB_PATH}).")
        return 0

    if existing:
        print(f"{email} already has an account. Use --reset-password to change its password.")
        return 1
    name = (args.name or email.split("@")[0]).strip()
    user = create_user(email, ask_password(), name, args.role)
    print(f"Account created: {user['email']} ({user['name']}) in {DB_PATH}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
