"""
Creates one test user per role with simple credentials.
Safe to re-run — skips users that already exist.

Credentials
-----------
Role              Username    Password
WAREHOUSE_HEAD    wh-head     123456   (already exists as Andromeda007 — skipped)
WAREHOUSE_USER    wh          123456
QC_EXECUTIVE      qce         123456
QC_HEAD           qch         123456
QA_EXECUTIVE      qae         123456
QA_HEAD           qah         123456
PRODUCTION_USER   prod        123456
PURCHASE_USER     pur         123456
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import engine, AsyncSessionLocal
from app.models import Role, User
from app.utils.password import hash_password

TEST_USERS = [
    {"role_name": "WAREHOUSE_USER",  "name": "Warehouse User",    "username": "wh",      "email": "wh@qtrack.local"},
    {"role_name": "QC_EXECUTIVE",    "name": "QC Executive",      "username": "qce",     "email": "qce@qtrack.local"},
    {"role_name": "QC_HEAD",         "name": "QC Head",           "username": "qch",     "email": "qch@qtrack.local"},
    {"role_name": "QA_EXECUTIVE",    "name": "QA Executive",      "username": "qae",     "email": "qae@qtrack.local"},
    {"role_name": "QA_HEAD",         "name": "QA Head",           "username": "qah",     "email": "qah@qtrack.local"},
    {"role_name": "PRODUCTION_USER", "name": "Production User",   "username": "prod",    "email": "prod@qtrack.local"},
    {"role_name": "PURCHASE_USER",   "name": "Purchase User",     "username": "pur",     "email": "pur@qtrack.local"},
]

PASSWORD = "123456"


async def main():
    async with AsyncSessionLocal() as db:
        for entry in TEST_USERS:
            # Get role
            r = await db.execute(select(Role).where(Role.role_name == entry["role_name"]))
            role = r.scalar_one_or_none()
            if not role:
                print(f"  SKIP  role {entry['role_name']} not found")
                continue

            # Check if username already exists
            u = await db.execute(select(User).where(User.username == entry["username"]))
            if u.scalar_one_or_none():
                print(f"  SKIP  {entry['username']} already exists")
                continue

            user = User(
                name=entry["name"],
                username=entry["username"],
                email=entry["email"],
                password_hash=hash_password(PASSWORD),
                role_id=role.id,
                is_active=True,
                is_first_login=False,
            )
            db.add(user)
            await db.flush()
            print(f"  OK    username={entry['username']}  role={entry['role_name']}")

        await db.commit()
        print("\nDone.")

asyncio.run(main())
