#!/usr/bin/env python3
"""
Migration: add labels_pdf column (BYTEA) to batches.

Dry-run by default. Pass --apply to commit.

Usage:
    python3 backend/scripts/migrate_labels_pdf.py
    python3 backend/scripts/migrate_labels_pdf.py --apply
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import psycopg2

raw_url = os.getenv("DATABASE_URL", "")
pg_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")

apply = "--apply" in sys.argv

SQL = "ALTER TABLE batches ADD COLUMN IF NOT EXISTS labels_pdf BYTEA;"

print(f"{'[DRY RUN] ' if not apply else ''}Would run:\n  {SQL}")
if not apply:
    print("Pass --apply to execute.")
    sys.exit(0)

conn = psycopg2.connect(pg_url)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute(SQL)
conn.close()
print("Done.")
