import requests

url = "http://localhost:8000/api/v1/auth/login"

print("--- Test 1: login with username ---")
r = requests.post(url, json={"login_id": "Andromeda007", "password": "andromeda@123"})
print(f"Status: {r.status_code}")
print(f"Body: {r.text}\n")

print("--- Test 2: login with email ---")
r = requests.post(url, json={"login_id": "andromeda@gmail.com", "password": "andromeda@123"})
print(f"Status: {r.status_code}")
print(f"Body: {r.text}\n")

print("--- Test 3: wrong password ---")
r = requests.post(url, json={"login_id": "Andromeda007", "password": "wrong"})
print(f"Status: {r.status_code}")
print(f"Body: {r.text}")
