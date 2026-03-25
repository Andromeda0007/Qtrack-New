# Deploy QTrack API on Render (demo)

Your app uses **async SQLAlchemy + asyncpg**. Render’s Postgres URL usually starts with `postgresql://` — you must use **`postgresql+asyncpg://`** with the same user, password, host, port, and database name.

**Example:**  
Render gives: `postgresql://user:pass@dpg-xxx-a.oregon-postgres.render.com/dbname`  
You set: `postgresql+asyncpg://user:pass@dpg-xxx-a.oregon-postgres.render.com/dbname`

---

## Python version (important for new Render services)

Render’s **default Python is now 3.14.x**. This project’s pinned packages (e.g. **Pillow**, **asyncpg**) often **fail to build** on 3.14 (e.g. `Failed to build 'pillow'` / `KeyError: '__version__'`).

**Do one or both:**

1. Web Service → **Environment** → **`PYTHON_VERSION`** = **`3.12.7`** (fully qualified).
2. **Repo root** file **`.python-version`** with one line: **`3.12.7`** (included in this repo).

`backend/runtime.txt` alone may not control the version on Render; prefer **`PYTHON_VERSION`** or **`.python-version`**.

---

## What you need to give Render (Environment variables)

| Variable | You provide | Notes |
|----------|-------------|--------|
| `PYTHON_VERSION` | Recommended | **`3.12.7`** — avoids broken builds on Render’s default 3.14 |
| `DATABASE_URL` | Yes | From Render Postgres → **replace** `postgresql://` with `postgresql+asyncpg://` |
| `JWT_SECRET` | Yes | Long random string (e.g. `openssl rand -hex 32`) — **never commit** |
| `JWT_ALGORITHM` | Optional | Default `HS256` if omitted |
| `APP_ENV` | Recommended | `production` |
| `DEBUG` | Recommended | `false` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | Default `1440` |
| Mail vars | Optional | For demo you can leave empty if email isn’t required for login |

---

## Steps on Render

1. **Push this repo to GitHub** (if it isn’t already).
2. **New → PostgreSQL** → create DB → copy **Internal Database URL** (or External if API is outside Render).
3. **New → Web Service** → connect repo.
4. **Settings:**
   - **Root Directory:** `backend`
   - **Python:** set **`PYTHON_VERSION=3.12.7`** in Environment and/or use repo-root **`.python-version`**
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
     (Or rely on **Procfile** — Render detects it.)
5. **Environment** → add all variables above.
6. **Deploy.** When the first deploy finishes, open **Shell** on the Web Service and run:
   ```bash
   alembic upgrade head
   ```
   (If you use a seed script for a demo user, run it after migrations.)
7. Test: `https://YOUR-SERVICE.onrender.com/health`  
   API docs: `https://YOUR-SERVICE.onrender.com/docs`

---

## After deploy (mobile demo)

1. Set `BASE_URL` in the app to: `https://YOUR-SERVICE.onrender.com/api/v1`
2. Build a **demo APK** (EAS or local Android build).

**Free tier:** the service **spins down** after idle; first request can take ~30–60s — fine for demos.

---

## Checklist — reply with these when ready

1. **Git repo URL** (GitHub) Render will connect to — is the code pushed?
2. **Region** preference for DB + web (e.g. Oregon).
3. **JWT_SECRET** — will you generate locally or want a one-liner command?
4. **Demo user** — do you already seed users, or need to register first user via API/admin?
