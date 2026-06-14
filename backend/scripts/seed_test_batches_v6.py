"""
Wipe ALL batches and reseed with realistic pharma data.
3 items per phase: Quarantine, Under Test, Approved, Rejected, Retest.

Run: python backend/scripts/seed_test_batches_v6.py
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
    print("DATABASE_URL not set"); sys.exit(1)

conn = psycopg2.connect(db_url)
conn.autocommit = False
cur = conn.cursor()

# ── 1. Wipe ALL batches ───────────────────────────────────────────────────────
cur.execute("SELECT COUNT(*) FROM batches")
total = cur.fetchone()[0]
print(f"Deleting all {total} existing batches...")
cur.execute("SELECT id FROM batches")
all_ids = [r[0] for r in cur.fetchall()]
if all_ids:
    cur.execute("DELETE FROM batch_status_history WHERE batch_id = ANY(%s)", (all_ids,))
    cur.execute("DELETE FROM stock_movements      WHERE batch_id = ANY(%s)", (all_ids,))
    cur.execute("DELETE FROM qc_results           WHERE batch_id = ANY(%s)", (all_ids,))
    cur.execute("DELETE FROM batch_containers      WHERE batch_id = ANY(%s)", (all_ids,))
    cur.execute("DELETE FROM grn                  WHERE batch_id = ANY(%s)", (all_ids,))
    cur.execute("DELETE FROM batches              WHERE id        = ANY(%s)", (all_ids,))
print("  Done.\n")

# Reset GRN counter for the year
today = date.today()
year  = today.year
cur.execute("""
    INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, 0, NOW())
    ON CONFLICT (year) DO UPDATE SET last_number = 0, updated_at = NOW()
""", (year,))

# ── 2. Helpers ────────────────────────────────────────────────────────────────
def get_or_create_material(name, code, uom):
    cur.execute("SELECT id FROM materials WHERE material_code = %s", (code,))
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
    WHERE r.role_name IN ('QC_HEAD','QC_EXECUTIVE') AND u.is_active = TRUE LIMIT 1
""")
row = cur.fetchone()
qc_user = row[0] if row else wh_user

STATUS_REMARKS = {
    "QUARANTINE": "Received into quarantine",
    "UNDER_TEST": "Sample drawn and submitted to QC lab",
    "APPROVED":   "QC analysis complete — batch approved",
    "REJECTED":   "QC analysis complete — batch rejected (out of spec)",
}

# ── 3. Batch definitions ──────────────────────────────────────────────────────
# Each batch gets a realistic batch number like "BN-2026-001"
counter = [0]
def next_bn(prefix):
    counter[0] += 1
    return f"{prefix}/{year}/{counter[0]:03d}"

def next_grn():
    counter[0] += 1
    return f"GRN/{year}/{counter[0]:03d}"

counter[0] = 0
grn_counter = [0]
def ng():
    grn_counter[0] += 1
    return f"GRN/{year}/{grn_counter[0]:03d}"

bn_counter = [0]
def nb(prefix):
    bn_counter[0] += 1
    return f"{prefix}-{year}-{bn_counter[0]:03d}"

BATCHES = [

    # ── QUARANTINE ────────────────────────────────────────────────────────────
    {
        "material": ("Paracetamol IP",                "ITM-001", "KG"),
        "supplier":  "Loba Chemie Pvt. Ltd.",
        "manufacturer": "Loba Chemie Pvt. Ltd.",
        "batch_number": nb("PCT"), "grn": ng(),
        "pack": "DRUM", "cont": 6,  "per": 25.0,  "total": 150.0, "uom": "KG",
        "mfg": today-timedelta(days=10), "exp": today+timedelta(days=730), "retest": None,
        "flow": [("QUARANTINE", wh_user, 2)],
    },
    {
        "material": ("Ibuprofen BP",                  "ITM-002", "KG"),
        "supplier":  "SD Fine Chemicals Ltd.",
        "manufacturer": "SD Fine Chemicals Ltd.",
        "batch_number": nb("IBU"), "grn": ng(),
        "pack": "BAG",  "cont": 4,  "per": 50.0,  "total": 200.0, "uom": "KG",
        "mfg": today-timedelta(days=5),  "exp": today+timedelta(days=900), "retest": None,
        "flow": [("QUARANTINE", wh_user, 1)],
    },
    {
        "material": ("Amoxicillin Trihydrate IP",      "ITM-003", "KG"),
        "supplier":  "Aurobindo Pharma Ltd.",
        "manufacturer": "Aurobindo Pharma Ltd.",
        "batch_number": nb("AMX"), "grn": ng(),
        "pack": "DRUM", "cont": 3,  "per": 20.0,  "total": 60.0,  "uom": "KG",
        "mfg": today-timedelta(days=8),  "exp": today+timedelta(days=540), "retest": None,
        "flow": [("QUARANTINE", wh_user, 3)],
    },

    # ── UNDER TEST ────────────────────────────────────────────────────────────
    {
        "material": ("Metformin Hydrochloride IP",     "ITM-004", "KG"),
        "supplier":  "Divi's Laboratories Ltd.",
        "manufacturer": "Divi's Laboratories Ltd.",
        "batch_number": nb("MET"), "grn": ng(),
        "pack": "BAG",  "cont": 8,  "per": 25.0,  "total": 200.0, "uom": "KG",
        "mfg": today-timedelta(days=20), "exp": today+timedelta(days=730), "retest": None,
        "flow": [("QUARANTINE", wh_user, 14), ("UNDER_TEST", qc_user, 7)],
    },
    {
        "material": ("Ciprofloxacin Hydrochloride IP", "ITM-005", "KG"),
        "supplier":  "Cipla Ltd.",
        "manufacturer": "Cipla Ltd.",
        "batch_number": nb("CIP"), "grn": ng(),
        "pack": "DRUM", "cont": 2,  "per": 30.0,  "total": 60.0,  "uom": "KG",
        "mfg": today-timedelta(days=18), "exp": today+timedelta(days=600), "retest": None,
        "flow": [("QUARANTINE", wh_user, 12), ("UNDER_TEST", qc_user, 5)],
    },
    {
        "material": ("Omeprazole BP",                  "ITM-006", "KG"),
        "supplier":  "Dr. Reddy's Laboratories Ltd.",
        "manufacturer": "Dr. Reddy's Laboratories Ltd.",
        "batch_number": nb("OMP"), "grn": ng(),
        "pack": "BAG",  "cont": 5,  "per": 10.0,  "total": 50.0,  "uom": "KG",
        "mfg": today-timedelta(days=22), "exp": today+timedelta(days=720), "retest": None,
        "flow": [("QUARANTINE", wh_user, 16), ("UNDER_TEST", qc_user, 9)],
    },

    # ── APPROVED ──────────────────────────────────────────────────────────────
    {
        "material": ("Atorvastatin Calcium IP",        "ITM-007", "KG"),
        "supplier":  "Lupin Ltd.",
        "manufacturer": "Lupin Ltd.",
        "batch_number": nb("ATV"), "grn": ng(),
        "pack": "DRUM", "cont": 4,  "per": 25.0,  "total": 100.0, "uom": "KG",
        "mfg": today-timedelta(days=60), "exp": today+timedelta(days=730), "retest": None,
        "flow": [("QUARANTINE", wh_user, 35), ("UNDER_TEST", qc_user, 25), ("APPROVED", qc_user, 15)],
    },
    {
        "material": ("Azithromycin IP",                "ITM-008", "KG"),
        "supplier":  "Sun Pharmaceutical Industries",
        "manufacturer": "Sun Pharmaceutical Industries",
        "batch_number": nb("AZI"), "grn": ng(),
        "pack": "BAG",  "cont": 6,  "per": 10.0,  "total": 60.0,  "uom": "KG",
        "mfg": today-timedelta(days=50), "exp": today+timedelta(days=540), "retest": None,
        "flow": [("QUARANTINE", wh_user, 30), ("UNDER_TEST", qc_user, 20), ("APPROVED", qc_user, 10)],
    },
    {
        "material": ("Ethanol 96% IP",                 "ITM-009", "L"),
        "supplier":  "Merck Life Sciences Pvt. Ltd.",
        "manufacturer": "Merck Life Sciences Pvt. Ltd.",
        "batch_number": nb("ETH"), "grn": ng(),
        "pack": "DRUM", "cont": 4,  "per": 50.0,  "total": 200.0, "uom": "L",
        "mfg": today-timedelta(days=45), "exp": today+timedelta(days=365), "retest": None,
        "flow": [("QUARANTINE", wh_user, 28), ("UNDER_TEST", qc_user, 18), ("APPROVED", qc_user, 8)],
    },

    # ── REJECTED ──────────────────────────────────────────────────────────────
    {
        "material": ("Losartan Potassium IP",          "ITM-010", "KG"),
        "supplier":  "Aurobindo Pharma Ltd.",
        "manufacturer": "Aurobindo Pharma Ltd.",
        "batch_number": nb("LOS"), "grn": ng(),
        "pack": "BAG",  "cont": 4,  "per": 12.5,  "total": 50.0,  "uom": "KG",
        "mfg": today-timedelta(days=90), "exp": today+timedelta(days=400), "retest": None,
        "flow": [("QUARANTINE", wh_user, 45), ("UNDER_TEST", qc_user, 33), ("REJECTED", qc_user, 22)],
    },
    {
        "material": ("Metronidazole IP",               "ITM-011", "KG"),
        "supplier":  "Lupin Ltd.",
        "manufacturer": "Lupin Ltd.",
        "batch_number": nb("MTZ"), "grn": ng(),
        "pack": "DRUM", "cont": 2,  "per": 25.0,  "total": 50.0,  "uom": "KG",
        "mfg": today-timedelta(days=80), "exp": today+timedelta(days=500), "retest": None,
        "flow": [("QUARANTINE", wh_user, 40), ("UNDER_TEST", qc_user, 28), ("REJECTED", qc_user, 18)],
    },
    {
        "material": ("Diclofenac Sodium IP",           "ITM-012", "KG"),
        "supplier":  "SD Fine Chemicals Ltd.",
        "manufacturer": "SD Fine Chemicals Ltd.",
        "batch_number": nb("DCF"), "grn": ng(),
        "pack": "BAG",  "cont": 3,  "per": 20.0,  "total": 60.0,  "uom": "KG",
        "mfg": today-timedelta(days=75), "exp": today+timedelta(days=480), "retest": None,
        "flow": [("QUARANTINE", wh_user, 42), ("UNDER_TEST", qc_user, 30), ("REJECTED", qc_user, 16)],
    },

    # ── RETEST (APPROVED + retest_date within 15 days) ────────────────────────
    {
        "material": ("Amlodipine Besylate IP",         "ITM-013", "KG"),
        "supplier":  "Cipla Ltd.",
        "manufacturer": "Cipla Ltd.",
        "batch_number": nb("AML"), "grn": ng(),
        "pack": "BAG",  "cont": 5,  "per": 10.0,  "total": 50.0,  "uom": "KG",
        "mfg": today-timedelta(days=180), "exp": today+timedelta(days=900), "retest": today+timedelta(days=4),
        "flow": [("QUARANTINE", wh_user, 60), ("UNDER_TEST", qc_user, 48), ("APPROVED", qc_user, 38)],
    },
    {
        "material": ("Pantoprazole Sodium IP",         "ITM-014", "KG"),
        "supplier":  "Dr. Reddy's Laboratories Ltd.",
        "manufacturer": "Dr. Reddy's Laboratories Ltd.",
        "batch_number": nb("PAN"), "grn": ng(),
        "pack": "BAG",  "cont": 4,  "per": 15.0,  "total": 60.0,  "uom": "KG",
        "mfg": today-timedelta(days=200), "exp": today+timedelta(days=800), "retest": today+timedelta(days=8),
        "flow": [("QUARANTINE", wh_user, 70), ("UNDER_TEST", qc_user, 58), ("APPROVED", qc_user, 46)],
    },
    {
        "material": ("Cetirizine Hydrochloride IP",    "ITM-015", "KG"),
        "supplier":  "Sun Pharmaceutical Industries",
        "manufacturer": "Sun Pharmaceutical Industries",
        "batch_number": nb("CTZ"), "grn": ng(),
        "pack": "DRUM", "cont": 2,  "per": 10.0,  "total": 20.0,  "uom": "KG",
        "mfg": today-timedelta(days=170), "exp": today+timedelta(days=730), "retest": today+timedelta(days=12),
        "flow": [("QUARANTINE", wh_user, 65), ("UNDER_TEST", qc_user, 52), ("APPROVED", qc_user, 40)],
    },
]

# ── 4. Insert ─────────────────────────────────────────────────────────────────
print("Creating batches:")
for i, item in enumerate(BATCHES):
    mat_id = get_or_create_material(*item["material"])
    sup_id = get_or_create_supplier(item["supplier"])
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
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, 0, FALSE, %s, NOW(), NOW()
        ) RETURNING id
    """, (
        mat_id, sup_id, item["batch_number"],
        ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)),
        item["manufacturer"], item["mfg"], item["exp"],
        item["pack"], item["uom"],
        item["cont"], item["per"], item["total"], item["total"],
        final_status, quarantine_loc_id,
        item["retest"],
        wh_user,
    ))
    batch_id = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO grn (batch_id, grn_number, received_by, received_date, created_at)
        VALUES (%s, %s, %s, %s, NOW() - INTERVAL '1 day' * %s)
    """, (batch_id, item["grn"], wh_user, today - timedelta(days=item["flow"][0][2]), item["flow"][0][2]))

    prev = None
    for step_status, step_user, days_ago in item["flow"]:
        cur.execute("""
            INSERT INTO batch_status_history
                (batch_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (%s, %s, %s, %s, %s, NOW() - INTERVAL '1 day' * %s)
        """, (batch_id, prev, step_status, step_user, STATUS_REMARKS.get(step_status, step_status), days_ago))
        prev = step_status

    retest_note = f"  ← retest in {(item['retest'] - today).days}d" if item["retest"] else ""
    flow_str = " → ".join(s for s, _, _ in item["flow"])
    print(f"  [{final_status:<18}]  {item['material'][0]:<36}  {item['grn']}  {item['batch_number']}{retest_note}")

cur.execute("""
    INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, %s, NOW())
    ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number, updated_at = NOW()
""", (year, grn_counter[0]))

conn.commit()
cur.close()
conn.close()
print(f"\nDone — {len(BATCHES)} batches seeded.")
