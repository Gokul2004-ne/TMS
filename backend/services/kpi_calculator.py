import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models import Associate, ClaimTimeline


async def calculate_associate_kpis(
    db: AsyncSession, associate_id: str, session_id: str = None
) -> Dict[str, Any]:
    """
    Foundational skeleton for calculating associate performance metrics.
    
    TODO [Member 2 - Backend]:
    1. Query Associate record and their associated ClaimTimelines.
    2. Compute Average Handling Time (AHT) in minutes for completed claims:
       AHT = sum(completed claim duration) / count(completed claims) / 60
    3. Compute Idle Time Percentage:
       idle_percentage = (total_idle_seconds / total_work_seconds) * 100
    4. Compute Composite Efficiency Score:
       score = max(0, min(100, 100 - (idle_percentage * 0.7) - nva_penalty))
    5. Aggregate app distribution across all timelines.
    
    See backend/README.md for full specifications and formula references.
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

    # 3. AHT Calculation
    if total_completed > 0:
        aht_minutes = round((sum(t.total_duration_seconds for t in completed) / total_completed) / 60.0, 1)
    elif timelines:
        aht_minutes = round((total_work_sec / len(timelines)) / 60.0, 1)
    else:
        aht_minutes = 0.0

    idle_percent = round((total_idle_sec / total_work_sec * 100.0), 1) if total_work_sec > 0 else 0.0

    # 4. App Distribution
    aggregated_apps: Dict[str, int] = {}
    for t in timelines:
        try:
            b_down = json.loads(t.app_breakdown_json or "{}")
            for app, sec in b_down.items():
                aggregated_apps[app] = aggregated_apps.get(app, 0) + sec
        except Exception:
            pass

    app_distribution = []
    tot_app_sec = sum(aggregated_apps.values()) or 1
    palette = {
        "Excel": "#107c41",
        "Chrome": "#4285f4",
        "Edge": "#0078d7",
        "ClaimPlatform": "#8b5cf6",
        "BillingPortal": "#6366f1"
    }

    for app, sec in sorted(aggregated_apps.items(), key=lambda x: x[1], reverse=True):
        app_distribution.append({
            "app_name": app,
            "duration_seconds": sec,
            "percentage": round((sec / tot_app_sec) * 100.0, 1),
            "color": palette.get(app, "#94a3b8")
        })

    # 5. Composite Efficiency Score
    # TODO [Member 2]: Refine penalty calculation based on specific client weights
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
