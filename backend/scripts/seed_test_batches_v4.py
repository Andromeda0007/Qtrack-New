"""
Full cleanup + realistic reseed.

Deletes ALL batches tied to our test material codes, then creates 8 batches
that each start in QUARANTINE and are promoted through the real flow:

  2 × QUARANTINE           (just received)
  2 × UNDER_TEST           (quarantine → under test)
  2 × APPROVED             (quarantine → under test → approved)
  1 × REJECTED             (quarantine → under test → rejected)
  1 × APPROVED + retest    (quarantine → under test → approved, retest_date 8 days out)

Run: python backend/scripts/seed_test_batches_v4.py
"""
import os, sys, random, string
from datetime import date, timedelta

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
db_url = db_url.replace(
    "dpg-d7mbsgbbc2fs7385cmg0-a/",
    "dpg-d7mbsgbbc2fs7385cmg0-a.singapore-postgres.render.com/",
)
if not db_url:
    print("DATABASE_URL not set")
    sys.exit(1)

SEED_MATERIAL_CODES = ('ITM-P01', 'ITM-M02', 'ITM-E03', 'ITM-G04', 'ITM-S05', 'ITM-C06')

conn = psycopg2.connect(db_url)
conn.autocommit = False
cur = conn.cursor()

# ── 1. Delete all test batches ───────────────────────────────────────────────
cur.execute("""
    SELECT b.id, b.batch_number FROM batches b
    LEFT JOIN materials m ON b.material_id = m.id
    WHERE b.batch_number LIKE 'SEED-%%'
       OR b.batch_number LIKE 'PC-2025-%%'
       OR b.batch_number LIKE 'MCC-%%'
       OR b.batch_number LIKE 'ETH-%%'
       OR b.batch_number LIKE 'MGS-%%'
       OR b.batch_number LIKE 'NaCl-%%'
       OR b.batch_number LIKE 'PAR-%%'
       OR b.batch_number LIKE 'MCC2-%%'
       OR b.batch_number LIKE 'ETH2-%%'
       OR b.batch_number LIKE 'MGS2-%%'
       OR b.batch_number LIKE 'NaCl2-%%'
       OR b.batch_number LIKE 'CIT-%%'
       OR m.material_code IN %s
""", (SEED_MATERIAL_CODES,))
old = cur.fetchall()

if old:
    ids = [r[0] for r in old]
    print(f"Deleting {len(old)} old test batches:")
    for bid, bn in old:
        print(f"  id={bid}  {bn}")
    cur.execute("DELETE FROM batch_status_history WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM stock_movements      WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM qc_results           WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batch_containers      WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM grn                  WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batches              WHERE id        = ANY(%s)", (ids,))
    print("  Done.\n")
else:
    print("No old test batches found.\n")

# ── 2. Helpers ───────────────────────────────────────────────────────────────
def uid4():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

def get_or_create_material(name, code, uom):
    cur.execute("SELECT id FROM materials WHERE material_code = %s OR material_name = %s", (code, name))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""
        INSERT INTO materials (material_name, material_code, unit_of_measure, is_active, created_at, updated_at)
        VALUES (%s, %s, %s, TRUE, NOW(), NOW()) RETURNING id
    """, (name, code, uom))
    return cur.fetchone()[0]

def get_or_create_supplier(name):
    cur.execute("SELECT id FROM suppliers WHERE supplier_name = %s", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("INSERT INTO suppliers (supplier_name, is_active, created_at) VALUES (%s, TRUE, NOW()) RETURNING id", (name,))
    return cur.fetchone()[0]

cur.execute("SELECT id FROM locations WHERE location_type = 'QUARANTINE' LIMIT 1")
row = cur.fetchone()
quarantine_loc_id = row[0] if row else None

cur.execute("""
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.role_name = 'WAREHOUSE_USER' AND u.is_active = TRUE LIMIT 1
""")
row = cur.fetchone()
if not row:
    cur.execute("SELECT id FROM users WHERE is_active = TRUE LIMIT 1")
    row = cur.fetchone()
wh_user = row[0]

# Try to get a QC user for test-result transitions
cur.execute("""
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.role_name IN ('QC_HEAD','QC_EXECUTIVE') AND u.is_active = TRUE LIMIT 1
""")
row = cur.fetchone()
qc_user = row[0] if row else wh_user

today = date.today()
year  = today.year

# Get current max GRN to avoid conflicts
cur.execute("SELECT COALESCE(MAX(CAST(SPLIT_PART(grn_number,'-',3) AS INTEGER)),0) FROM grn WHERE grn_number LIKE %s", (f"GRN-{year}-%",))
grn_base = cur.fetchone()[0]

# ── 3. Batch definitions ──────────────────────────────────────────────────────
# flow = list of (status, performed_by_role, days_ago)
# Each step records a history row; final step determines batch.status

BATCHES = [
    # ── QUARANTINE (just received, 1 day ago) ───────────────────────────────
    {
        "material": ("Paracetamol API",          "ITM-P01", "KG"),
        "supplier":  "Aarav Pharma Chemicals",
        "manufacturer": "Aarav Pharma Ltd.",
        "batch_number": f"PAR-{uid4()}",
        "pack_type": "DRUM", "containers": 6, "per_container": 25.0, "total": 150.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=60), "exp_date": today + timedelta(days=700),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 1)],
    },
    {
        "material": ("Citric Acid Monohydrate",  "ITM-C06", "KG"),
        "supplier":  "BioSynth Ingredients",
        "manufacturer": "BioSynth Ltd.",
        "batch_number": f"CIT-{uid4()}",
        "pack_type": "BAG", "containers": 4, "per_container": 50.0, "total": 200.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=45), "exp_date": today + timedelta(days=820),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 2)],
    },

    # ── UNDER TEST (quarantine → under test) ────────────────────────────────
    {
        "material": ("Microcrystalline Cellulose", "ITM-M02", "KG"),
        "supplier":  "Sigma Excipients Pvt Ltd",
        "manufacturer": "Sigma Corp.",
        "batch_number": f"MCC2-{uid4()}",
        "pack_type": "BAG", "containers": 10, "per_container": 20.0, "total": 200.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=30), "exp_date": today + timedelta(days=1095),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 7), ("UNDER_TEST", qc_user, 4)],
    },
    {
        "material": ("Sodium Starch Glycolate",   "ITM-G04", "KG"),
        "supplier":  "Horizon Raw Materials",
        "manufacturer": "Horizon Industries",
        "batch_number": f"MGS2-{uid4()}",
        "pack_type": "BAG", "containers": 3, "per_container": 25.0, "total": 75.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=50), "exp_date": today + timedelta(days=900),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 10), ("UNDER_TEST", qc_user, 6)],
    },

    # ── APPROVED ─────────────────────────────────────────────────────────────
    {
        "material": ("Ethanol 96%",               "ITM-E03", "L"),
        "supplier":  "National Solvents Co.",
        "manufacturer": "National Solvents Co.",
        "batch_number": f"ETH2-{uid4()}",
        "pack_type": "DRUM", "containers": 4, "per_container": 50.0, "total": 200.0,
        "uom": "L",
        "mfg_date": today - timedelta(days=120), "exp_date": today + timedelta(days=548),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 20), ("UNDER_TEST", qc_user, 14), ("APPROVED", qc_user, 8)],
    },
    {
        "material": ("Magnesium Stearate",         "ITM-G04", "KG"),
        "supplier":  "Horizon Raw Materials",
        "manufacturer": "Horizon Industries",
        "batch_number": f"MGS-{uid4()}",
        "pack_type": "BAG", "containers": 2, "per_container": 10.0, "total": 20.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=90), "exp_date": today + timedelta(days=600),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 18), ("UNDER_TEST", qc_user, 12), ("APPROVED", qc_user, 5)],
    },

    # ── REJECTED ─────────────────────────────────────────────────────────────
    {
        "material": ("Paracetamol API",            "ITM-P01", "KG"),
        "supplier":  "Aarav Pharma Chemicals",
        "manufacturer": "Aarav Pharma Ltd.",
        "batch_number": f"PAR-{uid4()}",
        "pack_type": "DRUM", "containers": 4, "per_container": 25.0, "total": 100.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=100), "exp_date": today + timedelta(days=400),
        "retest_date": None,
        "flow": [("QUARANTINE", wh_user, 25), ("UNDER_TEST", qc_user, 18), ("REJECTED", qc_user, 10)],
    },

    # ── APPROVED + retest due in 8 days ──────────────────────────────────────
    {
        "material": ("Sodium Chloride IP",         "ITM-S05", "KG"),
        "supplier":  "PureChem Distributors",
        "manufacturer": "PureChem Labs",
        "batch_number": f"NaCl2-{uid4()}",
        "pack_type": "BAG", "containers": 8, "per_container": 12.5, "total": 100.0,
        "uom": "KG",
        "mfg_date": today - timedelta(days=200), "exp_date": today + timedelta(days=900),
        "retest_date": today + timedelta(days=8),
        "flow": [("QUARANTINE", wh_user, 30), ("UNDER_TEST", qc_user, 22), ("APPROVED", qc_user, 15)],
    },
]

# Status label maps for history remarks
STATUS_REMARKS = {
    "QUARANTINE":  "Received into quarantine",
    "UNDER_TEST":  "Sample submitted for testing",
    "APPROVED":    "QC approved",
    "REJECTED":    "QC rejected — failed specifications",
}

print("Creating batches:")
for i, item in enumerate(BATCHES):
    mat_id = get_or_create_material(*item["material"])
    sup_id = get_or_create_supplier(item["supplier"])
    grn_num  = grn_base + i + 1
    grn_number = f"GRN-{year}-{grn_num:03d}"
    final_status = item["flow"][-1][0]

    cur.execute("""
        INSERT INTO batches (
            material_id, supplier_id, batch_number, public_code,
            manufacturer_name, manufacture_date, expiry_date,
            pack_type, unit_of_measure, container_count, container_quantity,
            total_quantity, remaining_quantity, status, location_id,
            retest_date, retest_cycle, labels_printed,
            created_by, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, 0, FALSE,
            %s, NOW(), NOW()
        ) RETURNING id
    """, (
        mat_id, sup_id, item["batch_number"],
        ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)),
        item["manufacturer"], item["mfg_date"], item["exp_date"],
        item["pack_type"], item["uom"],
        item["containers"], item["per_container"],
        item["total"], item["total"],
        final_status, quarantine_loc_id,
        item["retest_date"],
        wh_user,
    ))
    batch_id = cur.fetchone()[0]

    # GRN row
    cur.execute("""
        INSERT INTO grn (batch_id, grn_number, received_by, received_date, created_at)
        VALUES (%s, %s, %s, %s, NOW() - INTERVAL '1 day' * %s)
    """, (batch_id, grn_number, wh_user, today - timedelta(days=item["flow"][0][2]), item["flow"][0][2]))

    # Full history chain
    prev_status = None
    for step_status, step_user, days_ago in item["flow"]:
        cur.execute("""
            INSERT INTO batch_status_history
                (batch_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (%s, %s, %s, %s, %s, NOW() - INTERVAL '1 day' * %s)
        """, (
            batch_id, prev_status, step_status, step_user,
            STATUS_REMARKS.get(step_status, step_status),
            days_ago,
        ))
        prev_status = step_status

    retest_note = f"  ← retest in {(item['retest_date'] - today).days}d" if item["retest_date"] else ""
    flow_str = " → ".join(s for s, _, _ in item["flow"])
    print(f"  [{final_status:<18}]  {item['material'][0]:<30}  {grn_number}  {flow_str}{retest_note}")

# Update GRN counter
cur.execute("""
    INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, %s, NOW())
    ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number, updated_at = NOW()
""", (year, grn_base + len(BATCHES)))

conn.commit()
cur.close()
conn.close()
print(f"\nDone — {len(BATCHES)} batches seeded.")
