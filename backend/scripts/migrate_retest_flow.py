"""
Migration: Add retesting_number, original_batch_id to batches; create retest_counters table.

Run once against the Render DB (or local). Safe to re-run — uses IF NOT EXISTS / IF NOT EXISTS.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

raw_url = os.environ.get("DATABASE_URL", "")
db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
db_url = db_url.replace("dpg-d7mbsgbbc2fs7385cmg0-a/", "dpg-d7mbsgbbc2fs7385cmg0-a.singapore-postgres.render.com/")

if not db_url:
    print("DATABASE_URL not set")
    sys.exit(1)

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

print("Running retest flow migration...")

cur.execute("""
    ALTER TABLE batches
    ADD COLUMN IF NOT EXISTS retesting_number VARCHAR(50);
""")
print("  [OK] batches.retesting_number")

cur.execute("""
    ALTER TABLE batches
    ADD COLUMN IF NOT EXISTS original_batch_id INTEGER REFERENCES batches(id);
""")
print("  [OK] batches.original_batch_id")

cur.execute("""
    CREATE TABLE IF NOT EXISTS retest_counters (
        year INTEGER PRIMARY KEY,
        last_number INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
""")
print("  [OK] retest_counters table")

cur.close()
conn.close()

print("\nMigration complete.")
