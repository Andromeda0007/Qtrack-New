"""
Dev-only: wipe raw-material intake data so the Warehouse Phase 1.A schema can be
tested on a clean slate.

What it removes (in FK-safe order):
  - batch_containers, grade_transfers, retest_cycles, qc_results
  - stock_movements, batch_status_history, grn, batches
  - grn_counters (fresh 2026 start)
  - fg_inventory, dispatch_records, qa_inspections, finished_goods_batches
    (FG is meaningless without RM; wipe together)
  - notifications (all — cheap)
  - materials, item_counter (rebuilt via the new item master)

What it preserves:
  - users, roles, permissions, role_permissions, password_reset_tokens
  - suppliers, locations
  - chat_rooms / members / messages
  - audit_logs (history of who did what stays forever)

Safety:
  - Dry run by default (prints DELETE counts via SELECT COUNT(*))
  - Single transaction on --apply; rollback on any error

Usage:
  python scripts/wipe_rm_data.py          # dry run (counts only)
  python scripts/wipe_rm_data.py --apply  # actually delete
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import psycopg2  # noqa: E402

# Order matters — children before parents to avoid FK violations.
WIPE_TABLES = [
    "batch_containers",
    "grade_transfers",
    "retest_cycles",
    "qc_results",
    "stock_movements",
    "batch_status_history",
    "grn",
    "dispatch_records",
    "fg_inventory",
    "qa_inspections",
    "finished_goods_batches",
    "batches",
    "notifications",
    "materials",
    # counters reset
    "grn_counters",
    "item_counter",
]


def normalize_db_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def main() -> int:
    parser = argparse.ArgumentParser(description="Wipe RM intake data (dev only).")
    parser.add_argument("--apply", action="store_true",
                        help="Actually delete. Without this flag, prints counts only.")
    args = parser.parse_args()

    env_path = BACKEND_DIR.parent / ".env"
    if not env_path.exists():
        env_path = BACKEND_DIR / ".env"
    load_dotenv(env_path)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print(f"ERROR: DATABASE_URL not set (looked in {env_path})", file=sys.stderr)
        return 1

    conn = psycopg2.connect(normalize_db_url(db_url))
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            print("=== Pre-wipe row counts ===")
            for t in WIPE_TABLES:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {t}")
                    n = cur.fetchone()[0]
                    print(f"  {t}: {n}")
                except psycopg2.errors.UndefinedTable:
                    conn.rollback()  # failed count leaves txn in error state
                    print(f"  {t}: (table does not exist yet — skipping)")

            if not args.apply:
                print("\nDRY RUN — no rows deleted. Re-run with --apply to execute.")
                return 0

            print("\n=== Deleting ===")
            for t in WIPE_TABLES:
                try:
                    cur.execute(f"DELETE FROM {t}")
                    print(f"  {t}: {cur.rowcount} rows deleted")
                except psycopg2.errors.UndefinedTable:
                    conn.rollback()
                    print(f"  {t}: (skipped, does not exist)")
                    # re-open txn for subsequent deletes
                    cur.close()
                    cur = conn.cursor()

            # Re-seed item_counter single row
            try:
                cur.execute(
                    "INSERT INTO item_counter (id, last_number) VALUES (1, 0) "
                    "ON CONFLICT (id) DO NOTHING"
                )
            except Exception:
                pass

        conn.commit()
        print("\nWipe complete.")
        return 0
    except Exception:
        conn.rollback()
        print("\nWipe FAILED — rolled back.", file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
