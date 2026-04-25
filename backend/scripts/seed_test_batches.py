"""
Seed 10 test batches spread across all 4 statuses:
  QUARANTINE (3), UNDER_TEST (2), APPROVED (3), ISSUED_TO_PRODUCTION (2)

Each batch gets: GRN record, batch_containers, stock_movement (GRN_RECEIVED),
and batch_status_history entries showing realistic transitions.

Safe to re-run — skips if GRN number already exists.

Usage:
    python scripts/seed_test_batches.py
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

# ── Batch plan ────────────────────────────────────────────────────────────────
# (grn_seq, mat_code, sup_name, batch_no, public_code, pack_type,
#  container_count, container_qty, unit, mfg_date, exp_date,
#  status, rack, manufacturer, invoice, final_remaining_fraction)
#
# final_remaining_fraction: 1.0 = full stock, 0.0 = fully issued
BATCH_PLAN = [
    # ── QUARANTINE ──────────────────────────────────────────────────────────
    (1,  "ITM-001", "SciGen Pharma Ltd",      "MFBATCH-PCT-2601", "pc26ab01", "BAG",
     4, 25.0, "KG", date(2025, 11, 10), date(2028, 11, 9),
     "QUARANTINE", "R-A1", "SciGen API Division",   "INV-SCI-26001", 1.0),

    (2,  "ITM-004", "Cipla Ltd",               "MFBATCH-IBU-2601", "ib26cd02", "DRUM",
     2, 50.0, "KG", date(2025, 10, 5),  date(2027, 10, 4),
     "QUARANTINE", "R-B3", "Cipla API Works",        "INV-CPL-26002", 1.0),

    (3,  "ITM-011", "Sun Pharma Industries",   "MFBATCH-ETH-2601", "et26ef03", "DRUM",
     1, 50.0, "L",  date(2026,  1, 15), date(2027,  1, 14),
     "QUARANTINE", "R-C2", "Sun Pharma Chemicals",  "INV-SUN-26003", 1.0),

    # ── UNDER_TEST ──────────────────────────────────────────────────────────
    (4,  "ITM-003", "Alkem Laboratories",       "MFBATCH-AMX-2601", "am26gh04", "BAG",
     3, 25.0, "KG", date(2025, 9, 20),  date(2028,  9, 19),
     "UNDER_TEST", "R-A2", "Alkem API Unit",          "INV-ALK-26004", 1.0),

    (5,  "ITM-005", "Lupin Limited",            "MFBATCH-MET-2601", "me26ij05", "BAG",
     4, 25.0, "KG", date(2025, 12,  1), date(2028, 11, 30),
     "UNDER_TEST", "R-B1", "Lupin Research Park",    "INV-LUP-26005", 1.0),

    # ── APPROVED ────────────────────────────────────────────────────────────
    (6,  "ITM-006", "Hetero Drugs Ltd",         "MFBATCH-STC-2601", "st26kl06", "BAG",
     2, 50.0, "KG", date(2025, 8, 12),  date(2027,  8, 11),
     "APPROVED", "R-D1", "Hetero Excipients",        "INV-HET-26006", 1.0),

    (7,  "ITM-007", "Aurobindo Pharma",         "MFBATCH-MCC-2601", "mc26mn07", "BAG",
     4, 25.0, "KG", date(2025, 7, 25),  date(2027,  7, 24),
     "APPROVED", "R-D2", "Aurobindo Excipients",     "INV-AUR-26007", 1.0),

    (8,  "ITM-010", "Divi's Laboratories",      "MFBATCH-LAC-2601", "la26op08", "BAG",
     2, 25.0, "KG", date(2025, 6, 10),  date(2027,  6,  9),
     "APPROVED", "R-D3", "Divi's Fine Chemicals",    "INV-DIV-26008", 1.0),

    # ── ISSUED_TO_PRODUCTION ────────────────────────────────────────────────
    (9,  "ITM-002", "SciGen Pharma Ltd",        "MFBATCH-MOR-2601", "mo26qr09", "DRUM",
     2, 25.0, "KG", date(2025, 5, 18),  date(2028,  5, 17),
     "ISSUED_TO_PRODUCTION", "R-E1", "SciGen Opioids Division", "INV-SCI-26009", 0.0),

    (10, "ITM-008", "Sun Pharma Industries",    "MFBATCH-MGS-2601", "mg26st10", "BAG",
     1, 25.0, "KG", date(2025, 4,  5),  date(2026, 10,  4),
     "ISSUED_TO_PRODUCTION", "R-E2", "Sun Excipients Plant",    "INV-SUN-26010", 0.0),
]

STATUS_TRANSITIONS = {
    "QUARANTINE":             ["QUARANTINE"],
    "UNDER_TEST":             ["QUARANTINE", "UNDER_TEST"],
    "APPROVED":               ["QUARANTINE", "UNDER_TEST", "APPROVED"],
    "ISSUED_TO_PRODUCTION":   ["QUARANTINE", "UNDER_TEST", "APPROVED", "ISSUED_TO_PRODUCTION"],
}


def main():
    print("Connecting to DB …")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    # ── Fetch reference IDs ──────────────────────────────────────────────────
    cur.execute("SELECT id FROM users WHERE username = 'Andromeda007' LIMIT 1")
    row = cur.fetchone()
    if not row:
        cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        row = cur.fetchone()
    if not row:
        print("No users found — run seed.py first.")
        return
    admin_id = row[0]
    print(f"  Using user_id={admin_id} as created_by / received_by")

    cur.execute("SELECT material_code, id FROM materials")
    mat_map = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT supplier_name, id FROM suppliers")
    sup_map = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT id FROM locations WHERE location_type = 'WAREHOUSE' LIMIT 1")
    row = cur.fetchone()
    location_id = row[0] if row else None

    # ── Insert batches ───────────────────────────────────────────────────────
    print(f"\nSeeding {len(BATCH_PLAN)} batches …")
    inserted = 0

    for (grn_seq, mat_code, sup_name, batch_no, pub_code,
         pack_type, cnt_count, cnt_qty, unit,
         mfg_dt, exp_dt, status, rack, mfr, invoice, rem_frac) in BATCH_PLAN:

        grn_number = f"GRN-2026-{grn_seq:03d}"

        # Skip if already exists
        cur.execute("SELECT id FROM grn WHERE grn_number = %s", (grn_number,))
        if cur.fetchone():
            print(f"  SKIP {grn_number} (already exists)")
            continue

        mat_id = mat_map.get(mat_code)
        sup_id = sup_map.get(sup_name)
        if not mat_id:
            print(f"  WARN: material {mat_code} not found, skipping {grn_number}")
            continue

        total_qty = cnt_count * cnt_qty
        remaining = total_qty * rem_frac

        # ── Insert batch ──────────────────────────────────────────────────
        cur.execute("""
            INSERT INTO batches
                (material_id, supplier_id, batch_number, public_code,
                 manufacture_date, expiry_date, pack_type,
                 unit_of_measure, container_count, container_quantity,
                 total_quantity, remaining_quantity,
                 status, location_id, rack_number, labels_printed,
                 retest_cycle, manufacturer_name, created_by, created_at, updated_at)
            VALUES
                (%s, %s, %s, %s,
                 %s, %s, %s,
                 %s, %s, %s,
                 %s, %s,
                 %s, %s, %s, %s,
                 %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            mat_id, sup_id, batch_no, pub_code,
            mfg_dt, exp_dt, pack_type,
            unit, cnt_count, cnt_qty,
            total_qty, remaining,
            status, location_id, rack, True,
            0, mfr, admin_id, now, now,
        ))
        batch_id = cur.fetchone()[0]

        # ── Insert GRN ────────────────────────────────────────────────────
        cur.execute("""
            INSERT INTO grn
                (batch_id, grn_number, received_by, received_date,
                 invoice_number, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (batch_id, grn_number, admin_id, now.date(), invoice, now))

        # ── Insert containers ─────────────────────────────────────────────
        container_rows = []
        for n in range(1, cnt_count + 1):
            unique_code = f"{grn_number}-{n:03d}"
            container_rows.append((batch_id, n, unique_code, False, now))
        execute_values(cur, """
            INSERT INTO batch_containers
                (batch_id, container_number, unique_code, is_lost, created_at)
            VALUES %s
            ON CONFLICT (unique_code) DO NOTHING
        """, container_rows)

        # ── Stock movement: GRN_RECEIVED ──────────────────────────────────
        cur.execute("""
            INSERT INTO stock_movements
                (batch_id, movement_type, quantity,
                 to_location_id, performed_by, reference_id, created_at)
            VALUES (%s, 'GRN_RECEIVED', %s, %s, %s, %s, %s)
        """, (batch_id, total_qty, location_id, admin_id, grn_number, now))

        # If fully issued — add ISSUE_TO_PRODUCTION movement
        if rem_frac == 0.0:
            cur.execute("""
                INSERT INTO stock_movements
                    (batch_id, movement_type, quantity,
                     from_location_id, performed_by, reference_id,
                     issued_to_product_name, created_at)
                VALUES (%s, 'ISSUE_TO_PRODUCTION', %s, %s, %s, %s, %s, %s)
            """, (batch_id, total_qty, location_id, admin_id, grn_number,
                  "Production Run PR-001", now))

        # ── Status history ────────────────────────────────────────────────
        transitions = STATUS_TRANSITIONS[status]
        for idx, st in enumerate(transitions):
            old_st = transitions[idx - 1] if idx > 0 else None
            cur.execute("""
                INSERT INTO batch_status_history
                    (batch_id, old_status, new_status, changed_by, changed_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (batch_id, old_st, st, admin_id,
                  now - timedelta(days=(len(transitions) - idx) * 2)))

        print(f"  OK  {grn_number}  {mat_code}  {status}")
        inserted += 1

    # ── Update GRN counter for 2026 ──────────────────────────────────────────
    cur.execute("""
        INSERT INTO grn_counters (year, last_number, updated_at)
        VALUES (2026, 10, %s)
        ON CONFLICT (year) DO UPDATE
          SET last_number = GREATEST(grn_counters.last_number, EXCLUDED.last_number),
              updated_at  = EXCLUDED.updated_at
    """, (now,))
    cur.execute("SELECT last_number FROM grn_counters WHERE year = 2026")
    print(f"\n  grn_counters 2026 → last_number = {cur.fetchone()[0]}")

    cur.close()
    conn.close()
    print(f"\nDone. Inserted {inserted} batches.")


if __name__ == "__main__":
    main()
