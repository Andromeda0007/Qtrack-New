#!/usr/bin/env python3
"""
Reset labels_printed = FALSE for all batches.

Dry-run by default. Pass --apply to commit.

Usage:
    python3 backend/scripts/reset_labels_printed.py
    python3 backend/scripts/reset_labels_printed.py --apply
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import psycopg2

raw_url = os.getenv("DATABASE_URL", "")
pg_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")

apply = "--apply" in sys.argv

SQL = "UPDATE batches SET labels_printed = FALSE;"

print(f"{'[DRY RUN] ' if not apply else ''}Would run:\n  {SQL}")
if not apply:
    print("Pass --apply to execute.")
    sys.exit(0)

conn = psycopg2.connect(pg_url)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute(SQL)
    print(f"Rows updated: {cur.rowcount}")
conn.close()
print("Done.")
