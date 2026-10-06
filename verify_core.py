import sys
import os
import json
import re

# Add paths
sys.path.insert(0, os.path.abspath("backend"))
sys.path.insert(0, os.path.abspath("agent"))
sys.path.insert(0, os.path.abspath("ai"))

print("=" * 60)
print("TMS CORE FOUNDATION - VERIFICATION SUITE")
print("=" * 60)

# 1. Test Shared Contracts
print("\n[1/5] Verifying Shared Contracts...")
assert os.path.exists("shared/event-schema.json"), "Missing shared/event-schema.json"
assert os.path.exists("shared/app-map.json"), "Missing shared/app-map.json"
with open("shared/event-schema.json") as f:
    schema = json.load(f)
    assert schema["title"] == "TMSEvent"
print("  [OK] shared/event-schema.json valid")

with open("shared/app-map.json") as f:
    app_map = json.load(f)
    assert "excel.exe" in app_map["mappings"]
print("  [OK] shared/app-map.json valid")

# 2. Test Agent Tracker and Claim Context Manager
print("\n[2/5] Verifying Agent Core Subsystems...")
from tracker import WindowTracker
from claim_context import ClaimContextManager

tracker = WindowTracker()
test_title = "ClaimPlatform - Review Claim CLM1003 - Patient Johnson"
match = tracker.claim_regex.search(test_title)
assert match and match.group(0) == "CLM1003", f"Regex failed on {test_title}"
print(f"  [OK] Regex correctly extracted '{match.group(0)}' from window title")

mgr = ClaimContextManager()
assert mgr.get_current_claim_id() == "UNASSIGNED"
new_id, changed = mgr.update_detected_claim("CLM1003")
assert new_id == "CLM1003" and changed is True
print("  [OK] Claim context activated: CLM1003")

# Context switch to Excel (helper app without claim in title)
new_id, changed = mgr.update_detected_claim(None)
assert mgr.get_current_claim_id() == "CLM1003" and changed is False
print("  [OK] Active claim context properly retained during app switch to Excel")

# Context switch to a new claim
new_id, changed = mgr.update_detected_claim("CLM1004")
assert new_id == "CLM1004" and changed is True
print("  [OK] Transition to CLM1004 detected")

# 3. Test Backend Schemas & Timeline Evaluator
print("\n[3/5] Verifying Backend Schemas & Timeline Evaluation...")
from schemas import EventIn, BulkEventsIn
from services.timeline_builder import evaluate_nva_flags

ev = EventIn(
    associate_id="EMP101",
    session_id="sess-001",
    claim_id="CLM1003",
    event_type="APP_SWITCH",
    app_name="Excel"
)
assert ev.claim_id == "CLM1003"
print("  [OK] EventIn Pydantic schema validation successful")

# Test NVA rule evaluation:
# Total 900s, Excel 450s (>50% -> EXCEL_OVERUSE), 10 switches (-> APP_SWITCHING), idle 200s (-> LONG_IDLE)
flags = evaluate_nva_flags(
    total_sec=900,
    idle_sec=200,
    switches=10,
    app_breakdown={"Excel": 450, "ClaimPlatform": 450}
)
assert "EXCEL_OVERUSE" in flags
assert "APP_SWITCHING" in flags
assert "LONG_IDLE" in flags
print(f"  [OK] NVA rules properly flagged: {flags}")

# 4. Test AI Engine
print("\n[4/5] Verifying AI NVA Rules Engine & Aggregator...")
from nva_engine import NVAEngine
from team_aggregator import TeamAggregator

engine = NVAEngine()
test_claim = {
    "claim_id": "CLM9999",
    "total_duration_seconds": 1500, # > 1200 -> OUTLIER
    "active_duration_seconds": 1200,
    "idle_duration_seconds": 300,   # > 180 -> LONG_IDLE
    "app_switches_count": 12,       # >= 8 -> APP_SWITCHING
    "app_breakdown": {"Excel": 700, "Chrome": 500}, # 700/1500=46% -> EXCEL_OVERUSE
    "touches_count": 3              # >= 2 -> REWORK
}
ai_flags = engine.analyze_claim(test_claim)
assert set(ai_flags) == {"EXCEL_OVERUSE", "APP_SWITCHING", "LONG_IDLE", "OUTLIER", "REWORK"}
print(f"  [OK] AI Engine triggered all 5 NVA rules: {ai_flags}")

aggregator = TeamAggregator()
team_summary = aggregator.aggregate([dict(test_claim, nva_flags=ai_flags)])
assert team_summary["total_analyzed_claims"] == 1
assert team_summary["excel_overuse_claims_count"] == 1
print(f"  [OK] Team Aggregator produced summary with {team_summary['total_nva_time_lost_hours']}h lost time")

# 5. Check Dashboard Files
print("\n[5/5] Verifying Dashboard Setup...")
assert os.path.exists("dashboard/package.json"), "Missing package.json"
assert os.path.exists("dashboard/src/App.tsx"), "Missing App.tsx"
assert os.path.exists("dashboard/src/api/mock.ts"), "Missing mock.ts"
assert os.path.exists("dashboard/src/index.css"), "Missing index.css"
print("  [OK] Dashboard components, pages, and mock data in place")

print("\n" + "=" * 60)
print("SUCCESS: ALL TMS CORE MODULES VERIFIED AND OPERATIONAL!")
print("=" * 60)
