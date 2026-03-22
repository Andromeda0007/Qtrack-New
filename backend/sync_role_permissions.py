"""
Apply missing role→permission links from seed.ROLE_PERMISSION_MAP.

Use when the app returns 403 (e.g. CREATE_PRODUCT) but seed.py already lists the
permission for that role — your DB was likely seeded before the mapping existed.

Run from backend folder:
  python sync_role_permissions.py

Safe to run multiple times (only inserts missing links).
"""
import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Role, Permission, RolePermission
from seed import ROLE_PERMISSION_MAP


async def main() -> None:
    async with AsyncSessionLocal() as db:
        roles_result = await db.execute(select(Role))
        roles = {r.role_name: r for r in roles_result.scalars().all()}

        perms_result = await db.execute(select(Permission))
        perms = {p.permission_code: p for p in perms_result.scalars().all()}

        added = 0
        for role_name, codes in ROLE_PERMISSION_MAP.items():
            role = roles.get(role_name)
            if not role:
                continue
            for code in codes:
                perm = perms.get(code)
                if not perm:
                    print(f"Skip {role_name} -> {code}: permission row missing (run seed.py first)")
                    continue
                existing = await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )
                if existing.scalar_one_or_none():
                    continue
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))
                added += 1
                print(f"Added {role_name} -> {code}")

        await db.commit()
        print(f"Done. Added {added} role-permission link(s).")


if __name__ == "__main__":
    asyncio.run(main())
