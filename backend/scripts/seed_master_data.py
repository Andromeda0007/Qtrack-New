"""
Seed master data (materials + suppliers) into the Render PostgreSQL DB.

Usage:
    python scripts/seed_master_data.py

Reads DATABASE_URL from .env (requires plain postgresql:// not asyncpg).
Safe to re-run — uses ON CONFLICT DO NOTHING for both tables.
"""

import os
import sys
from datetime import datetime

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# Load .env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

raw_url = os.environ.get("DATABASE_URL", "")
# Strip asyncpg driver if present — psycopg2 needs plain postgresql://
db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")

if not db_url:
    print("DATABASE_URL not set in .env")
    sys.exit(1)

now = datetime.utcnow()

# ── Materials ────────────────────────────────────────────────────────────────
# (material_name, material_code, description, unit_of_measure, default_pack_size)
MATERIALS = [
    ("Paracetamol",            "ITM-001", "Analgesic / antipyretic API",           "KG",  25.000),
    ("Morphine Sulphate",      "ITM-002", "Opioid analgesic API",                  "KG",  25.000),
    ("Amoxicillin Trihydrate", "ITM-003", "Beta-lactam antibiotic API",            "KG",  25.000),
    ("Ibuprofen",              "ITM-004", "NSAID analgesic API",                   "KG",  25.000),
    ("Metformin HCl",          "ITM-005", "Anti-diabetic API",                     "KG",  25.000),
    ("Starch (Maize)",         "ITM-006", "Pharmaceutical excipient — binder",     "KG",  50.000),
    ("Microcrystalline Cellulose", "ITM-007", "Excipient — filler/binder",         "KG",  25.000),
    ("Magnesium Stearate",     "ITM-008", "Excipient — lubricant",                 "KG",  25.000),
    ("Talcum Powder",          "ITM-009", "Excipient — glidant",                   "KG",  50.000),
    ("Lactose Monohydrate",    "ITM-010", "Excipient — diluent",                   "KG",  25.000),
    ("Ethanol 95%",            "ITM-011", "Solvent / sanitiser",                   "L",   50.000),
    ("Purified Water",         "ITM-012", "Process water (WFI grade)",             "L",  200.000),
    ("Aluminium Foil",         "ITM-013", "Blister packaging material",            "KG",  10.000),
    ("PVC Film",               "ITM-014", "Blister packaging — base film",         "KG",  25.000),
    ("HDPE Bottles 100ml",     "ITM-015", "Primary packaging — bottles",          "COUNT", 1000),
]

# ── Suppliers ────────────────────────────────────────────────────────────────
# (supplier_name, contact_person, phone, email, address)
SUPPLIERS = [
    ("SciGen Pharma Ltd",      "Raj Mehta",    "+91-9800001001", "raj@scigen.com",      "Mumbai, Maharashtra"),
    ("Alkem Laboratories",     "Priya Sharma", "+91-9800001002", "priya@alkem.in",      "Andheri East, Mumbai"),
    ("Sun Pharma Industries",  "Vikram Joshi", "+91-9800001003", "vikram@sunpharma.in", "Vadodara, Gujarat"),
    ("Cipla Ltd",              "Neeha Patel",  "+91-9800001004", "neeha@cipla.com",     "Goa, India"),
    ("Lupin Limited",          "Amit Singh",   "+91-9800001005", "amit@lupin.com",      "Pune, Maharashtra"),
    ("Divi's Laboratories",    "Suresh Kumar", "+91-9800001006", "suresh@divislabs.com","Hyderabad, Telangana"),
    ("Hetero Drugs Ltd",       "Rani Reddy",   "+91-9800001007", "rani@hetero.net",     "Hyderabad, Telangana"),
    ("Aurobindo Pharma",       "Kiran Das",    "+91-9800001008", "kiran@aurobindo.com", "Hyderabad, Telangana"),
]

# ── item_counter bootstrap ───────────────────────────────────────────────────
ITEM_COUNTER_LAST = len(MATERIALS)  # 15 — next auto code will be ITM-016


def main():
    print(f"Connecting to DB …")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    # ── Materials ────────────────────────────────────────────────────────────
    print(f"\nInserting {len(MATERIALS)} materials …")
    mat_rows = [
        (name, code, desc, unit, ps, True, now, now)
        for name, code, desc, unit, ps in MATERIALS
    ]
    execute_values(
        cur,
        """
        INSERT INTO materials
            (material_name, material_code, description, unit_of_measure,
             default_pack_size, is_active, created_at, updated_at)
        VALUES %s
        ON CONFLICT (material_code) DO NOTHING
        """,
        mat_rows,
    )
    cur.execute("SELECT COUNT(*) FROM materials")
    print(f"  materials table now has {cur.fetchone()[0]} rows")

    # ── Seed item_counter so app-generated codes start at ITM-016 ────────────
    cur.execute(
        """
        INSERT INTO item_counter (id, last_number, updated_at)
        VALUES (1, %s, %s)
        ON CONFLICT (id) DO UPDATE
          SET last_number = GREATEST(item_counter.last_number, EXCLUDED.last_number),
              updated_at  = EXCLUDED.updated_at
        """,
        (ITEM_COUNTER_LAST, now),
    )
    cur.execute("SELECT last_number FROM item_counter WHERE id = 1")
    print(f"  item_counter.last_number = {cur.fetchone()[0]}")

    # ── Suppliers ────────────────────────────────────────────────────────────
    print(f"\nInserting {len(SUPPLIERS)} suppliers …")
    sup_rows = [
        (name, contact, phone, email, addr, True, now)
        for name, contact, phone, email, addr in SUPPLIERS
    ]
    execute_values(
        cur,
        """
        INSERT INTO suppliers
            (supplier_name, contact_person, phone, email, address, is_active, created_at)
        VALUES %s
        ON CONFLICT DO NOTHING
        """,
        sup_rows,
    )
    cur.execute("SELECT COUNT(*) FROM suppliers")
    print(f"  suppliers table now has {cur.fetchone()[0]} rows")

    cur.close()
    conn.close()
    print("\nDone. Master data seeded successfully.")


if __name__ == "__main__":
    main()
