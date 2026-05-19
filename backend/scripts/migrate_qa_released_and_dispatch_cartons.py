"""
Migration: Add QA_RELEASED to fgstatus enum + carton_count to dispatch_records.
Also seeds RELEASE_FG and GENERATE_SHIPPER_LABEL permissions for relevant roles.
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

# psycopg2 expects postgresql:// not postgres://
conn_str = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgres://", "postgresql://", 1)

conn = psycopg2.connect(conn_str)
conn.autocommit = True
cur = conn.cursor()

print("Running migration: QA_RELEASED + dispatch carton_count + RELEASE_FG permission")

# 1. Add QA_RELEASED to the fgstatus enum (IF NOT EXISTS guard)
cur.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'QA_RELEASED'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'fgstatus')
        ) THEN
            ALTER TYPE fgstatus ADD VALUE 'QA_RELEASED' AFTER 'QA_APPROVED';
        END IF;
    END$$;
""")
print("  OK QA_RELEASED enum value ensured")

# 2. Add carton_count to dispatch_records
cur.execute("""
    ALTER TABLE dispatch_records
    ADD COLUMN IF NOT EXISTS carton_count INTEGER;
""")
print("  OK dispatch_records.carton_count ensured")

# 3. Seed RELEASE_FG permission (if not exists)
cur.execute("""
    INSERT INTO permissions (permission_code, description, created_at)
    VALUES ('RELEASE_FG', 'Release approved FG batch for warehouse receipt', NOW())
    ON CONFLICT (permission_code) DO NOTHING;
""")
print("  OK RELEASE_FG permission ensured")

# 4. Assign RELEASE_FG to QA_EXECUTIVE role
cur.execute("""
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.role_name = 'QA_EXECUTIVE'
      AND p.permission_code = 'RELEASE_FG'
      AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
      );
""")
print("  OK RELEASE_FG assigned to QA_EXECUTIVE")

# 5. Ensure GENERATE_SHIPPER_LABEL is on QA_EXECUTIVE (for FG label viewing)
cur.execute("""
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.role_name = 'QA_EXECUTIVE'
      AND p.permission_code = 'GENERATE_SHIPPER_LABEL'
      AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
      );
""")
print("  OK GENERATE_SHIPPER_LABEL assigned to QA_EXECUTIVE")

cur.close()
conn.close()
print("Migration complete.")
