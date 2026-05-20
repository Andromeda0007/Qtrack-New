"""
Migration: Add RETEST_TRANSFERRED to batchstatus enum + retest columns to grn table.
Also seeds RETEST_TO_QUARANTINE permission for WAREHOUSE_USER and WAREHOUSE_HEAD.
Safe to re-run (idempotent guards on all changes).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment")

conn_str = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgres://", "postgresql://", 1)

conn = psycopg2.connect(conn_str)
conn.autocommit = True
cur = conn.cursor()

print("Running migration: RETEST_TRANSFERRED + GRN retest columns + RETEST_TO_QUARANTINE permission")

# 1. Add RETEST_TRANSFERRED to batchstatus enum
cur.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'RETEST_TRANSFERRED'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'batchstatus')
        ) THEN
            ALTER TYPE batchstatus ADD VALUE 'RETEST_TRANSFERRED' AFTER 'QUARANTINE_RETEST';
        END IF;
    END$$;
""")
print("  OK RETEST_TRANSFERRED enum value ensured")

# 2. Add retest columns to grn table
cur.execute("""
    ALTER TABLE grn ADD COLUMN IF NOT EXISTS retest_number INTEGER;
""")
print("  OK grn.retest_number ensured")

cur.execute("""
    ALTER TABLE grn ADD COLUMN IF NOT EXISTS original_batch_id INTEGER;
""")
print("  OK grn.original_batch_id ensured")

cur.execute("""
    ALTER TABLE grn ADD COLUMN IF NOT EXISTS is_retest_grn BOOLEAN DEFAULT FALSE;
""")
print("  OK grn.is_retest_grn ensured")

# 3. Seed RETEST_TO_QUARANTINE permission
cur.execute("""
    INSERT INTO permissions (permission_code, description, created_at)
    VALUES ('RETEST_TO_QUARANTINE', 'Transfer batch from Retesting to Quarantine with new GRN', NOW())
    ON CONFLICT (permission_code) DO NOTHING;
""")
print("  OK RETEST_TO_QUARANTINE permission ensured")

# 4. Assign to WAREHOUSE_USER
cur.execute("""
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.role_name = 'WAREHOUSE_USER'
      AND p.permission_code = 'RETEST_TO_QUARANTINE'
      AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
      );
""")
print("  OK RETEST_TO_QUARANTINE assigned to WAREHOUSE_USER")

# 5. Assign to WAREHOUSE_HEAD
cur.execute("""
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.role_name = 'WAREHOUSE_HEAD'
      AND p.permission_code = 'RETEST_TO_QUARANTINE'
      AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
      );
""")
print("  OK RETEST_TO_QUARANTINE assigned to WAREHOUSE_HEAD")

cur.close()
conn.close()
print("Migration complete.")
