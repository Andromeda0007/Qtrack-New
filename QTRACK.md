# QTrack — Warehouse & Quality Management System

## What is QTrack?

QTrack is an **enterprise warehouse and quality management system** built for pharmaceutical / chemical warehouse operations. It tracks raw materials from goods receipt through quality testing, approval/rejection, production issue, finished goods inspection, and dispatch — with a full audit trail at every step.

Key characteristics:
- **QR-driven workflow** — every batch gets a unique QR code; workers scan to act
- **Role-based access control** — 8 roles, each with specific permissions
- **Closed-access** — no public signup; Super Admin creates all user accounts
- **Mobile-first** — Android + iOS via Expo (React Native)
- **~100,000 transactions/month**, max 30 concurrent users

---

## Architecture

```
React Native / Expo (Mobile App)
           |
        HTTPS / JWT
           |
  FastAPI Backend (Python)
           |
     PostgreSQL Database
```

Three-layer monolith — intentionally no Redis, Kafka, or microservices (scale doesn't require it).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo ~54, TypeScript, Zustand, Axios |
| Backend | Python 3.12, FastAPI 0.111, SQLAlchemy 2 (async), Alembic |
| Database | PostgreSQL |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Email | FastAPI-Mail / SMTP (Amazon SES for production) |
| QR Codes | `qrcode[pil]`, Pillow |
| Labels | ReportLab (PDF generation) |
| Scheduler | APScheduler (retesting alerts) |
| MFA | PyOTP / TOTP (Google Authenticator) |

---

## Project Structure

```
e:\wms\
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── main.py             # App entry point, router registration
│   │   ├── config.py           # Settings (loaded from .env)
│   │   ├── database.py         # Async SQLAlchemy engine + Base
│   │   ├── scheduler.py        # APScheduler (retesting alerts)
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── auth/               # Login, JWT, password reset
│   │   ├── users/              # User CRUD (Super Admin)
│   │   ├── materials/          # Raw material master data
│   │   ├── suppliers/          # Supplier master
│   │   ├── inventory/          # Stock, batches, movements
│   │   ├── qc/                 # Quality Control (test → approve/reject)
│   │   ├── qa/                 # Quality Assurance (finished goods)
│   │   ├── production/         # Production issue & finished goods
│   │   ├── finished_goods/     # FG batches
│   │   ├── notifications/      # In-app notifications
│   │   ├── chat/               # Real-time chat (WebSocket)
│   │   └── audit/              # Immutable audit trail
│   ├── alembic/                # Database migrations
│   ├── requirements.txt
│   ├── alembic.ini
│   └── Procfile
│
└── mobile/                     # React Native / Expo mobile app
    ├── src/
    │   ├── api/                # Axios API clients per module
    │   ├── screens/            # All screens (auth, inventory, qc, qa, chat …)
    │   ├── components/common/  # Shared UI components
    │   ├── navigation/         # Stack & tab navigators
    │   ├── store/              # Zustand auth store
    │   ├── hooks/              # Custom hooks (chat unread, notif unread)
    │   └── config/             # API base URL config
    ├── app.json
    ├── package.json
    └── eas.json
```

---

## Roles & Permissions

| # | Role | Key Permissions |
|---|------|----------------|
| 1 | **Super Admin** | Create/deactivate users, assign roles, view audit logs |
| 2 | **Warehouse User** | Create GRN, update location, issue material, receive/dispatch FG |
| 3 | **Warehouse Head** | Everything Warehouse User can do + revise GRN, reprint labels |
| 4 | **QC Executive** | Generate A.R. number, withdraw sample, mark UNDER TEST |
| 5 | **QC Head** | Approve/reject material, set retesting date, grade transfer |
| 6 | **QA Executive** | Verify FG quantity, physical quality check |
| 7 | **QA Head** | Approve/reject finished goods |
| 8 | **Production** | Submit FG to warehouse, generate shipper labels |
| 9 | **Purchase** | Read-only: view stock & reports |

---

## Product Lifecycle

```
GRN (Goods Receipt Note)
       ↓
   QUARANTINE  ← QR label printed & attached
       ↓
  UNDER TEST   ← QC Executive picks up sample, assigns A.R. number
       ↓
 APPROVED / REJECTED  ← QC Head decision
       ↓ (if approved)
   ISSUED TO PRODUCTION
       ↓
  FINISHED GOODS RECEIVED
       ↓
  QA INSPECTION
       ↓
  QA APPROVED / REJECTED
       ↓
    DISPATCH
```

A `RETESTING` branch exists: approved/rejected materials can be sent back for retesting on a scheduled date (APScheduler sends alerts).

---

## API Overview

All endpoints live under `/api/v1/`. Auto-generated docs available at `/docs` (Swagger) and `/redoc`.

| Prefix | Module |
|--------|--------|
| `/api/v1/auth` | Login, logout, password reset, MFA |
| `/api/v1/users` | User CRUD (Super Admin) |
| `/api/v1/materials` | Material master data |
| `/api/v1/suppliers` | Supplier master |
| `/api/v1/inventory` | Batches, stock, movements |
| `/api/v1/qc` | QC workflow (AR number, testing, approve/reject) |
| `/api/v1/qa` | QA workflow (FG inspection, approve/reject) |
| `/api/v1/production` | Production issue & FG submission |
| `/api/v1/finished-goods` | FG batches |
| `/api/v1/notifications` | In-app notifications |
| `/api/v1/chat` | Chat rooms & WebSocket messages |
| `/api/v1/audit` | Audit trail |
| `/health` | Health check |

Static files (QR codes, labels): `/uploads/`

---

## Running Locally

### Prerequisites

- **Python 3.12.x** (project pins `3.12.7` in `.python-version`)
- **PostgreSQL** running locally (default port `5432`)
- **Node.js 18+** and npm
- **Expo Go** app on your phone, or an Android/iOS emulator

---

### Step 1 — Create PostgreSQL database

```sql
CREATE DATABASE qtrack;
```

---

### Step 2 — Backend setup

```powershell
cd e:\wms\backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Create `backend/.env`:

```env
# Database — must use asyncpg driver
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/qtrack

# JWT — generate a strong secret (e.g. openssl rand -hex 32)
JWT_SECRET=your_super_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# App
APP_NAME=QTrack
APP_ENV=development
DEBUG=true

# SMTP (leave empty for local dev to skip email sending)
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=
MAIL_PORT=587
MAIL_SERVER=
MAIL_STARTTLS=true
MAIL_SSL_TLS=false
```

Also update line 3 of `backend/alembic.ini` to match your credentials:

```ini
sqlalchemy.url = postgresql+asyncpg://postgres:your_password@localhost:5432/qtrack
```

---

### Step 3 — Run database migrations

```powershell
# Inside backend/ with venv active
alembic upgrade head
```

This creates all tables: users, roles, permissions, batches, inventory, audit logs, chat, notifications, etc.

---

### Step 4 — Start the backend server

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API base: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

---

### Step 5 — Create the first Super Admin user

No seed script is included. After the server is running, use Swagger at `http://localhost:8000/docs` to call the auth/users endpoints and create the first Super Admin account.

---

### Step 6 — Mobile app setup

```powershell
cd e:\wms\mobile
npm install
```

Create `mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:8000/api/v1
```

> Use your machine's **local network IP** (e.g. `192.168.1.10`), not `localhost` — the phone/emulator cannot reach `localhost` on your machine. Run `ipconfig` in PowerShell to find it.

---

### Step 7 — Start the mobile app

```powershell
npx expo start
```

- Press `a` → Android emulator
- Press `i` → iOS simulator (Mac only)
- Scan the QR code in terminal with **Expo Go** on your phone

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | `postgresql+asyncpg://user:pass@host:port/db` |
| `JWT_SECRET` | Yes | — | Long random string for signing JWT tokens |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | 24 hours |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | 7 days |
| `APP_ENV` | No | `development` | `development` or `production` |
| `DEBUG` | No | `true` | Enable debug mode |
| `MAIL_*` | No | — | SMTP credentials for email notifications |

### Mobile (`mobile/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Full backend URL including `/api/v1` |

---

## Authentication Flow

```
Super Admin creates user account
        ↓
System generates temporary password
        ↓
Email sent to user (SMTP)
        ↓
User logs in with temporary password
        ↓
System forces password reset (first login — cannot be skipped)
        ↓
JWT access token issued (24h) + refresh token (7d)
        ↓
Every API request includes: Authorization: Bearer <token>
```

Security features:
- **bcrypt** password hashing (never plain text)
- **5 failed login attempts** → account locked for 15 minutes
- **Password reset links** expire in 15 minutes (single-use tokens)
- **HTTPS** required in production
- **TOTP/MFA** via Google Authenticator (optional, field exists in User model)

---

## Deployment (Render)

See [backend/DEPLOY-RENDER.md](backend/DEPLOY-RENDER.md) for full instructions.

Quick summary:
1. Push repo to GitHub
2. Create a Render PostgreSQL database
3. Create a Render Web Service — Root Directory: `backend`, set `PYTHON_VERSION=3.12.7`
4. Add all env vars (use `postgresql+asyncpg://` URL prefix)
5. After first deploy, open the Render Shell and run `alembic upgrade head`
6. Set `EXPO_PUBLIC_API_BASE_URL=https://YOUR-SERVICE.onrender.com/api/v1` in mobile `.env`

---

## Common Issues

| Issue | Fix |
|-------|-----|
| Mobile can't connect to backend | Use your local IP, not `localhost`, in `EXPO_PUBLIC_API_BASE_URL` |
| `asyncpg` connection refused | PostgreSQL not running, or wrong credentials in `DATABASE_URL` |
| Alembic migration fails | `sqlalchemy.url` in `alembic.ini` must match your `DATABASE_URL` |
| Build error on Python 3.14 (Pillow/asyncpg) | Use exactly Python **3.12.7** |
| `401 Unauthorized` on all requests | `JWT_SECRET` in `.env` doesn't match the one used to issue tokens |
| Email not sending | SMTP fields empty — expected in local dev; configure for production |
