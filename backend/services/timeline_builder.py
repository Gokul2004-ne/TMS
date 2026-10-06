import json
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models import Event, ClaimTimeline


async def process_incoming_events(db: AsyncSession, events: List[Event]) -> int:
    """
    Foundational skeleton for processing incoming events into ClaimTimeline records.
    
    TODO [Member 2 - Backend]:
    1. Group events by (associate_id, session_id, claim_id).
    2. Query existing ClaimTimeline or create a new one.
    3. Calculate total duration, active duration, and idle duration by slicing consecutive event timestamps.
    4. Count application switches (whenever app_name changes).
    5. Aggregate app_breakdown_json (e.g. {"Excel": 140, "Chrome": 300}).
    6. Check if CLAIM_CLOSED event occurred to transition status to 'COMPLETED'.
    7. Invoke evaluate_nva_flags() to compute and store nva_flags_json.
    
    See backend/README.md for the complete algorithm and step-by-step implementation guide.
    """
    if not events:
        return 0

    # Group incoming events by (associate_id, session_id, claim_id)
    grouped: Dict[tuple, List[Event]] = {}
    for ev in events:
        if not ev.claim_id or ev.claim_id in ("UNASSIGNED", "IDLE_UNKNOWN"):
            continue
        key = (ev.associate_id, ev.session_id, ev.claim_id)
        grouped.setdefault(key, []).append(ev)

    updated_count = 0

    for (associate_id, session_id, claim_id), ev_list in grouped.items():
        ev_list.sort(key=lambda x: x.timestamp)

        # Look up existing timeline record
        stmt = select(ClaimTimeline).where(
            and_(
                ClaimTimeline.associate_id == associate_id,
                ClaimTimeline.session_id == session_id,
                ClaimTimeline.claim_id == claim_id
            )
        )
        res = await db.execute(stmt)
        timeline = res.scalars().first()

        if not timeline:
            timeline = ClaimTimeline(
                claim_id=claim_id,
                associate_id=associate_id,
                session_id=session_id,
                start_time=ev_list[0].timestamp,
                end_time=ev_list[-1].timestamp,
                total_duration_seconds=0,
                active_duration_seconds=0,
                idle_duration_seconds=0,
                app_switches_count=0,
                app_breakdown_json="{}",
                status="IN_PROGRESS",
                nva_flags_json="[]"
            )
            db.add(timeline)
            await db.flush()

        # Baseline timeline update (to be completed by Member 2 per backend/README.md)
        timeline.end_time = ev_list[-1].timestamp
        delta = max(1, int((timeline.end_time - timeline.start_time).total_seconds()))
        timeline.total_duration_seconds = delta
        timeline.active_duration_seconds = delta
        
        # Check close event
        if any(e.event_type == "CLAIM_CLOSED" for e in ev_list):
            timeline.status = "COMPLETED"

        # Evaluate NVA heuristics
        flags = evaluate_nva_flags(delta, 0, 0, {})
        timeline.nva_flags_json = json.dumps(flags)

        updated_count += 1

    return updated_count


def evaluate_nva_flags(total_sec: int, idle_sec: int, switches: int, app_breakdown: Dict[str, int]) -> List[str]:
    """
    Evaluates NVA heuristics on a claim's timeline.
    
    TODO [Member 2 - Backend]:
    - Rule 1 (EXCEL_OVERUSE): Excel active time > 40% of total duration (min duration 180s).
    - Rule 2 (APP_SWITCHING): App context switches >= 8.
    - Rule 3 (LONG_IDLE): Idle duration >= 180s.
    - Rule 4 (OUTLIER): Total claim handling duration >= 1200s (20 mins).
    """
    flags = []
    if total_sec <= 0:
        return flags

    # Rule 1: Excel Overuse
    excel_time = app_breakdown.get("Excel", 0)
    if total_sec > 180 and (excel_time / total_sec) > 0.40:
        flags.append("EXCEL_OVERUSE")

    # Rule 2: Excessive App Switching
    if switches >= 8:
        flags.append("APP_SWITCHING")

    # Rule 3: Long Idle Incidents
    if idle_sec >= 180:
        flags.append("LONG_IDLE")

    # Rule 4: Outlier Duration
    if total_sec >= 1200:
        flags.append("OUTLIER")

    return flags
