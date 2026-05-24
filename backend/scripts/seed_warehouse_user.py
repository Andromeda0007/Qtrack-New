"""
Seed a ready-to-use WAREHOUSE_USER account.

Username : warehouse01
Password : Warehouse@123
is_first_login is set to False — no password-change screen on first login.

Safe to re-run (ON CONFLICT DO NOTHING).
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    import bcrypt as _bcrypt
except ImportError:
    print("bcrypt not installed. Run: pip install bcrypt")
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
db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
# Use external Render hostname for local execution
db_url = db_url.replace("dpg-d7mbsgbbc2fs7385cmg0-a/", "dpg-d7mbsgbbc2fs7385cmg0-a.singapore-postgres.render.com/")

if not db_url:
    print("DATABASE_URL not set")
    sys.exit(1)

USERNAME = "warehouse01"
PASSWORD = "Warehouse@123"
FULL_NAME = "Warehouse User"
ROLE_NAME = "WAREHOUSE_USER"

password_hash = _bcrypt.hashpw(PASSWORD.encode(), _bcrypt.gensalt()).decode()

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# Get role id
cur.execute("SELECT id FROM roles WHERE role_name = %s", (ROLE_NAME,))
row = cur.fetchone()
if not row:
    print(f"Role {ROLE_NAME} not found — make sure migrations have run.")
    sys.exit(1)
role_id = row[0]

cur.execute("""
    INSERT INTO users (name, username, email, password_hash, role_id, is_active, is_first_login, failed_login_attempts, mfa_enabled, created_at, updated_at)
    VALUES (%s, %s, %s, %s, %s, TRUE, FALSE, 0, FALSE, NOW(), NOW())
    ON CONFLICT (username) DO UPDATE
      SET password_hash  = EXCLUDED.password_hash,
          is_first_login = FALSE,
          is_active      = TRUE,
          role_id        = EXCLUDED.role_id
    RETURNING id, username, is_first_login;
""", (FULL_NAME, USERNAME, f"{USERNAME}@qtrack.local", password_hash, role_id))

uid, uname, first_login = cur.fetchone()
cur.close()
conn.close()

print(f"Done.")
print(f"  User ID       : {uid}")
print(f"  Username      : {uname}")
print(f"  Password      : {PASSWORD}")
print(f"  Role          : {ROLE_NAME}")
print(f"  is_first_login: {first_login}")
