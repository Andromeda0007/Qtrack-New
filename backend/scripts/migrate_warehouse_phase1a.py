"""
Schema migration for Warehouse Phase 1.A.

Adds:
  - Columns on batches: unit_of_measure, container_count, container_quantity
  - Column on materials: created_by
  - Unique constraint on materials.material_name
  - New tables: batch_containers, grn_counters, item_counter

Safety:
  - Dry run by default (prints SQL, does not commit)
  - Runs inside a single transaction when --apply
  - Idempotent: uses IF NOT EXISTS / IF EXISTS where possible

Usage:
  python scripts/migrate_warehouse_phase1a.py          # dry run
  python scripts/migrate_warehouse_phase1a.py --apply  # commit
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Make `app` importable when running from backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import psycopg2  # noqa: E402

STATEMENTS = [
    # --- batches table ---
    # New column: unit_of_measure (KG | COUNT); default KG for any legacy rows
    """ALTER TABLE batches
         ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'KG';""",

    # container_count: number of physical containers; default 1 for legacy rows
    """ALTER TABLE batches
         ADD COLUMN IF NOT EXISTS container_count INTEGER NOT NULL DEFAULT 1;""",

    # container_quantity: qty per container; legacy default 0
    """ALTER TABLE batches
         ADD COLUMN IF NOT EXISTS container_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0;""",

    # --- materials table ---
    """ALTER TABLE materials
         ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);""",

    # Enforce unique material_name (active set).  Using plain UNIQUE (covers
    # inactive too, which is fine — deactivated names also shouldn't collide
    # with new creations under the same name).
    """DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'uq_materials_material_name'
         ) THEN
           ALTER TABLE materials
             ADD CONSTRAINT uq_materials_material_name UNIQUE (material_name);
         END IF;
       END$$;""",

    # --- batch_containers ---
    """CREATE TABLE IF NOT EXISTS batch_containers (
         id              SERIAL PRIMARY KEY,
         batch_id        INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
         container_number INTEGER NOT NULL,
         unique_code     VARCHAR(60) NOT NULL UNIQUE,
         qr_code_path    VARCHAR(500),
         is_lost         BOOLEAN NOT NULL DEFAULT FALSE,
         created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT uq_batch_container_number UNIQUE (batch_id, container_number)
       );""",

    """CREATE INDEX IF NOT EXISTS ix_batch_containers_batch_id
         ON batch_containers (batch_id);""",

    """CREATE INDEX IF NOT EXISTS ix_batch_containers_unique_code
         ON batch_containers (unique_code);""",

    # --- grn_counters (race-safe yearly GRN numbering) ---
    """CREATE TABLE IF NOT EXISTS grn_counters (
         year         INTEGER PRIMARY KEY,
         last_number  INTEGER NOT NULL DEFAULT 0,
         updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       );""",

    # --- item_counter (single-row ITM-NNN allocator) ---
    """CREATE TABLE IF NOT EXISTS item_counter (
         id           INTEGER PRIMARY KEY DEFAULT 1,
         last_number  INTEGER NOT NULL DEFAULT 0,
         updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT item_counter_single_row CHECK (id = 1)
       );""",

    # Seed the single item_counter row
    """INSERT INTO item_counter (id, last_number)
         VALUES (1, 0)
         ON CONFLICT (id) DO NOTHING;""",
]


def normalize_db_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def main() -> int:
    parser = argparse.ArgumentParser(description="Warehouse Phase 1.A schema migration.")
    parser.add_argument("--apply", action="store_true",
                        help="Commit the migration. Without this flag, prints SQL (dry run).")
    args = parser.parse_args()

    env_path = BACKEND_DIR.parent / ".env"  # repo root .env
    if not env_path.exists():
        env_path = BACKEND_DIR / ".env"
    load_dotenv(env_path)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print(f"ERROR: DATABASE_URL not set (looked in {env_path})", file=sys.stderr)
        return 1

    db_url = normalize_db_url(db_url)

    if not args.apply:
        print("=== DRY RUN — no changes committed ===\n")
        for stmt in STATEMENTS:
            print(stmt.strip())
            print()
        print("=== END DRY RUN. Re-run with --apply to commit. ===")
        return 0

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for stmt in STATEMENTS:
                print(f">> {stmt.strip().splitlines()[0][:80]} ...")
                cur.execute(stmt)
        conn.commit()
        print("\nMigration applied successfully.")
        return 0
    except Exception:
        conn.rollback()
        print("\nMigration FAILED — rolled back.", file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
