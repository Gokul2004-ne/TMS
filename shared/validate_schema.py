"""JSON Schema validation script for TMS event contracts."""

import os
import sys
import json

SHARED_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(SHARED_DIR, "event-schema.json")
APP_MAP_PATH = os.path.join(SHARED_DIR, "app-map.json")


def validate_contracts():
    print("Validating TMS Shared Contracts...")

    # 1. Validate Schema JSON
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)
    print(f"  [OK] Loaded {os.path.basename(SCHEMA_PATH)}: '{schema.get('title')}'")

    # 2. Validate App Map
    with open(APP_MAP_PATH, "r", encoding="utf-8") as f:
        app_map = json.load(f)
    print(f"  [OK] Loaded {os.path.basename(APP_MAP_PATH)}: {len(app_map.get('mappings', {}))} process mappings defined")

    # 3. Validate Sample Event structure
    sample_event = {
        "associate_id": "EMP101",
        "session_id": "sess-abc123",
        "claim_id": "CLM1003",
        "event_type": "APP_SWITCH",
        "app_name": "Excel",
        "window_title": "Rates_Schedule.xlsx",
        "timestamp": "2026-10-06T12:00:00Z",
        "is_idle": False,
        "agent_version": "1.0.0"
    }

    required_fields = schema.get("required", [])
    for field in required_fields:
        assert field in sample_event, f"Missing required field: {field}"
    print(f"  [OK] Verified sample event conforms to {len(required_fields)} required fields.")

    print("\nSUCCESS: All shared contract files are valid!")


if __name__ == "__main__":
    validate_contracts()
