"""
Phase 2 FG migration: adds fgtn_number, pack_size_count, pack_size_unit to finished_goods_batches.

DRY_RUN=True  → prints what would execute, no changes
DRY_RUN=False → executes against the DB

Run: python backend/scripts/migrate_fg_phase2.py
"""
import os, sys, re

DRY_RUN = True  # set to False once you've reviewed the output

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed — run: pip install psycopg2-binary")
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
db_url = re.sub(r'(dpg-[a-z0-9]+-a)/', r'\1.singapore-postgres.render.com/', db_url)
if not db_url:
    print("DATABASE_URL not set"); sys.exit(1)

STATEMENTS = [
    "ALTER TABLE finished_goods_batches ADD COLUMN IF NOT EXISTS fgtn_number VARCHAR(100)",
    "ALTER TABLE finished_goods_batches ADD COLUMN IF NOT EXISTS pack_size_count INTEGER",
    "ALTER TABLE finished_goods_batches ADD COLUMN IF NOT EXISTS pack_size_unit VARCHAR(50)",
]

if DRY_RUN:
    print("DRY RUN — would execute:\n")
    for s in STATEMENTS:
        print(f"  {s};")
    print("\nSet DRY_RUN=False to apply.")
    sys.exit(0)

conn = psycopg2.connect(db_url)
conn.autocommit = False
cur = conn.cursor()

print("Applying FG Phase 2 migration:\n")
for stmt in STATEMENTS:
    print(f"  {stmt};")
    cur.execute(stmt)

conn.commit()
cur.close()
conn.close()
print("\nDone.")
