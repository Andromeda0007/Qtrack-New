"""
Seed FG batches across all lifecycle statuses for testing.

Statuses covered:
  QA_PENDING      (3) — visible to QA Executive and QA Head
  QA_APPROVED     (2) — approved by QA Head
  QA_REJECTED     (1) — rejected by QA Head
  WAREHOUSE_RECEIVED (1)
  DISPATCHED      (1)

For QA_APPROVED / QA_REJECTED batches, a QA inspection record is also created
so the data is realistic end-to-end.

Safe to re-run — skips batches whose batch_number already exists.

Usage:
    python scripts/seed_fg_batches.py
"""

import os
import sys
from datetime import datetime, date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
    from psycopg2.extras import execute_values
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
if not db_url:
    print("DATABASE_URL not set in .env")
    sys.exit(1)

now = datetime.utcnow()
today = now.date()

# (batch_number, product_name, fgtn_no, quantity, unit, pack_size,
#  carton_count, net_weight, mfg_date, expiry_date, status)
FG_BATCHES = [
    # ── QA_PENDING ──────────────────────────────────────────────────────────
    ("FG-2026-001", "Paracetamol 500mg Tablets",  "FGTN-2026-001",
     10000, "TAB", "10x10 Alu-Alu", 100, 50.0,
     date(2026, 4, 10), date(2028, 4,  9), "QA_PENDING"),

    ("FG-2026-002", "Ibuprofen 400mg Capsules",   "FGTN-2026-002",
     5000,  "CAP", "10x10 Blister",  50, 25.0,
     date(2026, 4, 15), date(2028, 4, 14), "QA_PENDING"),

    ("FG-2026-003", "Amoxicillin 250mg Syrup",    "FGTN-2026-003",
     2000,  "BTL", None,             40,  None,
     date(2026, 4, 20), date(2027, 10, 19), "QA_PENDING"),

    # ── QA_APPROVED ─────────────────────────────────────────────────────────
    ("FG-2026-004", "Metformin 500mg Tablets",    "FGTN-2026-004",
     20000, "TAB", "10x10 Alu-Alu", 200, 100.0,
     date(2026, 3, 5),  date(2029, 3,  4), "QA_APPROVED"),

    ("FG-2026-005", "Atorvastatin 10mg Tablets",  "FGTN-2026-005",
     15000, "TAB", "10x15 Blister",  75, 37.5,
     date(2026, 3, 12), date(2029, 3, 11), "QA_APPROVED"),

    # ── QA_REJECTED ─────────────────────────────────────────────────────────
    ("FG-2026-006", "Cetirizine 10mg Tablets",    "FGTN-2026-006",
     8000,  "TAB", "10x10 Blister",  80, 40.0,
     date(2026, 2, 20), date(2028, 2, 19), "QA_REJECTED"),

    # ── WAREHOUSE_RECEIVED ──────────────────────────────────────────────────
    ("FG-2026-007", "Azithromycin 500mg Tablets", "FGTN-2026-007",
     12000, "TAB", "6x10 Alu-Alu",   60, 30.0,
     date(2026, 2, 1),  date(2028, 1, 31), "WAREHOUSE_RECEIVED"),

    # ── DISPATCHED ──────────────────────────────────────────────────────────
    ("FG-2026-008", "Pantoprazole 40mg Tablets",  "FGTN-2026-008",
     25000, "TAB", "10x10 Blister", 250, 125.0,
     date(2026, 1, 10), date(2028, 1,  9), "DISPATCHED"),
]


def main():
    print("Connecting to DB …")
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Fetch user IDs
    cur.execute("SELECT id FROM users WHERE username = 'prod' LIMIT 1")
    row = cur.fetchone()
    prod_user_id = row[0] if row else None

    cur.execute("SELECT id FROM users WHERE username = 'qae' LIMIT 1")
    row = cur.fetchone()
    qae_id = row[0] if row else None

    cur.execute("SELECT id FROM users WHERE username = 'qah' LIMIT 1")
    row = cur.fetchone()
    qah_id = row[0] if row else None

    cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
    fallback_id = cur.fetchone()[0]

    prod_user_id = prod_user_id or fallback_id
    qae_id = qae_id or fallback_id
    qah_id = qah_id or fallback_id

    print(f"  prod_user_id={prod_user_id}  qae_id={qae_id}  qah_id={qah_id}")

    inserted = 0
    for (batch_no, product_name, fgtn_no, qty, unit, pack_size,
         carton_count, net_weight, mfg_date, exp_date, status) in FG_BATCHES:

        cur.execute(
            "SELECT id FROM finished_goods_batches WHERE batch_number = %s",
            (batch_no,)
        )
        if cur.fetchone():
            print(f"  SKIP  {batch_no} (already exists)")
            continue

        cur.execute("""
            INSERT INTO finished_goods_batches
                (batch_number, product_name, fgtn_no, quantity, unit_of_measure,
                 pack_size, carton_count, net_weight,
                 manufacture_date, expiry_date, status,
                 created_by, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            batch_no, product_name, fgtn_no, qty, unit,
            pack_size, carton_count, net_weight,
            mfg_date, exp_date, status,
            prod_user_id, now - timedelta(days=30), now,
        ))
        fg_id = cur.fetchone()[0]

        # Create QA inspection for batches that went through QA decision
        if status in ("QA_APPROVED", "QA_REJECTED", "WAREHOUSE_RECEIVED", "DISPATCHED"):
            insp_status = "PASSED" if status in ("QA_APPROVED", "WAREHOUSE_RECEIVED", "DISPATCHED") else "FAILED"
            insp_remarks = (
                "All parameters within specification."
                if insp_status == "PASSED"
                else "Dissolution test failed. Out-of-spec dissolution profile."
            )
            cur.execute("""
                INSERT INTO qa_inspections
                    (fg_batch_id, quantity_verified, status, inspection_remarks,
                     inspected_by, approved_rejected_by, created_at, completed_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                fg_id, qty, insp_status, insp_remarks,
                qae_id, qah_id,
                now - timedelta(days=20), now - timedelta(days=18),
            ))

        print(f"  OK    {batch_no}  {product_name}  [{status}]")
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone. Inserted {inserted} FG batches.")
    print("\nLogin credentials reminder:")
    print("  prod  / 123456  (PRODUCTION_USER)")
    print("  qae   / 123456  (QA_EXECUTIVE)")
    print("  qah   / 123456  (QA_HEAD)")
    print("  wh    / 123456  (WAREHOUSE_USER)")


if __name__ == "__main__":
    main()
