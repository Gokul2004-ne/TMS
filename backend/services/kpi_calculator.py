import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models import Associate, ClaimTimeline


def calculate_efficiency_score(claims_count: int, aht_minutes: float, idle_percent: float, nva_flags_count: int) -> float:
    """Calculates composite efficiency score (10-100%)."""
    penalty = min(25.0, nva_flags_count * 2.5)
    return max(10.0, min(100.0, round(100.0 - (idle_percent * 0.7) - penalty, 1)))


class KPICalculator:
    """Helper class for composite KPI and efficiency evaluations."""

    @staticmethod
    def calculate_efficiency_score(claims_count: int, aht_minutes: float, idle_ratio: float, nva_flags_count: int) -> float:
        idle_percent = idle_ratio * 100.0 if idle_ratio <= 1.0 else idle_ratio
        return calculate_efficiency_score(claims_count, aht_minutes, idle_percent, nva_flags_count)


DISTINCT_RGB_PALETTE = [
    "#3b82f6",  # Vibrant Blue
    "#10b981",  # Vibrant Emerald Green
    "#f59e0b",  # Vibrant Amber
    "#ef4444",  # Vibrant Rose Red
    "#8b5cf6",  # Vibrant Purple
    "#ec4899",  # Vibrant Pink
    "#06b6d4",  # Vibrant Cyan
    "#84cc16",  # Vibrant Lime
    "#f97316",  # Vibrant Orange
    "#6366f1",  # Vibrant Indigo
    "#14b8a6",  # Vibrant Teal
    "#a855f7",  # Vibrant Violet
    "#e11d48",  # Vibrant Crimson
    "#0284c7",  # Vibrant Sky/Ocean
    "#059669",  # Vibrant Forest
    "#d97706",  # Vibrant Ochre
    "#7c3aed",  # Vibrant Deep Violet
    "#db2777",  # Vibrant Magenta
    "#0891b2",  # Vibrant Cerulean
    "#ca8a04",  # Vibrant Gold
]

KNOWN_APP_COLORS = {
    "NovaArc RCM": "#4f46e5",     # Electric Indigo
    "ClaimPlatform": "#8b5cf6",   # Deep Purple
    "Chrome": "#2563eb",          # Browser Blue
    "Edge": "#0284c7",            # Cerulean Cyan
    "Excel": "#16a34a",           # Spreadsheet Green
    "TMS Dashboard": "#0d9488",   # Platform Teal
    "Create React App Sample": "#ec4899", # Neon Pink
    "Outlook": "#0078d4",         # Outlook Blue
    "MS Teams": "#7c3aed",        # Teams Violet
    "Adobe Acrobat": "#dc2626",   # Acrobat Red
    "BillingPortal": "#ea580c",   # Orange
    "YouTube": "#ef4444",         # Red
    "Bing": "#10b981",            # Emerald
    "Word": "#1d4ed8",            # Royal Blue
    "PowerPoint": "#c2410c",      # Amber Rust
    "Notepad": "#ca8a04",         # Gold
}


def get_vibrant_rgb_color(app_name: str, index: int = 0) -> str:
    """Returns a vibrant, distinct RGB hex color for any app or browser (never dull grey)."""
    if app_name in KNOWN_APP_COLORS:
        return KNOWN_APP_COLORS[app_name]
    h = sum(ord(c) * (i + 1) for i, c in enumerate(app_name))
    return DISTINCT_RGB_PALETTE[(h + index) % len(DISTINCT_RGB_PALETTE)]


def format_app_distribution(apps_dict: Dict[str, int]) -> List[Dict[str, Any]]:
    """Converts a dict of app_name -> seconds into a structured app_distribution list with RGB colors."""
    tot_sec = sum(apps_dict.values())
    if tot_sec <= 0:
        return []
    result = []
    for idx, (app, sec) in enumerate(sorted(apps_dict.items(), key=lambda x: x[1], reverse=True)):
        result.append({
            "app_name": app,
            "duration_seconds": sec,
            "percentage": round((sec / tot_sec) * 100.0, 1),
            "color": get_vibrant_rgb_color(app, idx)
        })
    return result


async def calculate_associate_kpis(
    db: AsyncSession, associate_id: str, session_id: str = None
) -> Dict[str, Any]:
    """
    Computes real-time associate performance metrics, application distribution,
    Average Handling Time (AHT), and composite efficiency score.
    """
    # 1. Fetch associate details
    assoc_stmt = select(Associate).where(Associate.id == associate_id)
    assoc_res = await db.execute(assoc_stmt)
    assoc = assoc_res.scalars().first()

    name = assoc.name if assoc else f"Associate {associate_id}"
    target = assoc.target_daily_claims if assoc else 40

    # 2. Fetch claim timelines
    query = select(ClaimTimeline).where(ClaimTimeline.associate_id == associate_id)
    if session_id:
        query = query.where(ClaimTimeline.session_id == session_id)
    
    tl_res = await db.execute(query)
    timelines = tl_res.scalars().all()

    completed = [t for t in timelines if t.status == "COMPLETED"]
    total_completed = len(completed)

    total_work_sec = sum(t.total_duration_seconds for t in timelines)
    total_active_sec = sum(t.active_duration_seconds for t in timelines)
    total_idle_sec = sum(t.idle_duration_seconds for t in timelines)

    # 3. Average Handling Time (AHT) in minutes
    if total_completed > 0:
        aht_minutes = round((sum(t.total_duration_seconds for t in completed) / total_completed) / 60.0, 1)
    elif timelines:
        aht_minutes = round((total_work_sec / len(timelines)) / 60.0, 1)
    else:
        aht_minutes = 0.0

    idle_percent = round((total_idle_sec / total_work_sec * 100.0), 1) if total_work_sec > 0 else 0.0

    # 4. Aggregate Application Share Distribution
    aggregated_apps: Dict[str, int] = {}
    for t in timelines:
        try:
            b_down = json.loads(t.app_breakdown_json or "{}")
            for app, sec in b_down.items():
                aggregated_apps[app] = aggregated_apps.get(app, 0) + sec
        except Exception:
            pass

    app_distribution = format_app_distribution(aggregated_apps)

    # 5. Composite Efficiency Score
    # Formula: Baseline (100) minus idle penalty (idle_percent * 0.7) minus NVA penalty (2.5 per flag, max 25)
    nva_count = sum(len(json.loads(t.nva_flags_json or "[]")) for t in timelines)
    penalty = min(25.0, nva_count * 2.5)
    efficiency = max(10.0, min(100.0, round(100.0 - (idle_percent * 0.7) - penalty, 1)))

    # In-progress active claim
    in_progress = [t for t in timelines if t.status == "IN_PROGRESS"]
    active_claim_id = in_progress[-1].claim_id if in_progress else None

    return {
        "associate_id": associate_id,
        "associate_name": name,
        "target_claims": target,
        "completed_claims_count": total_completed,
        "aht_minutes": aht_minutes,
        "total_work_seconds": total_work_sec,
        "total_active_seconds": total_active_sec,
        "total_idle_seconds": total_idle_sec,
        "idle_percentage": idle_percent,
        "efficiency_score": efficiency,
        "active_claim_id": active_claim_id,
        "app_distribution": app_distribution,
        "timelines": timelines
    }
