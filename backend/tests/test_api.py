"""Integration and functional test suite for TMS Backend API.

Tests health check, session lifecycle, bulk event ingestion,
associate today/claims endpoints, team overview, and NVA aggregation.
"""

import os
import sys
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

# Ensure backend root is on path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from database import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Initializes database tables before running tests."""
    import asyncio
    asyncio.run(init_db())


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    """Test health check probe."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "TMS Backend API" in data["service"]


def test_session_lifecycle(client):
    """Test session start and session end."""
    start_payload = {
        "associate_id": "EMP101",
        "session_id": "test-session-001"
    }
    start_resp = client.post("/api/sessions/start", json=start_payload)
    assert start_resp.status_code == 201
    start_data = start_resp.json()
    assert start_data["associate_id"] == "EMP101"
    assert start_data["is_active"] is True

    # End session
    end_payload = {
        "session_id": "test-session-001"
    }
    end_resp = client.post("/api/sessions/end", json=end_payload)
    assert end_resp.status_code == 200
    end_data = end_resp.json()
    assert end_data["is_active"] is False


def test_bulk_event_ingestion(client):
    """Test ingesting multiple events and verifying timeline update."""
    now_iso = datetime.utcnow().isoformat() + "Z"
    payload = {
        "events": [
            {
                "session_id": "test-session-ingest",
                "associate_id": "EMP101",
                "claim_id": "CLM9999",
                "event_type": "CLAIM_DETECTED",
                "app_name": "ClaimPlatform",
                "window_title": "Adjudication - CLM9999",
                "timestamp": now_iso,
                "is_idle": False,
                "agent_version": "1.0.0"
            },
            {
                "session_id": "test-session-ingest",
                "associate_id": "EMP101",
                "claim_id": "CLM9999",
                "event_type": "APP_SWITCH",
                "app_name": "Excel",
                "window_title": "Rates.xlsx - CLM9999",
                "timestamp": now_iso,
                "is_idle": False,
                "agent_version": "1.0.0"
            }
        ]
    }
    resp = client.post("/api/events", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["received"] == 2
    assert data["inserted"] == 2
    assert data["status"] == "success"


def test_associate_today(client):
    """Test retrieving current day KPIs for an associate."""
    resp = client.get("/api/associate/EMP101/today")
    assert resp.status_code == 200
    data = resp.json()
    assert data["associate_id"] == "EMP101"
    assert "efficiency_score" in data
    assert "aht_minutes" in data
    assert "app_distribution" in data
    assert "recent_claims" in data


def test_associate_claims_list(client):
    """Test retrieving claims history for an associate."""
    resp = client.get("/api/associate/EMP101/claims")
    assert resp.status_code == 200
    claims = resp.json()
    assert isinstance(claims, list)


def test_team_overview(client):
    """Test supervisor team overview aggregation."""
    resp = client.get("/api/team/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_associates" in data
    assert "team_aht_minutes" in data
    assert "associates" in data
    assert len(data["associates"]) > 0


def test_team_nva_summary(client):
    """Test team NVA bottleneck summary calculation."""
    resp = client.get("/api/team/nva-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "excel_overuse_claims_count" in data
    assert "app_switching_spikes_count" in data
    assert "total_nva_time_lost_hours" in data
    assert "breakdown_by_category" in data
    assert "EXCEL_OVERUSE" in data["breakdown_by_category"]
