# QTrack — Warehouse & Quality Management System

A mobile-first enterprise application for pharmaceutical/chemical warehouse operations.
Tracks raw materials from receipt through QC testing, production, finished goods, and dispatch.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo + TypeScript |
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Email | Amazon SES / SendGrid |
| Storage | AWS S3 (production) |
| Deployment | AWS App Runner + RDS |

---

## Core Workflow

```
Material Received → GRN Created → QR Label Generated → QUARANTINE
→ QC Sampling → UNDER TEST → QC Head Approves → APPROVED
→ Issue to Production → Finished Goods → QA Inspection → Warehouse → DISPATCH
```

---

## Roles (9 total)

`Super Admin` · `Warehouse User` · `Warehouse Head` · `QC Executive` · `QC Head` · `QA Executive` · `QA Head` · `Production User` · `Purchase Department`

---

## Key Features

- QR scan-first workflow — every action starts with a scan
- Role-Based Access Control (RBAC) with permission mapping
- Retesting cycle management with 15-day automated alerts
- Grade-to-grade transfer (IP → BP / USP) with QC authorization
- Immutable audit trail for every system action
- Internal chat (global, department groups, private messaging)
- In-app + email notifications
- FIFO and expiry-based inventory sorting
- Movement-based inventory tracking (never overwrite, always record)

---

## Architecture

```
Mobile App (React Native + Expo)
        ↓ HTTPS
FastAPI Backend  ←→  APScheduler (background tasks)
        ↓ SQL
PostgreSQL Database
        ↓
AWS S3 (file storage)
```

Backend follows Domain-Driven Modular design:
`auth` · `users` · `inventory` · `materials` · `qc` · `qa` · `production` · `finished_goods` · `notifications` · `chat` · `audit`

---

*README will be expanded to full documentation once all features are implemented.*
