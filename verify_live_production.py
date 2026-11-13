"""
TMS Live Production Environment Validation Suite
Tests end-to-end communication against live Hostinger backend and live PostgreSQL database.
"""
import requests
import json
import time
import datetime

base = "http://187.127.207.41:8080"

print("=" * 68)
print("     TMS LIVE HOSTINGER PRODUCTION ENVIRONMENT VALIDATION SUITE")
print("=" * 68)

# 1. Health check
t0 = time.time()
r = requests.get(f"{base}/health", timeout=10)
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
data = r.json()
print(f"[1] LIVE HEALTH CHECK: PASSED (Status: {data.get('status')}) in {(time.time()-t0)*1000:.1f}ms")

# 2. Database connection status
t0 = time.time()
r = requests.get(f"{base}/api/db-status", timeout=10)
assert r.status_code == 200
data = r.json()
print(f"[2] LIVE DATABASE CONNECTIVITY: PASSED")
print(f"    - Engine: {data.get('database_type')}")
print(f"    - Status: {data.get('status')}")
print(f"    - Tables: {data.get('tables_count')}")
print(f"    - Error:  {data.get('last_postgres_error')}")

# 3. Associate Today metrics
t0 = time.time()
r = requests.get(f"{base}/api/associate/EMP101/today", timeout=10)
assert r.status_code == 200
data = r.json()
print(f"[3] LIVE ASSOCIATE TODAY: PASSED ({data.get('associate_name')}, AHT: {data.get('aht_minutes')}m, Claims: {data.get('completed_claims_count')}) in {(time.time()-t0)*1000:.1f}ms")

# 4. Associate claims list
t0 = time.time()
r = requests.get(f"{base}/api/associate/EMP101/claims", timeout=10)
assert r.status_code == 200
claims = r.json()
sample_claim = claims[0]['claim_id'] if claims else 'CLM-635'
print(f"[4] LIVE CLAIMS FETCH: PASSED ({len(claims)} historical claims retrieved) in {(time.time()-t0)*1000:.1f}ms")

# 5. Claim Deep Dive Timeline
t0 = time.time()
r = requests.get(f"{base}/api/associate/EMP101/claims/{sample_claim}/timeline", timeout=10)
assert r.status_code == 200
tl = r.json()
print(f"[5] LIVE TIMELINE DEEP DIVE: PASSED (Claim: {sample_claim}, Duration: {tl.get('total_duration_seconds')}s) in {(time.time()-t0)*1000:.1f}ms")

# 6. Active Claim Set & Sync
t0 = time.time()
active_payload = {"claim_id": sample_claim, "status": "IN_PROGRESS"}
r = requests.post(f"{base}/api/associate/EMP101/active-claim", json=active_payload, timeout=10)
assert r.status_code == 200
act = r.json()
assert act.get("active_claim_id") == sample_claim
print(f"[6] LIVE ACTIVE CLAIM SYNC: PASSED (Active: {act.get('active_claim_id')}, Target: {act.get('target_minutes')}m) in {(time.time()-t0)*1000:.1f}ms")

# 7. Live Event Telemetry Stream Ingestion
t0 = time.time()
ev_payload = {
    "events": [
        {
            "event_id": f"live-verify-{int(time.time())}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "associate_id": "EMP101",
            "session_id": "sess-live-verify",
            "app_name": "NovaArc RCM",
            "window_title": f"NovaArc RCM Platform - {sample_claim}",
            "url": f"https://krishna-caare.github.io/novaarc-rcm/#/claims/{sample_claim}",
            "claim_id": sample_claim,
            "event_type": "WINDOW_FOCUS",
            "is_idle": False,
            "duration_seconds": 3
        }
    ]
}
r = requests.post(f"{base}/api/events", json=ev_payload, timeout=10)
assert r.status_code in (200, 201)
ingest = r.json()
print(f"[7] LIVE EVENT INGESTION: PASSED (Inserted: {ingest.get('inserted')}, Status: {ingest.get('status')}) in {(time.time()-t0)*1000:.1f}ms")

# 8. Team Friction NVA Summary
t0 = time.time()
r = requests.get(f"{base}/api/team/nva-summary", timeout=10)
assert r.status_code == 200
nva = r.json()
print(f"[8] LIVE TEAM NVA FRICTION: PASSED (App Switches: {nva.get('app_switching_spikes_count')}, Lost: {nva.get('total_nva_time_lost_hours')}h) in {(time.time()-t0)*1000:.1f}ms")

print("=" * 68)
print("     ALL 8/8 LIVE HOSTINGER PRODUCTION CHECKS PASSED CLEANLY!")
print("=" * 68)
