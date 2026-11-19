import os
import json
import time
import importlib
from typing import List, Dict, Any, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

# Dynamic import to eliminate IDE unresolved import warnings across all editors and environments
genai: Any = None
types: Any = None
GENAI_AVAILABLE: bool = False

try:
    genai = importlib.import_module("google.genai")
    types = importlib.import_module("google.genai.types")
    GENAI_AVAILABLE = True
except Exception:
    genai = None
    types = None
    GENAI_AVAILABLE = False


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
    """Generates intelligent operational insights using Google Gemini 3.7 Flash with fallback caching."""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")
        self.cache_ttl = int(os.getenv("CACHE_TTL_SECONDS", 300))
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_timestamp: float = 0

    def is_gemini_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "YOUR_GEMINI_API_KEY_HERE")

    def configure_api_key(self, api_key: str):
        """Allows dynamic configuration or rotation of the Gemini API key at runtime."""
        self.api_key = api_key.strip()
        self.clear_cache()

    def clear_cache(self):
        """Clears the cached insights."""
        self._cache = None
        self._cache_timestamp = 0

    def _get_fallback_insights(self) -> List[Dict[str, Any]]:
        mock_path = os.path.join(os.path.dirname(__file__), "mock_insights.json")
        try:
            with open(mock_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("insights", [])
        except Exception:
            return []

    @staticmethod
    def _parse_json_insights(text: str) -> Optional[List[Dict[str, Any]]]:
        """Safely parses JSON array from markdown code blocks or raw strings."""
        t = (text or "").strip()
        if t.startswith("```json"):
            t = t[7:]
        if t.startswith("```"):
            t = t[3:]
        if t.endswith("```"):
            t = t[:-3]
        t = t.strip()
        try:
            parsed = json.loads(t)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return None

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

        # Zero-PHI Sanitization: Anonymize sample claims before sending to LLM
        safe_claims = []
        for c in claims[:10]:
            safe_claims.append({
                "duration_seconds": c.get("total_duration_seconds", 0),
                "active_duration_seconds": c.get("active_duration_seconds", 0),
                "idle_duration_seconds": c.get("idle_duration_seconds", 0),
                "app_switches": c.get("app_switches_count", 0),
                "nva_flags": c.get("nva_flags", []),
                "app_breakdown": c.get("app_breakdown", {})
            })

        prompt = PROMPT_TEMPLATE.format(
            summary=json.dumps(summary),
            sample_claims=json.dumps(safe_claims)
        )

        # Attempt Gemini Call using Gemini 3.7 Flash with fallback
        for target_model in [self.model_name, "gemini-2.5-flash"]:
            # 1. Official Google GenAI SDK
            if GENAI_AVAILABLE and genai is not None and types is not None:
                try:
                    client = genai.Client(api_key=self.api_key)
                    response = client.models.generate_content(
                        model=target_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.2
                        )
                    )
                    raw_text = (getattr(response, "text", "") or "").strip()
                    parsed = self._parse_json_insights(raw_text)
                    if parsed:
                        self._cache = {"insights": parsed}
                        self._cache_timestamp = now
                        return parsed
                except Exception as e:
                    print(f"[GeminiInsightGenerator] Notice: {target_model} SDK attempt: {e}")

            # 2. Resilient Direct REST API Fallback
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json"
                    }
                }
                res = requests.post(url, headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "").strip()
                            parsed = self._parse_json_insights(raw_text)
                            if parsed:
                                self._cache = {"insights": parsed}
                                self._cache_timestamp = now
                                return parsed
            except Exception as e:
                print(f"[GeminiInsightGenerator] Notice: {target_model} REST attempt: {e}")

        # Fallback if both model calls fail
        insights = self._get_fallback_insights()
        self._cache = {"insights": insights}
        self._cache_timestamp = now
        return insights
