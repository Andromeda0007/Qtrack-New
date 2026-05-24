"""
Cleanup + reseed: removes old SEED-* test batches, then creates 5 distinct
realistic batches — one per dashboard stage.

Run: python backend/scripts/seed_test_batches_v3.py
"""
import os, sys, random, string
from datetime import date, timedelta

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
conn.autocommit = False
cur = conn.cursor()

# ── 1. Delete old SEED-* batches + any partial ITM-* seeded batches ─────────
cur.execute("""
    SELECT b.id, b.batch_number FROM batches b
    LEFT JOIN materials m ON b.material_id = m.id
    WHERE b.batch_number LIKE 'SEED-%'
       OR b.batch_number LIKE 'PC-2025-%'
       OR b.batch_number LIKE 'MCC-%'
       OR b.batch_number LIKE 'ETH-%'
       OR b.batch_number LIKE 'MGS-%'
       OR b.batch_number LIKE 'NaCl-%'
       OR m.material_code IN ('ITM-P01','ITM-M02','ITM-E03','ITM-G04','ITM-S05')
""")
old_batches = cur.fetchall()

if old_batches:
    print(f"Deleting {len(old_batches)} old SEED-* batches:")
    for bid, bn in old_batches:
        print(f"  id={bid}  {bn}")
    ids = [b[0] for b in old_batches]
    # Delete in dependency order
    cur.execute("DELETE FROM batch_status_history WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM stock_movements WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM qc_results WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batch_containers WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM grn WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batches WHERE id = ANY(%s)", (ids,))
    print("  Deleted.\n")
else:
    print("No old SEED-* batches found.\n")

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
    cur.execute("""
        INSERT INTO suppliers (supplier_name, is_active, created_at) VALUES (%s, TRUE, NOW()) RETURNING id
    """, (name,))
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
created_by = row[0]

today = date.today()
year = today.year

# Use the actual max GRN number in use (not just the counter, which can lag after partial runs)
cur.execute("""
    SELECT COALESCE(MAX(CAST(SPLIT_PART(grn_number, '-', 3) AS INTEGER)), 0)
    FROM grn WHERE grn_number LIKE %s
""", (f"GRN-{year}-%",))
grn_base = cur.fetchone()[0]

# ── 3. New distinct batches ──────────────────────────────────────────────────
# Each has a different material, supplier, quantity, pack type, and status.
ITEMS = [
    {
        "status": "QUARANTINE",
        "material_name": "Paracetamol API",
        "material_code": "ITM-P01",
        "uom": "KG",
        "supplier": "Aarav Pharma Chemicals",
        "manufacturer": "Aarav Pharma Ltd.",
        "batch_number": f"PC-2025-{uid4()}",
        "pack_type": "DRUM",
        "containers": 6, "per_container": 25.0, "total": 150.0,
        "manufacture_date": today - timedelta(days=60),
        "expiry_date": today + timedelta(days=700),
        "retest_date": None,
    },
    {
        "status": "UNDER_TEST",
        "material_name": "Microcrystalline Cellulose",
        "material_code": "ITM-M02",
        "uom": "KG",
        "supplier": "Sigma Excipients Pvt Ltd",
        "manufacturer": "Sigma Corp.",
        "batch_number": f"MCC-{uid4()}",
        "pack_type": "BAG",
        "containers": 10, "per_container": 20.0, "total": 200.0,
        "manufacture_date": today - timedelta(days=30),
        "expiry_date": today + timedelta(days=1095),
        "retest_date": None,
    },
    {
        "status": "APPROVED",
        "material_name": "Ethanol 96%",
        "material_code": "ITM-E03",
        "uom": "L",
        "supplier": "National Solvents Co.",
        "manufacturer": "National Solvents Co.",
        "batch_number": f"ETH-{uid4()}",
        "pack_type": "DRUM",
        "containers": 4, "per_container": 50.0, "total": 200.0,
        "manufacture_date": today - timedelta(days=120),
        "expiry_date": today + timedelta(days=548),
        "retest_date": None,
    },
    {
        "status": "REJECTED",
        "material_name": "Magnesium Stearate",
        "material_code": "ITM-G04",
        "uom": "KG",
        "supplier": "Horizon Raw Materials",
        "manufacturer": "Horizon Industries",
        "batch_number": f"MGS-{uid4()}",
        "pack_type": "BAG",
        "containers": 2, "per_container": 10.0, "total": 20.0,
        "manufacture_date": today - timedelta(days=180),
        "expiry_date": today + timedelta(days=365),
        "retest_date": None,
    },
    {
        "status": "APPROVED",
        "material_name": "Sodium Chloride IP",
        "material_code": "ITM-S05",
        "uom": "KG",
        "supplier": "PureChem Distributors",
        "manufacturer": "PureChem Labs",
        "batch_number": f"NaCl-{uid4()}",
        "pack_type": "BAG",
        "containers": 8, "per_container": 12.5, "total": 100.0,
        "manufacture_date": today - timedelta(days=200),
        "expiry_date": today + timedelta(days=900),
        "retest_date": today + timedelta(days=7),  # due for retest in 7 days
    },
]

print("Creating new batches:")
for i, item in enumerate(ITEMS):
    mat_id = get_or_create_material(item["material_name"], item["material_code"], item["uom"])
    sup_id = get_or_create_supplier(item["supplier"])
    grn_num = grn_base + i + 1
    grn_number = f"GRN-{year}-{grn_num:03d}"

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
        item["manufacturer"], item["manufacture_date"], item["expiry_date"],
        item["pack_type"], item["uom"], item["containers"], item["per_container"],
        item["total"], item["total"], item["status"], quarantine_loc_id,
        item["retest_date"],
        created_by,
    ))
    batch_id = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO grn (batch_id, grn_number, received_by, received_date, created_at)
        VALUES (%s, %s, %s, %s, NOW())
    """, (batch_id, grn_number, created_by, today))

    # Insert full history chain so the timeline looks realistic
    STATUS_CHAIN = {
        "QUARANTINE":  [("QUARANTINE",  None,           1)],
        "UNDER_TEST":  [("QUARANTINE",  None,           3), ("UNDER_TEST",  "QUARANTINE",  1)],
        "APPROVED":    [("QUARANTINE",  None,           5), ("UNDER_TEST",  "QUARANTINE",  3), ("APPROVED",    "UNDER_TEST",  1)],
        "REJECTED":    [("QUARANTINE",  None,           5), ("UNDER_TEST",  "QUARANTINE",  3), ("REJECTED",    "UNDER_TEST",  1)],
    }
    chain = STATUS_CHAIN.get(item["status"], [("QUARANTINE", None, 1)])
    for new_st, old_st, days_ago in chain:
        cur.execute("""
            INSERT INTO batch_status_history (batch_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (%s, %s, %s, %s, 'Test seed v3', NOW() - INTERVAL '%s days')
        """, (batch_id, old_st, new_st, created_by, days_ago))

    retest_note = f"  ← retest in {item['retest_date'] - today} days" if item["retest_date"] else ""
    print(f"  [{item['status']:<18}]  {item['material_name']:<30}  {grn_number}  {item['batch_number']}{retest_note}")

cur.execute("""
    INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, %s, NOW())
    ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number, updated_at = NOW()
""", (year, grn_base + len(ITEMS)))

conn.commit()
cur.close()
conn.close()
print(f"\nDone — {len(ITEMS)} batches created.")
