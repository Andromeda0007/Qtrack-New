"""
Full cleanup + reseed with 3+ items in every phase.

Phases seeded:
  3 × QUARANTINE
  3 × UNDER_TEST       (quarantine → under test)
  3 × APPROVED         (quarantine → under test → approved)
  3 × REJECTED         (quarantine → under test → rejected)
  3 × RETEST           (approved + retest_date within 15 days)

Run: python backend/scripts/seed_test_batches_v5.py
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

SEED_CODES = (
    'ITM-P01','ITM-M02','ITM-E03','ITM-G04','ITM-S05','ITM-C06',
    'ITM-T07','ITM-B08','ITM-L09','ITM-A10','ITM-D11','ITM-R12','ITM-H13','ITM-Z14','ITM-X15',
)
SEED_PREFIXES = (
    'PAR-','MCC2-','ETH2-','MGS-','NaCl2-','CIT-',
    'TLC-','BEN-','LAC-','ASC-','DEX-','RIB-','HYD-','ZIN-','XYL-',
)

conn = psycopg2.connect(db_url)
conn.autocommit = False
cur = conn.cursor()

# ── 1. Delete all previous test batches ──────────────────────────────────────
conditions = " OR ".join([f"b.batch_number LIKE '{p}%%'" for p in SEED_PREFIXES])
cur.execute(f"""
    SELECT b.id, b.batch_number FROM batches b
    LEFT JOIN materials m ON b.material_id = m.id
    WHERE {conditions}
       OR m.material_code IN %s
""", (SEED_CODES,))
old = cur.fetchall()
if old:
    ids = [r[0] for r in old]
    print(f"Deleting {len(old)} old test batches...")
    cur.execute("DELETE FROM batch_status_history WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM stock_movements      WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM qc_results           WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batch_containers      WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM grn                  WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batches              WHERE id        = ANY(%s)", (ids,))
    print(f"  Deleted {len(old)} batches.\n")
else:
    print("No old test batches found.\n")

# ── 2. Helpers ────────────────────────────────────────────────────────────────
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

cur.execute("""
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.role_name IN ('QC_HEAD','QC_EXECUTIVE') AND u.is_active = TRUE LIMIT 1
""")
row = cur.fetchone()
qc_user = row[0] if row else wh_user

today = date.today()
year  = today.year

cur.execute("SELECT COALESCE(MAX(CAST(SPLIT_PART(grn_number,'-',3) AS INTEGER)),0) FROM grn WHERE grn_number LIKE %s", (f"GRN-{year}-%",))
grn_base = cur.fetchone()[0]

STATUS_REMARKS = {
    "QUARANTINE": "Received into quarantine",
    "UNDER_TEST": "Sample submitted for testing",
    "APPROVED":   "QC approved",
    "REJECTED":   "QC rejected — failed specifications",
}

# ── 3. Batch definitions ──────────────────────────────────────────────────────
# flow = [(status, user, days_ago), ...]  — last entry = final status

BATCHES = [

    # ── QUARANTINE (3 items) ──────────────────────────────────────────────────
    {
        "material": ("Paracetamol API",           "ITM-P01", "KG"),
        "supplier": "Aarav Pharma Chemicals",  "manufacturer": "Aarav Pharma Ltd.",
        "prefix": "PAR",  "pack": "DRUM", "cont": 6,  "per": 25.0,  "total": 150.0, "uom": "KG",
        "mfg": today-timedelta(days=5),   "exp": today+timedelta(days=700), "retest": None,
        "flow": [("QUARANTINE", wh_user, 1)],
    },
    {
        "material": ("Citric Acid Monohydrate",   "ITM-C06", "KG"),
        "supplier": "BioSynth Ingredients",    "manufacturer": "BioSynth Ltd.",
        "prefix": "CIT",  "pack": "BAG",  "cont": 4,  "per": 50.0,  "total": 200.0, "uom": "KG",
        "mfg": today-timedelta(days=10),  "exp": today+timedelta(days=820), "retest": None,
        "flow": [("QUARANTINE", wh_user, 2)],
    },
    {
        "material": ("Talc Pharmaceutical Grade", "ITM-T07", "KG"),
        "supplier": "Mineral Pharma Pvt Ltd",  "manufacturer": "Mineral Pharma Ltd.",
        "prefix": "TLC",  "pack": "BAG",  "cont": 5,  "per": 40.0,  "total": 200.0, "uom": "KG",
        "mfg": today-timedelta(days=3),   "exp": today+timedelta(days=1000),"retest": None,
        "flow": [("QUARANTINE", wh_user, 3)],
    },

    # ── UNDER TEST (3 items) ──────────────────────────────────────────────────
    {
        "material": ("Microcrystalline Cellulose","ITM-M02", "KG"),
        "supplier": "Sigma Excipients Pvt Ltd", "manufacturer": "Sigma Corp.",
        "prefix": "MCC2", "pack": "BAG",  "cont": 10, "per": 20.0,  "total": 200.0, "uom": "KG",
        "mfg": today-timedelta(days=20),  "exp": today+timedelta(days=1095),"retest": None,
        "flow": [("QUARANTINE", wh_user, 12), ("UNDER_TEST", qc_user, 7)],
    },
    {
        "material": ("Benzalkonium Chloride",     "ITM-B08", "KG"),
        "supplier": "ChemSource India",        "manufacturer": "ChemSource Ltd.",
        "prefix": "BEN",  "pack": "DRUM", "cont": 2,  "per": 50.0,  "total": 100.0, "uom": "KG",
        "mfg": today-timedelta(days=25),  "exp": today+timedelta(days=730), "retest": None,
        "flow": [("QUARANTINE", wh_user, 15), ("UNDER_TEST", qc_user, 9)],
    },
    {
        "material": ("Lactose Monohydrate",       "ITM-L09", "KG"),
        "supplier": "DairyPharma Supplies",    "manufacturer": "DairyPharma Corp.",
        "prefix": "LAC",  "pack": "BAG",  "cont": 8,  "per": 25.0,  "total": 200.0, "uom": "KG",
        "mfg": today-timedelta(days=18),  "exp": today+timedelta(days=900), "retest": None,
        "flow": [("QUARANTINE", wh_user, 10), ("UNDER_TEST", qc_user, 5)],
    },

    # ── APPROVED (3 items) ───────────────────────────────────────────────────
    {
        "material": ("Ethanol 96%",               "ITM-E03", "L"),
        "supplier": "National Solvents Co.",   "manufacturer": "National Solvents Co.",
        "prefix": "ETH2", "pack": "DRUM", "cont": 4,  "per": 50.0,  "total": 200.0, "uom": "L",
        "mfg": today-timedelta(days=60),  "exp": today+timedelta(days=548), "retest": None,
        "flow": [("QUARANTINE", wh_user, 30), ("UNDER_TEST", qc_user, 22), ("APPROVED", qc_user, 14)],
    },
    {
        "material": ("Ascorbic Acid",             "ITM-A10", "KG"),
        "supplier": "VitaChem Distributors",   "manufacturer": "VitaChem Labs.",
        "prefix": "ASC",  "pack": "BAG",  "cont": 6,  "per": 20.0,  "total": 120.0, "uom": "KG",
        "mfg": today-timedelta(days=45),  "exp": today+timedelta(days=600), "retest": None,
        "flow": [("QUARANTINE", wh_user, 25), ("UNDER_TEST", qc_user, 18), ("APPROVED", qc_user, 10)],
    },
    {
        "material": ("Dextrose Anhydrous",        "ITM-D11", "KG"),
        "supplier": "SweetPharma Ltd.",        "manufacturer": "SweetPharma Industries.",
        "prefix": "DEX",  "pack": "BAG",  "cont": 5,  "per": 30.0,  "total": 150.0, "uom": "KG",
        "mfg": today-timedelta(days=50),  "exp": today+timedelta(days=730), "retest": None,
        "flow": [("QUARANTINE", wh_user, 28), ("UNDER_TEST", qc_user, 20), ("APPROVED", qc_user, 12)],
    },

    # ── REJECTED (3 items) ───────────────────────────────────────────────────
    {
        "material": ("Magnesium Stearate",        "ITM-G04", "KG"),
        "supplier": "Horizon Raw Materials",   "manufacturer": "Horizon Industries.",
        "prefix": "MGS",  "pack": "BAG",  "cont": 2,  "per": 10.0,  "total": 20.0,  "uom": "KG",
        "mfg": today-timedelta(days=90),  "exp": today+timedelta(days=400), "retest": None,
        "flow": [("QUARANTINE", wh_user, 40), ("UNDER_TEST", qc_user, 30), ("REJECTED", qc_user, 20)],
    },
    {
        "material": ("Riboflavin (Vit B2)",       "ITM-R12", "KG"),
        "supplier": "NutriPharma Supplies",    "manufacturer": "NutriPharma Corp.",
        "prefix": "RIB",  "pack": "BAG",  "cont": 3,  "per": 5.0,   "total": 15.0,  "uom": "KG",
        "mfg": today-timedelta(days=80),  "exp": today+timedelta(days=500), "retest": None,
        "flow": [("QUARANTINE", wh_user, 35), ("UNDER_TEST", qc_user, 26), ("REJECTED", qc_user, 18)],
    },
    {
        "material": ("Hydroxypropyl Cellulose",   "ITM-H13", "KG"),
        "supplier": "PolymerPharma Pvt Ltd",   "manufacturer": "PolymerPharma Ltd.",
        "prefix": "HYD",  "pack": "DRUM", "cont": 2,  "per": 25.0,  "total": 50.0,  "uom": "KG",
        "mfg": today-timedelta(days=70),  "exp": today+timedelta(days=450), "retest": None,
        "flow": [("QUARANTINE", wh_user, 38), ("UNDER_TEST", qc_user, 28), ("REJECTED", qc_user, 15)],
    },

    # ── RETEST — APPROVED + retest_date within 15 days (3 items) ─────────────
    {
        "material": ("Sodium Chloride IP",        "ITM-S05", "KG"),
        "supplier": "PureChem Distributors",   "manufacturer": "PureChem Labs.",
        "prefix": "NaCl2","pack": "BAG",  "cont": 8,  "per": 12.5,  "total": 100.0, "uom": "KG",
        "mfg": today-timedelta(days=200), "exp": today+timedelta(days=900), "retest": today+timedelta(days=5),
        "flow": [("QUARANTINE", wh_user, 50), ("UNDER_TEST", qc_user, 40), ("APPROVED", qc_user, 30)],
    },
    {
        "material": ("Zinc Oxide",                "ITM-Z14", "KG"),
        "supplier": "MetalPharma Chemicals",   "manufacturer": "MetalPharma Ltd.",
        "prefix": "ZIN",  "pack": "BAG",  "cont": 4,  "per": 10.0,  "total": 40.0,  "uom": "KG",
        "mfg": today-timedelta(days=180), "exp": today+timedelta(days=1095),"retest": today+timedelta(days=9),
        "flow": [("QUARANTINE", wh_user, 45), ("UNDER_TEST", qc_user, 35), ("APPROVED", qc_user, 25)],
    },
    {
        "material": ("Xylitol",                   "ITM-X15", "KG"),
        "supplier": "SweetNaturals Pvt Ltd",   "manufacturer": "SweetNaturals Corp.",
        "prefix": "XYL",  "pack": "BAG",  "cont": 6,  "per": 20.0,  "total": 120.0, "uom": "KG",
        "mfg": today-timedelta(days=160), "exp": today+timedelta(days=800), "retest": today+timedelta(days=13),
        "flow": [("QUARANTINE", wh_user, 42), ("UNDER_TEST", qc_user, 32), ("APPROVED", qc_user, 22)],
    },
]

# ── 4. Insert ─────────────────────────────────────────────────────────────────
print("Creating batches:")
for i, item in enumerate(BATCHES):
    mat_id = get_or_create_material(*item["material"])
    sup_id = get_or_create_supplier(item["supplier"])
    grn_num    = grn_base + i + 1
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
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, 0, FALSE, %s, NOW(), NOW()
        ) RETURNING id
    """, (
        mat_id, sup_id,
        f"{item['prefix']}-{uid4()}",
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
    """, (batch_id, grn_number, wh_user, today - timedelta(days=item["flow"][0][2]), item["flow"][0][2]))

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
    print(f"  [{final_status:<18}]  {item['material'][0]:<32}  {grn_number}  {flow_str}{retest_note}")

cur.execute("""
    INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, %s, NOW())
    ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number, updated_at = NOW()
""", (year, grn_base + len(BATCHES)))

conn.commit()
cur.close()
conn.close()
print(f"\nDone — {len(BATCHES)} batches seeded across 5 phases.")
