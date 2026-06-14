"""
Seed test batches across all 5 dashboard stages:
  - 2 × QUARANTINE
  - 2 × UNDER_TEST
  - 2 × APPROVED (normal, no retest due)
  - 2 × REJECTED
  - 2 × APPROVED with retest_date within 15 days  ← shows in Retest tile

Safe to re-run (uses unique batch numbers with timestamp suffix).
"""
import os, sys
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
conn.autocommit = True
cur = conn.cursor()

# Get or create a test material
cur.execute("SELECT id FROM materials WHERE material_code = 'TEST-MAT-01' LIMIT 1")
row = cur.fetchone()
if row:
    material_id = row[0]
else:
    cur.execute("""
        INSERT INTO materials (material_name, material_code, unit_of_measure, is_active, created_at, updated_at)
        VALUES ('Test Material Alpha', 'TEST-MAT-01', 'KG', TRUE, NOW(), NOW())
        RETURNING id
    """)
    material_id = cur.fetchone()[0]
    print(f"  Created material id={material_id}")

# Get or create a test supplier
cur.execute("SELECT id FROM suppliers WHERE supplier_name = 'Test Supplier' LIMIT 1")
row = cur.fetchone()
if row:
    supplier_id = row[0]
else:
    cur.execute("""
        INSERT INTO suppliers (supplier_name, is_active, created_at) VALUES ('Test Supplier', TRUE, NOW()) RETURNING id
    """)
    supplier_id = cur.fetchone()[0]

# Get quarantine location
cur.execute("SELECT id FROM locations WHERE location_type = 'QUARANTINE' LIMIT 1")
row = cur.fetchone()
quarantine_loc_id = row[0] if row else None

# Get a warehouse user id for created_by
cur.execute("""
    SELECT u.id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.role_name = 'WAREHOUSE_USER' AND u.is_active = TRUE
    LIMIT 1
""")
row = cur.fetchone()
if not row:
    cur.execute("SELECT id FROM users WHERE is_active = TRUE LIMIT 1")
    row = cur.fetchone()
created_by = row[0]

import random, string
def uid():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

today = date.today()

BATCHES = [
    # (batch_suffix, status, retest_date)
    ("QRN-A", "QUARANTINE",  None),
    ("QRN-B", "QUARANTINE",  None),
    ("TST-A", "UNDER_TEST",  None),
    ("TST-B", "UNDER_TEST",  None),
    ("APV-A", "APPROVED",    None),
    ("APV-B", "APPROVED",    None),
    ("RJT-A", "REJECTED",    None),
    ("RJT-B", "REJECTED",    None),
    ("RTN-A", "APPROVED",    today + timedelta(days=5)),   # retest in 5 days
    ("RTN-B", "APPROVED",    today + timedelta(days=10)),  # retest in 10 days
]

# Get or create GRN counter for current year
year = today.year
cur.execute("SELECT last_number FROM grn_counters WHERE year = %s FOR UPDATE", (year,))
row = cur.fetchone()
if row:
    grn_start = row[0]
else:
    cur.execute("INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, 0, NOW())", (year,))
    grn_start = 0

created = []
for i, (suffix, status, retest_date) in enumerate(BATCHES):
    grn_num = grn_start + i + 1
    grn_number = f"GRN-{year}-{grn_num:03d}"
    batch_number = f"SEED-{suffix}-{uid()[:4].upper()}"
    public_code = uid()

    # Insert batch
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
            'Test Manufacturer', %s, %s,
            'BAG', 'KG', 4, 25.000,
            100.000, 100.000, %s, %s,
            %s, 0, FALSE,
            %s, NOW(), NOW()
        ) RETURNING id
    """, (
        material_id, supplier_id, batch_number, public_code,
        today - timedelta(days=90), today + timedelta(days=365),
        status, quarantine_loc_id,
        retest_date,
        created_by,
    ))
    batch_id = cur.fetchone()[0]

    # Insert GRN
    cur.execute("""
        INSERT INTO grn (batch_id, grn_number, received_by, received_date, created_at)
        VALUES (%s, %s, %s, %s, NOW())
    """, (batch_id, grn_number, created_by, today))

    # Status history
    cur.execute("""
        INSERT INTO batch_status_history (batch_id, old_status, new_status, changed_by, remarks, changed_at)
        VALUES (%s, NULL, %s, %s, 'Seeded for testing', NOW())
    """, (batch_id, status, created_by))

    created.append((batch_number, grn_number, status, retest_date))

# Update GRN counter
cur.execute("UPDATE grn_counters SET last_number = %s, updated_at = NOW() WHERE year = %s",
            (grn_start + len(BATCHES), year))

cur.close()
conn.close()

print(f"\nSeeded {len(created)} batches:")
for batch_number, grn_number, status, retest_date in created:
    extra = f"  retest={retest_date}" if retest_date else ""
    print(f"  {grn_number}  {batch_number:<30}  {status}{extra}")
