import os
import json
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from nva_engine import NVAEngine
from team_aggregator import TeamAggregator
from gemini_insights import GeminiInsightGenerator

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


def load_sample_timelines() -> List[Dict[str, Any]]:
    path = os.path.join(os.path.dirname(__file__), "sample_timelines.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "service": "TMS AI Engine",
        "gemini_configured": gemini_generator.is_gemini_configured()
    }


@app.post("/ai/analyze-claims", tags=["Analysis"])
def analyze_claims(claims: List[Dict[str, Any]]):
    """Takes a list of claim timeline objects and appends NVA flags."""
    return nva_engine.batch_analyze(claims)


@app.get("/ai/team-nva-summary", tags=["Analysis"])
def get_team_nva_summary():
    """Aggregates sample or live claims into a team NVA summary."""
    samples = load_sample_timelines()
    analyzed = nva_engine.batch_analyze(samples)
    return team_aggregator.aggregate(analyzed)


@app.get("/ai/insights", tags=["Insights"])
async def get_insights():
    """Returns AI-generated actionable operational insights."""
    samples = load_sample_timelines()
    analyzed = nva_engine.batch_analyze(samples)
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
