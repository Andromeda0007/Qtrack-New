"""
Add 5 APPROVED batches for testing the "Issue to Production" verification form.
Does NOT wipe existing data — only inserts new rows.

Run: python backend/scripts/seed_approved_for_issue_test.py
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

import re
raw_url = os.environ.get("DATABASE_URL", "")
db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
# Convert Render internal hostname to external by appending .singapore-postgres.render.com
db_url = re.sub(r'(dpg-[a-z0-9]+-a)/', r'\1.singapore-postgres.render.com/', db_url)
if not db_url:
    print("DATABASE_URL not set"); sys.exit(1)

conn = psycopg2.connect(db_url)
conn.autocommit = False
cur = conn.cursor()

today = date.today()
year  = today.year

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_or_create_material(name, code, uom):
    cur.execute("SELECT id FROM materials WHERE material_code = %s OR material_name = %s", (code, name))
    row = cur.fetchone()
    if row: return row[0]
    cur.execute("""
        INSERT INTO materials (material_name, material_code, unit_of_measure, is_active, created_at, updated_at)
        VALUES (%s, %s, %s, TRUE, NOW(), NOW()) RETURNING id
    """, (name, code, uom))
    return cur.fetchone()[0]

def get_or_create_supplier(name):
    cur.execute("SELECT id FROM suppliers WHERE supplier_name = %s", (name,))
    row = cur.fetchone()
    if row: return row[0]
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

cur.execute("""
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.role_name IN ('QC_HEAD', 'QC_EXECUTIVE') AND u.is_active = TRUE LIMIT 1
""")
row = cur.fetchone()
qc_user = row[0] if row else wh_user

# Pick a unique GRN suffix that won't collide with existing ones
def rand_suffix():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))

BATCHES = [
    {
        "material": ("Paracetamol API",         "ISS-001", "KG"),
        "supplier":  "Aarav Pharma Chem.",
        "manufacturer": "Aarav Pharma Ltd.",
        "batch_number": f"PAR-{year}-ISS01",
        "grn":           f"GRN-{year}-ISS01",
        "pack": "DRUM", "cont": 6,  "per": 25.0, "total": 150.0, "uom": "KG",
        "mfg": today - timedelta(days=60), "exp": today + timedelta(days=730),
    },
    {
        "material": ("Ibuprofen BP",             "ISS-002", "KG"),
        "supplier":  "SD Fine Chemicals Ltd.",
        "manufacturer": "SD Fine Chemicals Ltd.",
        "batch_number": f"IBU-{year}-ISS02",
        "grn":           f"GRN-{year}-ISS02",
        "pack": "BAG",  "cont": 4,  "per": 50.0, "total": 200.0, "uom": "KG",
        "mfg": today - timedelta(days=55), "exp": today + timedelta(days=900),
    },
    {
        "material": ("Metformin HCl IP",         "ISS-003", "KG"),
        "supplier":  "Divi's Laboratories Ltd.",
        "manufacturer": "Divi's Laboratories Ltd.",
        "batch_number": f"MET-{year}-ISS03",
        "grn":           f"GRN-{year}-ISS03",
        "pack": "BAG",  "cont": 8,  "per": 25.0, "total": 200.0, "uom": "KG",
        "mfg": today - timedelta(days=45), "exp": today + timedelta(days=730),
    },
    {
        "material": ("Azithromycin IP",          "ISS-004", "KG"),
        "supplier":  "Sun Pharmaceutical Industries",
        "manufacturer": "Sun Pharmaceutical Industries",
        "batch_number": f"AZI-{year}-ISS04",
        "grn":           f"GRN-{year}-ISS04",
        "pack": "DRUM", "cont": 3,  "per": 20.0, "total": 60.0,  "uom": "KG",
        "mfg": today - timedelta(days=50), "exp": today + timedelta(days=540),
    },
    {
        "material": ("Ethanol 96% IP",           "ISS-005", "L"),
        "supplier":  "Merck Life Sciences Pvt. Ltd.",
        "manufacturer": "Merck Life Sciences Pvt. Ltd.",
        "batch_number": f"ETH-{year}-ISS05",
        "grn":           f"GRN-{year}-ISS05",
        "pack": "DRUM", "cont": 4,  "per": 50.0, "total": 200.0, "uom": "L",
        "mfg": today - timedelta(days=40), "exp": today + timedelta(days=365),
    },
]

print("Inserting 5 APPROVED batches for issue-to-production testing:\n")

for item in BATCHES:
    mat_id = get_or_create_material(*item["material"])
    sup_id = get_or_create_supplier(item["supplier"])

    # Skip if GRN already exists (idempotent re-run)
    cur.execute("SELECT id FROM grn WHERE grn_number = %s", (item["grn"],))
    if cur.fetchone():
        print(f"  [SKIP] {item['grn']} already exists")
        continue

    cur.execute("""
        INSERT INTO batches (
            material_id, supplier_id, batch_number, public_code,
            manufacturer_name, manufacture_date, expiry_date,
            pack_type, unit_of_measure, container_count, container_quantity,
            total_quantity, remaining_quantity, status, location_id,
            issued_to_production, retest_cycle, labels_printed,
            created_by, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, 'APPROVED', %s,
            FALSE, 0, TRUE,
            %s, NOW(), NOW()
        ) RETURNING id
    """, (
        mat_id, sup_id, item["batch_number"],
        ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)),
        item["manufacturer"], item["mfg"], item["exp"],
        item["pack"], item["uom"],
        item["cont"], item["per"], item["total"], item["total"],
        quarantine_loc_id,
        wh_user,
    ))
    batch_id = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO grn (batch_id, grn_number, received_by, received_date, created_at)
        VALUES (%s, %s, %s, %s, NOW() - INTERVAL '30 days')
    """, (batch_id, item["grn"], wh_user, today - timedelta(days=30)))

    for step, step_user, days_ago, remark in [
        ("QUARANTINE", wh_user,  30, "Received into quarantine"),
        ("UNDER_TEST", qc_user,  20, "Sample drawn and submitted to QC lab"),
        ("APPROVED",   qc_user,  10, "QC analysis complete — batch approved"),
    ]:
        cur.execute("""
            INSERT INTO batch_status_history
                (batch_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (%s, %s, %s, %s, %s, NOW() - INTERVAL '1 day' * %s)
        """, (batch_id, None if step == "QUARANTINE" else None, step, step_user, remark, days_ago))

    mat_name = item["material"][0]
    print(f"  [APPROVED]  {mat_name:<30}  GRN: {item['grn']}  Batch: {item['batch_number']}")

conn.commit()
cur.close()
conn.close()
print("\nDone.")
print("\nTo test the form, use these exact values:")
for item in BATCHES:
    print(f"  Product Name : {item['material'][0]}")
    print(f"  Batch No.    : {item['batch_number']}")
    print(f"  GRN Number   : {item['grn']}")
    print()
