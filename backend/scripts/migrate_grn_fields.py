"""
Migration: Add PO, Invoice, date_format, issued_to_production fields to batches table.
Also adds ISSUED_TO_PRODUCTION to batchstatus enum.

Run with:
    cd backend
    python scripts/migrate_grn_fields.py
"""
import os
import psycopg2
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

# Swap internal hostname for external (needed when running locally)
DATABASE_URL = DATABASE_URL.replace(
    "dpg-d8i18ar7uimc73a90s4g-a/",
    "dpg-d8i18ar7uimc73a90s4g-a.oregon-postgres.render.com/",
)

parsed = urlparse(DATABASE_URL)
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    dbname=parsed.path.lstrip("/"),
    user=parsed.username,
    password=parsed.password,
    sslmode="require",
)
conn.autocommit = False
cur = conn.cursor()

print("Connected. Running migration...")

steps = [
    # Enum value
    "ALTER TYPE batchstatus ADD VALUE IF NOT EXISTS 'ISSUED_TO_PRODUCTION'",

    # New batch columns
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS po_number VARCHAR(100)",
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS po_date DATE",
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)",
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS invoice_date DATE",
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD-MM-YYYY'",
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS issued_to_production BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP",
]

for sql in steps:
    print(f"  → {sql[:80]}...")
    # ALTER TYPE ADD VALUE cannot run inside a transaction block
    if "ADD VALUE" in sql:
        conn.autocommit = True
        cur.execute(sql)
        conn.autocommit = False
    else:
        cur.execute(sql)

conn.commit()
cur.close()
conn.close()
print("Migration complete.")
