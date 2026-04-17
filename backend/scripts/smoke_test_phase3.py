#!/usr/bin/env python3
"""
Phase 3 smoke test — notifications, chat read-receipts, container-label PDF.
Run AFTER Render deploys Phase 3 code.

Usage:
    python3 backend/scripts/smoke_test_phase3.py
"""

import requests
import sys

BASE = "https://qtrack-new-backend.onrender.com/api/v1"

WAREHOUSE_USER = ("ankit007", "Ankit@007")
QC_EXEC_USER   = ("qcexec001", "QcExec@123")   # adjust if different
QC_HEAD_USER   = ("qchead001", "QcHead@123")
ADMIN_USER     = ("Andromeda007", "andromeda@123")

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
SKIP = "\033[93m~\033[0m"

errors = []

def login(username, password):
    r = requests.post(f"{BASE}/auth/login", json={"username": username, "password": password}, timeout=15)
    if r.status_code != 200:
        return None, f"Login failed for {username}: {r.status_code} {r.text[:200]}"
    token = r.json().get("access_token")
    return token, None

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def check(label, ok, detail=""):
    sym = PASS if ok else FAIL
    print(f"  {sym} {label}" + (f"  ({detail})" if detail else ""))
    if not ok:
        errors.append(label)

# ──────────────────────────────────────────────
print("\n=== 1. Auth smoke ===")
wh_token, err = login(*WAREHOUSE_USER)
check("Warehouse user login", wh_token is not None, err or "")

admin_token, err = login(*ADMIN_USER)
check("Admin user login", admin_token is not None, err or "")

if not wh_token:
    print("Cannot continue without warehouse token.")
    sys.exit(1)

# ──────────────────────────────────────────────
print("\n=== 2. Multi-status batch query ===")
r = requests.get(f"{BASE}/inventory/batches", params={"statuses": "QUARANTINE,UNDER_TEST"},
                 headers=auth(wh_token), timeout=15)
check("GET /batches?statuses=QUARANTINE,UNDER_TEST", r.status_code == 200,
      f"{r.status_code}")
if r.status_code == 200:
    batches = r.json()
    check("Returns list", isinstance(batches, list), f"{len(batches)} items")

# ──────────────────────────────────────────────
print("\n=== 3. Chat unread endpoints ===")
r = requests.get(f"{BASE}/chat/unread-total", headers=auth(wh_token), timeout=15)
check("GET /chat/unread-total", r.status_code == 200, f"{r.status_code} {r.text[:100]}")
if r.status_code == 200:
    total = r.json().get("total", -1)
    check("Returns {total:N}", isinstance(total, int), f"total={total}")

r = requests.get(f"{BASE}/chat/rooms", headers=auth(wh_token), timeout=15)
check("GET /chat/rooms", r.status_code == 200, f"{r.status_code}")
if r.status_code == 200:
    rooms = r.json()
    check("Rooms is list", isinstance(rooms, list), f"{len(rooms)} rooms")
    if rooms:
        room_id = rooms[0]["id"]
        r2 = requests.post(f"{BASE}/chat/rooms/{room_id}/read", headers=auth(wh_token), timeout=15)
        check(f"POST /chat/rooms/{room_id}/read", r2.status_code == 200, f"{r2.status_code} {r2.text[:100]}")

# ──────────────────────────────────────────────
print("\n=== 4. Notifications endpoint ===")
r = requests.get(f"{BASE}/notifications/", headers=auth(wh_token), timeout=15)
check("GET /notifications/", r.status_code == 200, f"{r.status_code}")
if r.status_code == 200:
    notifs = r.json()
    check("Returns list", isinstance(notifs, list), f"{len(notifs)} notifications")

# ──────────────────────────────────────────────
print("\n=== 5. Container labels PDF ===")
# First find a batch with containers
r = requests.get(f"{BASE}/inventory/batches", headers=auth(wh_token), timeout=15)
batch_id = None
if r.status_code == 200:
    for b in r.json():
        if b.get("container_count", 0) > 0:
            batch_id = b["id"]
            break

if batch_id:
    r = requests.get(f"{BASE}/inventory/batches/{batch_id}/container-labels",
                     headers=auth(wh_token), timeout=30)
    check(f"GET /batches/{batch_id}/container-labels", r.status_code == 200,
          f"{r.status_code} content-type={r.headers.get('content-type','?')}")
    if r.status_code == 200:
        is_pdf = r.headers.get("content-type", "").startswith("application/pdf")
        check("Response is PDF", is_pdf, r.headers.get("content-type", ""))
        check("PDF non-empty", len(r.content) > 1000, f"{len(r.content)} bytes")
else:
    print(f"  {SKIP} No batch with containers found — skipping PDF test")

# ──────────────────────────────────────────────
print("\n=== 6. Materials / items endpoint ===")
r = requests.get(f"{BASE}/materials/", headers=auth(wh_token), timeout=15)
check("GET /materials/", r.status_code == 200, f"{r.status_code}")

# ──────────────────────────────────────────────
print("\n=== Summary ===")
if errors:
    print(f"\n{FAIL} {len(errors)} check(s) FAILED:")
    for e in errors:
        print(f"   - {e}")
    sys.exit(1)
else:
    print(f"\n{PASS} All checks passed!")
