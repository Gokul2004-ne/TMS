import os
import json
import time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

PROMPT_TEMPLATE = """
You are an expert Operations Intelligence and AI Process Consultant for Healthcare Revenue Cycle Management (RCM) and Accounts Receivable (AR).

Analyze the following aggregate metrics and claim timelines from an operational shift:
Summary: {summary}
Sample Claims with NVA Flags: {sample_claims}

Identify the top 3 high-impact process bottlenecks, behavioral inefficiencies, or system friction points.
For each finding, provide actionable, root-cause recommendations suitable for an operations supervisor.

Return ONLY a JSON array with the following schema:
[
  {{
    "id": "ins-001",
    "title": "Short punchy title (max 8 words)",
    "category": "BOTTLENECK | BEHAVIOR | REWORK | COACHING",
    "severity": "HIGH | MEDIUM | LOW",
    "impact_claim_count": <integer>,
    "estimated_time_loss_mins": <integer>,
    "description": "2-3 sentences explaining the exact root cause and pattern",
    "recommendation": "Concrete tactical solution or process improvement",
    "evidence": ["Bullet 1 with exact metrics", "Bullet 2 with claim or app references"]
  }}
]
"""


class GeminiInsightGenerator:
    """Generates intelligent operational insights using Gemini 2.5 Flash with fallback caching."""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.cache_ttl = int(os.getenv("CACHE_TTL_SECONDS", 300))
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_timestamp: float = 0

    def is_gemini_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "YOUR_GEMINI_API_KEY_HERE")

    def _get_fallback_insights(self) -> List[Dict[str, Any]]:
        mock_path = os.path.join(os.path.dirname(__file__), "mock_insights.json")
        try:
            with open(mock_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("insights", [])
        except Exception:
            return []

    async def generate_insights(
        self, summary: Dict[str, Any], claims: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        # Check cache validity
        now = time.time()
        if self._cache and (now - self._cache_timestamp) < self.cache_ttl:
            return self._cache.get("insights", [])

        # If key is missing, return curated fallback
        if not self.is_gemini_configured():
            insights = self._get_fallback_insights()
            self._cache = {"insights": insights}
            self._cache_timestamp = now
            return insights

        # Attempt Gemini Call
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)

            prompt = PROMPT_TEMPLATE.format(
                summary=json.dumps(summary),
                sample_claims=json.dumps(claims[:10])
            )

            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            text = response.text.strip()
            # Clean possible markdown fence blocks
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            insights_data = json.loads(text)
            if isinstance(insights_data, list):
                self._cache = {"insights": insights_data}
                self._cache_timestamp = now
                return insights_data
        except Exception as e:
            print(f"[GeminiInsightGenerator] Warning: Gemini call failed ({e}). Using fallback.")

        # Fallback if call or parse fails
        insights = self._get_fallback_insights()
        self._cache = {"insights": insights}
        self._cache_timestamp = now
        return insights
