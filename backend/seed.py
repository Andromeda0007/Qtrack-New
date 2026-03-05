"""
Seed script: creates tables, default roles, permissions, locations, and Super Admin.
Run: python seed.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine, Base, AsyncSessionLocal
from app.models import (
    Role, Permission, RolePermission, User, Location
)
from app.utils.password import hash_password


ROLES = [
    {"role_name": "SUPER_ADMIN", "description": "System administrator"},
    {"role_name": "WAREHOUSE_USER", "description": "Warehouse operational staff"},
    {"role_name": "WAREHOUSE_HEAD", "description": "Warehouse supervisor"},
    {"role_name": "QC_EXECUTIVE", "description": "Quality Control testing staff"},
    {"role_name": "QC_HEAD", "description": "Quality Control authority"},
    {"role_name": "QA_EXECUTIVE", "description": "Quality Assurance inspection staff"},
    {"role_name": "QA_HEAD", "description": "Quality Assurance authority"},
    {"role_name": "PRODUCTION_USER", "description": "Production department"},
    {"role_name": "PURCHASE_USER", "description": "Purchase department (read-only)"},
]

PERMISSIONS = [
    "CREATE_GRN", "UPDATE_LOCATION", "ISSUE_STOCK", "RECEIVE_FG", "DISPATCH_FG",
    "REVISE_GRN", "REPRINT_LABEL", "APPROVE_CORRECTION",
    "GENERATE_AR_NUMBER", "WITHDRAW_SAMPLE", "SET_UNDER_TEST",
    "APPROVE_MATERIAL", "REJECT_MATERIAL", "SET_RETEST_DATE", "INITIATE_RETEST",
    "APPROVE_GRADE_TRANSFER", "REQUEST_GRADE_TRANSFER",
    "INSPECT_FG", "APPROVE_FG", "REJECT_FG",
    "CREATE_FG_BATCH", "GENERATE_SHIPPER_LABEL",
    "VIEW_STOCK", "VIEW_REPORTS",
    "CREATE_USER", "MANAGE_USERS", "VIEW_AUDIT_LOGS",
    "MANAGE_CHAT", "SEND_MESSAGE",
    "ADJUST_STOCK",
]

ROLE_PERMISSION_MAP = {
    "SUPER_ADMIN": [
        "CREATE_USER", "MANAGE_USERS", "VIEW_AUDIT_LOGS", "VIEW_STOCK",
        "VIEW_REPORTS", "MANAGE_CHAT",
    ],
    "WAREHOUSE_USER": [
        "CREATE_GRN", "UPDATE_LOCATION", "ISSUE_STOCK", "RECEIVE_FG",
        "DISPATCH_FG", "VIEW_STOCK", "SEND_MESSAGE",
    ],
    "WAREHOUSE_HEAD": [
        "CREATE_GRN", "UPDATE_LOCATION", "ISSUE_STOCK", "RECEIVE_FG",
        "DISPATCH_FG", "REVISE_GRN", "REPRINT_LABEL", "APPROVE_CORRECTION",
        "ADJUST_STOCK", "VIEW_STOCK", "VIEW_REPORTS", "SEND_MESSAGE",
        "REQUEST_GRADE_TRANSFER",
    ],
    "QC_EXECUTIVE": [
        "GENERATE_AR_NUMBER", "WITHDRAW_SAMPLE", "SET_UNDER_TEST",
        "VIEW_STOCK", "SEND_MESSAGE", "INITIATE_RETEST",
    ],
    "QC_HEAD": [
        "GENERATE_AR_NUMBER", "WITHDRAW_SAMPLE", "SET_UNDER_TEST",
        "APPROVE_MATERIAL", "REJECT_MATERIAL", "SET_RETEST_DATE",
        "INITIATE_RETEST", "APPROVE_GRADE_TRANSFER", "VIEW_STOCK",
        "VIEW_REPORTS", "SEND_MESSAGE",
    ],
    "QA_EXECUTIVE": [
        "INSPECT_FG", "VIEW_STOCK", "SEND_MESSAGE",
    ],
    "QA_HEAD": [
        "INSPECT_FG", "APPROVE_FG", "REJECT_FG", "VIEW_STOCK",
        "VIEW_REPORTS", "SEND_MESSAGE",
    ],
    "PRODUCTION_USER": [
        "CREATE_FG_BATCH", "GENERATE_SHIPPER_LABEL", "VIEW_STOCK", "SEND_MESSAGE",
    ],
    "PURCHASE_USER": [
        "VIEW_STOCK", "VIEW_REPORTS",
    ],
}

LOCATIONS = [
    {"location_name": "Quarantine Area", "location_type": "QUARANTINE"},
    {"location_name": "QC Testing Lab", "location_type": "TESTING"},
    {"location_name": "Approved Storage", "location_type": "APPROVED"},
    {"location_name": "Rejected Storage", "location_type": "REJECTED"},
    {"location_name": "Production Floor", "location_type": "PRODUCTION"},
    {"location_name": "Finished Goods Storage", "location_type": "FG_STORAGE"},
    {"location_name": "Dispatch Area", "location_type": "DISPATCH"},
]


async def seed():
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    async with AsyncSessionLocal() as db:
        # Seed roles
        role_map = {}
        for r in ROLES:
            existing = await db.execute(
                __import__("sqlalchemy").select(Role).where(Role.role_name == r["role_name"])
            )
            obj = existing.scalar_one_or_none()
            if not obj:
                obj = Role(**r)
                db.add(obj)
                await db.flush()
            role_map[r["role_name"]] = obj
        print(f"Roles seeded: {len(role_map)}")

        # Seed permissions
        perm_map = {}
        for code in PERMISSIONS:
            from sqlalchemy import select
            existing = await db.execute(select(Permission).where(Permission.permission_code == code))
            obj = existing.scalar_one_or_none()
            if not obj:
                obj = Permission(permission_code=code)
                db.add(obj)
                await db.flush()
            perm_map[code] = obj
        print(f"Permissions seeded: {len(perm_map)}")

        # Seed role-permission mapping
        from sqlalchemy import select
        for role_name, perm_codes in ROLE_PERMISSION_MAP.items():
            role = role_map.get(role_name)
            if not role:
                continue
            for code in perm_codes:
                perm = perm_map.get(code)
                if not perm:
                    continue
                existing = await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )
                if not existing.scalar_one_or_none():
                    db.add(RolePermission(role_id=role.id, permission_id=perm.id))
        print("Role-permission mappings seeded.")

        # Seed locations
        for loc in LOCATIONS:
            existing = await db.execute(
                select(Location).where(Location.location_name == loc["location_name"])
            )
            if not existing.scalar_one_or_none():
                db.add(Location(**loc))
        print("Locations seeded.")

        # Seed Super Admin user
        existing = await db.execute(select(User).where(User.username == "superadmin"))
        if not existing.scalar_one_or_none():
            admin_role = role_map.get("SUPER_ADMIN")
            admin = User(
                name="Super Admin",
                username="superadmin",
                email="admin@qtrack.com",
                password_hash=hash_password("Admin@123"),
                role_id=admin_role.id,
                is_first_login=False,
                is_active=True,
            )
            db.add(admin)
            print("Super Admin created: username=superadmin, password=Admin@123")
        else:
            print("Super Admin already exists.")

        await db.commit()
    print("Seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
