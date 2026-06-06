"""
Seed one user per role with clear passwords.
Safe to re-run — skips users that already exist.

Run: python scripts/seed_all_role_users.py
"""
import os, sys, asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

# Swap to external hostname for local runs
raw = os.environ.get("DATABASE_URL", "")
os.environ["DATABASE_URL"] = raw.replace(
    "dpg-d8i3qsldt1ts73ethv50-a/",
    "dpg-d8i3qsldt1ts73ethv50-a.singapore-postgres.render.com/",
)

from app.database import engine, AsyncSessionLocal
from app.models import Role, User
from app.utils.password import hash_password
from sqlalchemy import select
from datetime import datetime

USERS = [
    # username         password          role               name
    ("Andromeda007",   "andromeda@123",  "WAREHOUSE_HEAD",  "Andromeda"),
    ("ankit007",       "Ankit@007",      "WAREHOUSE_USER",  "Ankit Kumar"),
    ("qc_exec01",      "QcExec@123",     "QC_EXECUTIVE",    "Ravi Sharma"),
    ("qc_head01",      "QcHead@123",     "QC_HEAD",         "Priya Mehta"),
    ("qa_exec01",      "QaExec@123",     "QA_EXECUTIVE",    "Neha Gupta"),
    ("qa_head01",      "QaHead@123",     "QA_HEAD",         "Suresh Patel"),
    ("prod_user01",    "Prod@123",       "PRODUCTION_USER", "Deepak Rao"),
    ("purchase01",     "Purchase@123",   "PURCHASE_USER",   "Kavya Singh"),
]

async def run():
    async with AsyncSessionLocal() as db:
        # Build role_name → id map
        result = await db.execute(select(Role))
        role_map = {r.role_name: r.id for r in result.scalars().all()}

        print(f"{'Username':<20} {'Role':<20} {'Password':<20} {'Status'}")
        print("-" * 72)

        for username, password, role_name, name in USERS:
            role_id = role_map.get(role_name)
            if not role_id:
                print(f"{username:<20} {role_name:<20} {'—':<20} ROLE NOT FOUND")
                continue

            existing = await db.execute(select(User).where(User.username == username))
            user = existing.scalar_one_or_none()

            if user:
                user.password_hash = hash_password(password)
                user.is_active = True
                user.role_id = role_id
                user.updated_at = datetime.utcnow()
                status = "updated"
            else:
                user = User(
                    name=name,
                    username=username,
                    email=f"{username.lower()}@qtrack.local",
                    phone=1234567890,
                    password_hash=hash_password(password),
                    role_id=role_id,
                    is_active=True,
                    is_first_login=False,
                    failed_login_attempts=0,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(user)
                status = "created"

            print(f"{username:<20} {role_name:<20} {password:<20} {status}")

        await db.commit()
        print("\nDone.")

asyncio.run(run())
