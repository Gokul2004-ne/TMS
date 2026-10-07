import os
import json
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from nva_engine import NVAEngine
from team_aggregator import TeamAggregator
from gemini_insights import GeminiInsightGenerator

from pydantic import BaseModel
import requests

app = FastAPI(
    title="TMS AI Intelligence Engine",
    description="Microservice providing NVA classification, team bottleneck aggregation, and Gemini insights",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

nva_engine = NVAEngine()
team_aggregator = TeamAggregator()
gemini_generator = GeminiInsightGenerator()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000")


class ConfigureKeyRequest(BaseModel):
    gemini_api_key: str


def load_sample_timelines() -> List[Dict[str, Any]]:
    path = os.path.join(os.path.dirname(__file__), "sample_timelines.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def fetch_live_backend_claims() -> List[Dict[str, Any]]:
    """Attempts to fetch real-time claims from the running backend API."""
    try:
        resp = requests.get(f"{BACKEND_API_URL}/api/associate/EMP101/claims", timeout=2.0)
        if resp.status_code == 200:
            claims = resp.json()
            if isinstance(claims, list) and len(claims) > 0:
                # Convert backend claim schema to NVA engine format
                formatted = []
                for c in claims:
                    formatted.append({
                        "claim_id": c.get("claim_id"),
                        "associate_id": c.get("associate_id"),
                        "total_duration_seconds": c.get("total_duration_seconds", 0),
                        "active_duration_seconds": c.get("active_duration_seconds", 0),
                        "idle_duration_seconds": c.get("idle_duration_seconds", 0),
                        "app_switches_count": c.get("app_switches_count", 0),
                        "app_breakdown": c.get("app_breakdown", {}),
                        "touch_count": c.get("touch_count", 1)
                    })
                return formatted
    except Exception:
        pass
    return []


@app.get("/", tags=["Root"])
def root():
    return {
        "status": "healthy",
        "service": "TMS AI Intelligence Engine",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health"
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "service": "TMS AI Engine",
        "gemini_configured": gemini_generator.is_gemini_configured()
    }


@app.post("/ai/configure-key", tags=["Configuration"])
def configure_key(payload: ConfigureKeyRequest):
    """Dynamically sets or rotates the Gemini API key at runtime."""
    if not payload.gemini_api_key or len(payload.gemini_api_key.strip()) < 10:
        raise HTTPException(status_code=400, detail="Invalid Gemini API key provided")
    gemini_generator.configure_api_key(payload.gemini_api_key)
    return {
        "status": "success",
        "message": "Gemini API key configured successfully",
        "gemini_configured": gemini_generator.is_gemini_configured()
    }


@app.post("/ai/analyze-claims", tags=["Analysis"])
def analyze_claims(claims: List[Dict[str, Any]]):
    """Takes a list of claim timeline objects and appends NVA flags."""
    return nva_engine.batch_analyze(claims)


@app.get("/ai/team-nva-summary", tags=["Analysis"])
def get_team_nva_summary(use_live: bool = False):
    """Aggregates sample or live claims into a team NVA summary."""
    claims = []
    if use_live:
        claims = fetch_live_backend_claims()
    if not claims:
        claims = load_sample_timelines()

    analyzed = nva_engine.batch_analyze(claims)
    return team_aggregator.aggregate(analyzed)


@app.get("/ai/insights", tags=["Insights"])
async def get_insights(use_live: bool = False):
    """Returns AI-generated actionable operational insights."""
    claims = []
    if use_live:
        claims = fetch_live_backend_claims()
    if not claims:
        claims = load_sample_timelines()

    analyzed = nva_engine.batch_analyze(claims)
    summary = team_aggregator.aggregate(analyzed)

    insights = await gemini_generator.generate_insights(summary, analyzed)
    return {
        "insights": insights,
        "is_ai_live": gemini_generator.is_gemini_configured()
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
