"""Unit and integration test suite for TMS AI Intelligence Engine.

Tests deterministic boundary conditions for all 5 NVA rules,
team aggregation bottlenecks, lost hours calculation, and FastAPI endpoints.
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add ai directory to sys.path
ai_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ai_dir not in sys.path:
    sys.path.insert(0, ai_dir)

import importlib.util
from nva_engine import NVAEngine
from team_aggregator import TeamAggregator

ai_main_path = os.path.join(ai_dir, "main.py")
ai_spec = importlib.util.spec_from_file_location("ai_service_main", ai_main_path)
ai_mod = importlib.util.module_from_spec(ai_spec)
ai_spec.loader.exec_module(ai_mod)
ai_app = ai_mod.app


@pytest.fixture
def engine():
    return NVAEngine()


@pytest.fixture
def aggregator():
    return TeamAggregator()


@pytest.fixture
def client():
    return TestClient(ai_app)


# ==========================================
# Rule 1: EXCEL_OVERUSE Boundary Tests
# ==========================================
def test_excel_overuse_below_ratio(engine):
    claim = {
        "claim_id": "CLM001",
        "total_duration_seconds": 300,
        "app_breakdown": {"Excel": 119, "ClaimPlatform": 181}  # 39.6%
    }
    flags = engine.evaluate_claim(claim)
    assert "EXCEL_OVERUSE" not in flags


def test_excel_overuse_below_min_duration(engine):
    claim = {
        "claim_id": "CLM002",
        "total_duration_seconds": 170,  # < 180s
        "app_breakdown": {"Excel": 150}  # 88%
    }
    flags = engine.evaluate_claim(claim)
    assert "EXCEL_OVERUSE" not in flags


def test_excel_overuse_exact_boundary(engine):
    claim = {
        "claim_id": "CLM003",
        "total_duration_seconds": 200,
        "app_breakdown": {"Excel": 80, "ClaimPlatform": 120}  # Exactly 40%
    }
    flags = engine.evaluate_claim(claim)
    assert "EXCEL_OVERUSE" in flags


# ==========================================
# Rule 2: APP_SWITCHING Boundary Tests
# ==========================================
def test_app_switching_below_threshold(engine):
    claim = {
        "claim_id": "CLM004",
        "app_switches_count": 7
    }
    flags = engine.evaluate_claim(claim)
    assert "APP_SWITCHING" not in flags


def test_app_switching_exact_and_above_threshold(engine):
    claim_boundary = {
        "claim_id": "CLM005",
        "app_switches_count": 8
    }
    assert "APP_SWITCHING" in engine.evaluate_claim(claim_boundary)

    claim_above = {
        "claim_id": "CLM006",
        "app_switches_count": 14
    }
    assert "APP_SWITCHING" in engine.evaluate_claim(claim_above)


# ==========================================
# Rule 3: LONG_IDLE Boundary Tests
# ==========================================
def test_long_idle_below_threshold(engine):
    claim = {
        "claim_id": "CLM007",
        "idle_duration_seconds": 179
    }
    flags = engine.evaluate_claim(claim)
    assert "LONG_IDLE" not in flags


def test_long_idle_exact_and_above_threshold(engine):
    claim_boundary = {
        "claim_id": "CLM008",
        "idle_duration_seconds": 180
    }
    assert "LONG_IDLE" in engine.evaluate_claim(claim_boundary)

    claim_above = {
        "claim_id": "CLM009",
        "idle_duration_seconds": 320
    }
    assert "LONG_IDLE" in engine.evaluate_claim(claim_above)


# ==========================================
# Rule 4: OUTLIER Boundary Tests
# ==========================================
def test_outlier_below_threshold(engine):
    claim = {
        "claim_id": "CLM010",
        "total_duration_seconds": 1199
    }
    flags = engine.evaluate_claim(claim)
    assert "OUTLIER" not in flags


def test_outlier_exact_and_above_threshold(engine):
    claim_boundary = {
        "claim_id": "CLM011",
        "total_duration_seconds": 1200
    }
    assert "OUTLIER" in engine.evaluate_claim(claim_boundary)

    claim_above = {
        "claim_id": "CLM012",
        "total_duration_seconds": 1850
    }
    assert "OUTLIER" in engine.evaluate_claim(claim_above)


# ==========================================
# Rule 5: REWORK Boundary Tests
# ==========================================
def test_rework_single_touch(engine):
    claim = {
        "claim_id": "CLM013",
        "touch_count": 1
    }
    flags = engine.evaluate_claim(claim)
    assert "REWORK" not in flags


def test_rework_multiple_touches(engine):
    claim_two = {
        "claim_id": "CLM014",
        "touch_count": 2
    }
    assert "REWORK" in engine.evaluate_claim(claim_two)

    claim_three = {
        "claim_id": "CLM015",
        "touch_count": 3
    }
    assert "REWORK" in engine.evaluate_claim(claim_three)


# ==========================================
# Combined & Clean Adjudication
# ==========================================
def test_clean_claim_no_flags(engine):
    claim = {
        "claim_id": "CLM016",
        "total_duration_seconds": 240,
        "idle_duration_seconds": 30,
        "app_switches_count": 3,
        "touch_count": 1,
        "app_breakdown": {"ClaimPlatform": 180, "Outlook": 30}
    }
    flags = engine.evaluate_claim(claim)
    assert flags == []


def test_all_five_flags_triggered(engine):
    claim = {
        "claim_id": "CLM017",
        "total_duration_seconds": 1400,        # OUTLIER (>=1200)
        "idle_duration_seconds": 200,         # LONG_IDLE (>=180)
        "app_switches_count": 10,             # APP_SWITCHING (>=8)
        "touch_count": 2,                     # REWORK (>=2)
        "app_breakdown": {"Excel": 700}       # EXCEL_OVERUSE (50% >= 40%)
    }
    flags = engine.evaluate_claim(claim)
    assert set(flags) == {"EXCEL_OVERUSE", "APP_SWITCHING", "LONG_IDLE", "OUTLIER", "REWORK"}


# ==========================================
# Team Aggregator Tests
# ==========================================
def test_team_aggregator_metrics(aggregator, engine):
    claims = [
        {
            "claim_id": "CLM101",
            "associate_id": "EMP101",
            "total_duration_seconds": 600,
            "idle_duration_seconds": 240,
            "app_switches_count": 10,
            "touch_count": 1,
            "app_breakdown": {"Excel": 360, "ClaimPlatform": 240}
        },
        {
            "claim_id": "CLM102",
            "associate_id": "EMP102",
            "total_duration_seconds": 1500,
            "idle_duration_seconds": 50,
            "app_switches_count": 4,
            "touch_count": 2,
            "app_breakdown": {"ClaimPlatform": 1450}
        }
    ]
    analyzed = engine.batch_analyze(claims)
    summary = aggregator.aggregate(analyzed)

    assert summary["total_claims_analyzed"] == 2
    assert summary["total_nva_flags_count"] > 0
    assert summary["total_nva_time_lost_hours"] > 0
    assert "breakdown" in summary
    assert "top_bottleneck" in summary


# ==========================================
# FastAPI AI Service Endpoint Tests
# ==========================================
def test_ai_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
    assert "TMS AI Engine" in resp.json()["service"]


def test_ai_configure_key_endpoint(client):
    resp = client.post("/ai/configure-key", json={"gemini_api_key": "AIzaSy_TEST_MOCK_KEY_12345"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert resp.json()["gemini_configured"] is True


def test_ai_analyze_claims_endpoint(client):
    payload = [
        {
            "claim_id": "CLM_API_TEST",
            "total_duration_seconds": 400,
            "idle_duration_seconds": 200,
            "app_switches_count": 2,
            "touch_count": 1,
            "app_breakdown": {"ClaimPlatform": 200}
        }
    ]
    resp = client.post("/ai/analyze-claims", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "LONG_IDLE" in data[0]["nva_flags"]


def test_ai_team_nva_summary_endpoint(client):
    resp = client.get("/ai/team-nva-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_claims_analyzed" in data
    assert "breakdown" in data


def test_ai_insights_endpoint(client):
    resp = client.get("/ai/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert "insights" in data
    assert isinstance(data["insights"], list)
    assert len(data["insights"]) > 0
    assert "title" in data["insights"][0]
