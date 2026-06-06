"""
Seed v7: 10 realistic pharma raw-material batches spread across all dashboard phases.

Distribution:
  QUARANTINE      × 2
  UNDER_TEST      × 2
  APPROVED        × 3  (one issued_to_production, one due for retest in 8 days)
  REJECTED        × 2
  APPROVED+retest × 1  (retest_date in 8 days, triggers Retest tile)

Cleans up any previous SEED-v* batches before inserting.

Run from repo root:
    python backend/scripts/seed_test_batches_v7.py
"""
import os, sys, random, string
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# ── Load .env ─────────────────────────────────────────────────────────────────
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

raw_url = os.environ.get("DATABASE_URL", "")
if not raw_url:
    print("DATABASE_URL not set"); sys.exit(1)

# Strip async driver prefix, swap internal → external Oregon hostname
db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
db_url = db_url.replace(
    "dpg-d8i3qsldt1ts73ethv50-a/",
    "dpg-d8i3qsldt1ts73ethv50-a.singapore-postgres.render.com/",
)

conn = psycopg2.connect(db_url + "?sslmode=require")
conn.autocommit = False
cur = conn.cursor()

# ── 1. Clean up ALL existing batches ──────────────────────────────────────────
cur.execute("SELECT id, batch_number FROM batches")
old = cur.fetchall()
if old:
    ids = [r[0] for r in old]
    print(f"Removing all {len(old)} existing batches...")
    cur.execute("DELETE FROM batch_status_history WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM stock_movements    WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM qc_results         WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batch_containers   WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM grn               WHERE batch_id = ANY(%s)", (ids,))
    cur.execute("DELETE FROM batches            WHERE id       = ANY(%s)", (ids,))
    print("  Done.\n")

# ── 2. Helpers ────────────────────────────────────────────────────────────────
def uid():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

def get_or_create_material(name, code, uom):
    cur.execute("SELECT id FROM materials WHERE material_code = %s", (code,))
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
    SELECT u.id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.role_name = 'WAREHOUSE_USER' AND u.is_active = TRUE LIMIT 1
""")
row = cur.fetchone()
if not row:
    cur.execute("SELECT id FROM users WHERE is_active = TRUE LIMIT 1")
    row = cur.fetchone()
created_by = row[0]

today = date.today()
year  = today.year

cur.execute("""
    SELECT COALESCE(MAX(CAST(SPLIT_PART(grn_number, '-', 3) AS INTEGER)), 0)
    FROM grn WHERE grn_number LIKE %s
""", (f"GRN-{year}-%",))
grn_base = cur.fetchone()[0]

# ── 3. 10 batches ─────────────────────────────────────────────────────────────
ITEMS = [
    # ── QUARANTINE ×2 ─────────────────────────────────────────────────────────
    dict(
        status="QUARANTINE",
        material_name="Paracetamol API",      material_code="ITM-P01", uom="KG",
        supplier="Aarav Pharma Chemicals",    manufacturer="Aarav Pharma Ltd.",
        batch_number=f"V7-PC-{uid()}",        pack_type="DRUM",
        containers=6,  per_container=25.0,    total=150.0,
        mfg=today - timedelta(days=10),       exp=today + timedelta(days=700),
        retest_date=None,
        po_number="PO-2026-001",              po_date=today - timedelta(days=12),
        invoice_number="INV-2026-010",        invoice_date=today - timedelta(days=11),
        date_format="DD-MM-YYYY",             issued_to_production=False,
        remarks="Standard quality grade. Handle with care.",
    ),
    dict(
        status="QUARANTINE",
        material_name="Ibuprofen Micronized",  material_code="ITM-I02", uom="KG",
        supplier="Sigma Excipients Pvt Ltd",   manufacturer="Sigma Corp.",
        batch_number=f"V7-IB-{uid()}",         pack_type="BAG",
        containers=4,  per_container=50.0,     total=200.0,
        mfg=today - timedelta(days=5),         exp=today + timedelta(days=730),
        retest_date=None,
        po_number="PO-2026-002",               po_date=today - timedelta(days=7),
        invoice_number="INV-2026-011",         invoice_date=today - timedelta(days=6),
        date_format="YYYY-MM-DD",              issued_to_production=False,
        remarks="Micronized grade — store below 25°C.",
    ),

    # ── UNDER_TEST ×2 ─────────────────────────────────────────────────────────
    dict(
        status="UNDER_TEST",
        material_name="Microcrystalline Cellulose", material_code="ITM-M03", uom="KG",
        supplier="National Excipients Ltd.",        manufacturer="NE Pharma",
        batch_number=f"V7-MCC-{uid()}",             pack_type="BAG",
        containers=10, per_container=20.0,          total=200.0,
        mfg=today - timedelta(days=20),             exp=today + timedelta(days=1095),
        retest_date=None,
        po_number="PO-2026-003",                    po_date=today - timedelta(days=22),
        invoice_number="INV-2026-012",              invoice_date=today - timedelta(days=21),
        date_format="DD-MM-YYYY",                   issued_to_production=False,
        remarks="PH102 grade. COA attached.",
    ),
    dict(
        status="UNDER_TEST",
        material_name="Talc Pharma Grade",   material_code="ITM-T04", uom="KG",
        supplier="PureChem Distributors",    manufacturer="PureChem Labs",
        batch_number=f"V7-TAL-{uid()}",      pack_type="DRUM",
        containers=3,  per_container=40.0,   total=120.0,
        mfg=today - timedelta(days=30),      exp=today + timedelta(days=900),
        retest_date=None,
        po_number="PO-2026-004",             po_date=today - timedelta(days=32),
        invoice_number="INV-2026-013",       invoice_date=today - timedelta(days=31),
        date_format="MM-YYYY",               issued_to_production=False,
        remarks=None,
    ),

    # ── APPROVED ×3 ───────────────────────────────────────────────────────────
    dict(
        status="APPROVED",
        material_name="Ethanol 96%",          material_code="ITM-E05", uom="L",
        supplier="National Solvents Co.",     manufacturer="National Solvents Co.",
        batch_number=f"V7-ETH-{uid()}",       pack_type="DRUM",
        containers=4,  per_container=50.0,    total=200.0,
        mfg=today - timedelta(days=120),      exp=today + timedelta(days=548),
        retest_date=None,
        po_number="PO-2026-005",              po_date=today - timedelta(days=122),
        invoice_number="INV-2026-014",        invoice_date=today - timedelta(days=121),
        date_format="DD-MM-YYYY",             issued_to_production=False,
        remarks="IPA grade. Flammable — store in solvent room.",
    ),
    dict(
        status="APPROVED",
        material_name="Starch Maize IP",      material_code="ITM-S06", uom="KG",
        supplier="Horizon Raw Materials",     manufacturer="Horizon Industries",
        batch_number=f"V7-STR-{uid()}",       pack_type="BAG",
        containers=5,  per_container=40.0,    total=200.0,
        mfg=today - timedelta(days=90),       exp=today + timedelta(days=365),
        retest_date=today + timedelta(days=8),
        po_number="PO-2026-006",              po_date=today - timedelta(days=92),
        invoice_number="INV-2026-015",        invoice_date=today - timedelta(days=91),
        date_format="DD-MM-YYYY",             issued_to_production=False,
        remarks="Retest due soon — schedule QC.",
    ),
    dict(
        status="APPROVED",
        material_name="Caffeine Anhydrous",   material_code="ITM-C07", uom="KG",
        supplier="Aarav Pharma Chemicals",    manufacturer="Aarav Pharma Ltd.",
        batch_number=f"V7-CAF-{uid()}",       pack_type="BOX",
        containers=2,  per_container=10.0,    total=20.0,
        mfg=today - timedelta(days=200),      exp=today + timedelta(days=600),
        retest_date=None,
        po_number="PO-2026-007",              po_date=today - timedelta(days=202),
        invoice_number="INV-2026-016",        invoice_date=today - timedelta(days=201),
        date_format="YYYY-MM-DD",             issued_to_production=True,
        remarks="Issued to production line 3.",
    ),

    # ── REJECTED ×2 ───────────────────────────────────────────────────────────
    dict(
        status="REJECTED",
        material_name="Magnesium Stearate",   material_code="ITM-G08", uom="KG",
        supplier="Sigma Excipients Pvt Ltd",  manufacturer="Sigma Corp.",
        batch_number=f"V7-MGS-{uid()}",       pack_type="BAG",
        containers=2,  per_container=10.0,    total=20.0,
        mfg=today - timedelta(days=180),      exp=today + timedelta(days=400),
        retest_date=None,
        po_number="PO-2026-008",              po_date=today - timedelta(days=182),
        invoice_number="INV-2026-017",        invoice_date=today - timedelta(days=181),
        date_format="DD-MM-YYYY",             issued_to_production=False,
        remarks="Failed assay test. Return to supplier.",
    ),
    dict(
        status="REJECTED",
        material_name="Lactose Monohydrate",  material_code="ITM-L09", uom="KG",
        supplier="PureChem Distributors",     manufacturer="PureChem Labs",
        batch_number=f"V7-LCT-{uid()}",       pack_type="BAG",
        containers=8,  per_container=25.0,    total=200.0,
        mfg=today - timedelta(days=150),      exp=today + timedelta(days=600),
        retest_date=None,
        po_number="PO-2026-009",              po_date=today - timedelta(days=152),
        invoice_number="INV-2026-018",        invoice_date=today - timedelta(days=151),
        date_format="DD-MM-YYYY",             issued_to_production=False,
        remarks="Moisture content out of spec.",
    ),

    # ── APPROVED ×1 ───────────────────────────────────────────────────────────
    dict(
        status="APPROVED",
        material_name="Povidone K30",         material_code="ITM-V10", uom="KG",
        supplier="National Excipients Ltd.",  manufacturer="NE Pharma",
        batch_number=f"V7-POV-{uid()}",       pack_type="BAG",
        containers=3,  per_container=33.333,  total=100.0,
        mfg=today - timedelta(days=60),       exp=today + timedelta(days=800),
        retest_date=None,
        po_number="PO-2026-010",              po_date=today - timedelta(days=62),
        invoice_number="INV-2026-019",        invoice_date=today - timedelta(days=61),
        date_format="MM-YYYY",               issued_to_production=False,
        remarks=None,
    ),
]

STATUS_CHAIN = {
    "QUARANTINE": [("QUARANTINE", None,          1)],
    "UNDER_TEST": [("QUARANTINE", None,          5), ("UNDER_TEST",  "QUARANTINE", 2)],
    "APPROVED":   [("QUARANTINE", None,          7), ("UNDER_TEST",  "QUARANTINE", 4), ("APPROVED",   "UNDER_TEST",  1)],
    "REJECTED":   [("QUARANTINE", None,          7), ("UNDER_TEST",  "QUARANTINE", 4), ("REJECTED",   "UNDER_TEST",  1)],
}

print("Creating 10 batches:\n")
for i, item in enumerate(ITEMS):
    mat_id = get_or_create_material(item["material_name"], item["material_code"], item["uom"])

    grn_number = f"GRN-{year}-{grn_base + i + 1:03d}"
    public_code = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

    supplier_id = get_or_create_supplier(item["supplier"])

    cur.execute("""
        INSERT INTO batches (
            material_id, batch_number, public_code,
            manufacturer_name, manufacture_date, expiry_date,
            pack_type, unit_of_measure, container_count, container_quantity,
            total_quantity, remaining_quantity, status, location_id,
            retest_date, retest_cycle, labels_printed,
            supplier_id, po_number, po_date,
            invoice_number, invoice_date,
            date_format, remarks,
            issued_to_production,
            created_by, created_at, updated_at
        ) VALUES (
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, 0, FALSE,
            %s, %s, %s,
            %s, %s,
            %s, %s,
            %s,
            %s, NOW(), NOW()
        ) RETURNING id
    """, (
        mat_id, item["batch_number"], public_code,
        item["manufacturer"], item["mfg"], item["exp"],
        item["pack_type"], item["uom"], item["containers"], item["per_container"],
        item["total"], item["total"], item["status"], quarantine_loc_id,
        item["retest_date"],
        supplier_id, item.get("po_number"), item.get("po_date"),
        item.get("invoice_number"), item.get("invoice_date"),
        item["date_format"], item.get("remarks"),
        item["issued_to_production"],
        created_by,
    ))
    batch_id = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO grn (batch_id, grn_number, received_by, received_date, created_at)
        VALUES (%s, %s, %s, %s, NOW())
    """, (batch_id, grn_number, created_by, today))

    for new_st, old_st, days_ago in STATUS_CHAIN.get(item["status"], []):
        cur.execute("""
            INSERT INTO batch_status_history
                (batch_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (%s, %s, %s, %s, 'Seed v7', NOW() - INTERVAL '%s days')
        """, (batch_id, old_st, new_st, created_by, days_ago))

    if item["issued_to_production"]:
        cur.execute("""
            INSERT INTO batch_status_history
                (batch_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (%s, 'APPROVED', 'ISSUED_TO_PRODUCTION', %s, 'Seed v7 — issued', NOW())
        """, (batch_id, created_by))
        cur.execute("UPDATE batches SET issued_at = NOW() WHERE id = %s", (batch_id,))

    tag = ""
    if item["retest_date"]:
        tag = f"  ← retest in {(item['retest_date'] - today).days}d"
    if item["issued_to_production"]:
        tag = "  ← issued to production"
    print(f"  [{item['status']:<12}]  {item['material_name']:<28}  {grn_number}  {item['batch_number']}{tag}")

cur.execute("""
    INSERT INTO grn_counters (year, last_number, updated_at) VALUES (%s, %s, NOW())
    ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number, updated_at = NOW()
""", (year, grn_base + len(ITEMS)))

conn.commit()
cur.close()
conn.close()
print(f"\nDone — {len(ITEMS)} batches seeded.")
