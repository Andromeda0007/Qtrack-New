"""
Migration: FG Flow
- Add FG_ALERT to notificationtype postgres enum
- Add APPROVE_FG and REJECT_FG permissions to QA_EXECUTIVE role
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # 1. Add FG_ALERT to the postgres notificationtype enum
        await conn.execute(text(
            "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'FG_ALERT';"
        ))
        print("Added FG_ALERT to notificationtype enum.")

        # 2. Ensure APPROVE_FG and REJECT_FG permissions exist
        for code in ("APPROVE_FG", "REJECT_FG"):
            await conn.execute(text(
                "INSERT INTO permissions (permission_code, description, created_at) "
                "VALUES (:code, :desc, NOW()) ON CONFLICT (permission_code) DO NOTHING;"
            ), {"code": code, "desc": f"{code} permission"})
        print("Ensured APPROVE_FG and REJECT_FG permissions exist.")

        # 3. Link APPROVE_FG and REJECT_FG to QA_EXECUTIVE role
        result = await conn.execute(
            text("SELECT id FROM roles WHERE role_name = 'QA_EXECUTIVE';")
        )
        role_row = result.fetchone()
        if not role_row:
            print("QA_EXECUTIVE role not found — skipping role permission assignment.")
            return

        qa_exec_role_id = role_row[0]

        for code in ("APPROVE_FG", "REJECT_FG"):
            perm_result = await conn.execute(
                text("SELECT id FROM permissions WHERE permission_code = :code;"),
                {"code": code},
            )
            perm_row = perm_result.fetchone()
            if perm_row:
                await conn.execute(text(
                    "INSERT INTO role_permissions (role_id, permission_id) "
                    "VALUES (:rid, :pid) ON CONFLICT DO NOTHING;"
                ), {"rid": qa_exec_role_id, "pid": perm_row[0]})
                print(f"Linked {code} to QA_EXECUTIVE.")

        print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
