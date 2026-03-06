import psycopg2
from passlib.context import CryptContext

ctx = CryptContext(schemes=['bcrypt'])
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/qtrack')
cur = conn.cursor()
cur.execute('SELECT username, password_hash, is_active, is_first_login FROM users')
users = cur.fetchall()
print("Users in DB:")
for u in users:
    print(f"  username={u[0]}, is_active={u[2]}, is_first_login={u[3]}")
    result = ctx.verify('Admin@123', u[1])
    print(f"  password 'Admin@123' matches: {result}")
conn.close()
