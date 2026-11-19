import json
import gc
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from models import Event, ClaimTimeline


def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.replace(tzinfo=None)
    return dt


async def process_incoming_events(db: AsyncSession, events: List[Event]) -> int:
    """
    Processes incoming agent events to construct and update ClaimTimeline records.
    Computes time slices, active vs idle durations, application breakdown, and NVA flags.
    Optimized for minimal memory consumption under 512MB RAM cloud tiers.
    """
    if not events:
        return 0

    # Group events by (associate_id, session_id, claim_id)
    grouped: Dict[tuple, List[Event]] = {}
    for ev in events:
        if not ev.claim_id or ev.claim_id in ("UNASSIGNED", "IDLE_UNKNOWN"):
            continue
        key = (ev.associate_id, ev.session_id, ev.claim_id)
        grouped.setdefault(key, []).append(ev)

    updated_count = 0

    for (associate_id, session_id, claim_id), ev_list in grouped.items():
        # Sort events by timestamp
        ev_list.sort(key=lambda x: _normalize_dt(x.timestamp) or datetime.min)
        # Auto-complete any other open timeline for this associate
        other_open_stmt = select(ClaimTimeline).where(
            and_(
                ClaimTimeline.associate_id == associate_id,
                ClaimTimeline.claim_id != claim_id,
                ClaimTimeline.status == "IN_PROGRESS"
            )
        )
        other_res = await db.execute(other_open_stmt)
        for other_tl in other_res.scalars().all():
            other_tl.status = "COMPLETED"
            if not other_tl.end_time:
                other_tl.end_time = _normalize_dt(ev_list[0].timestamp)

        # Look up existing timeline record for this associate and claim
        stmt = select(ClaimTimeline).where(
            and_(
                ClaimTimeline.associate_id == associate_id,
                ClaimTimeline.claim_id == claim_id
            )
        ).order_by(ClaimTimeline.id.desc())
        res = await db.execute(stmt)
        timeline = res.scalars().first()

        if not timeline:
            timeline = ClaimTimeline(
                claim_id=claim_id,
                associate_id=associate_id,
                session_id=session_id,
                start_time=_normalize_dt(ev_list[0].timestamp),
                end_time=_normalize_dt(ev_list[-1].timestamp),
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
        else:
            # Keep session_id updated to latest active session
            timeline.session_id = session_id

        # Memory optimization: Select ONLY required column primitives instead of full ORM Event entities
        all_ev_stmt = select(
            Event.timestamp,
            Event.app_name,
            Event.is_idle,
            Event.event_type
        ).where(
            and_(
                Event.associate_id == associate_id,
                Event.claim_id == claim_id
            )
        ).order_by(Event.timestamp.asc())
        all_ev_res = await db.execute(all_ev_stmt)
        all_events = all_ev_res.all()

        if all_events:
            start_t = _normalize_dt(all_events[0][0])
            end_t = _normalize_dt(all_events[-1][0])
            timeline.start_time = start_t
            timeline.end_time = end_t

            total_active = 0
            total_idle = 0
            app_breakdown: Dict[str, int] = {}
            switches = 0
            last_app = None
            has_closed = False

            # Time-slicing algorithm: calculate delta between sequential events
            for i in range(len(all_events)):
                curr_ts, curr_app, curr_idle, curr_type = all_events[i]
                if curr_type == "CLAIM_CLOSED":
                    has_closed = True

                if last_app and curr_app != last_app:
                    switches += 1
                last_app = curr_app

                if i < len(all_events) - 1:
                    next_ts = all_events[i + 1][0]
                    t_curr = _normalize_dt(curr_ts)
                    t_next = _normalize_dt(next_ts)
                    delta = int((t_next - t_curr).total_seconds()) if t_next and t_curr else 0
                    duration_slice = max(1, min(delta, 30))
                else:
                    duration_slice = 3  # Default poll interval for final event

                if curr_idle:
                    total_idle += duration_slice
                else:
                    total_active += duration_slice
                    app_breakdown[curr_app] = app_breakdown.get(curr_app, 0) + duration_slice

            total_sec = total_active + total_idle
            timeline.total_duration_seconds = total_sec
            timeline.active_duration_seconds = total_active
            timeline.idle_duration_seconds = total_idle
            timeline.app_switches_count = switches
            timeline.app_breakdown_json = json.dumps(app_breakdown)

            if has_closed:
                timeline.status = "COMPLETED"
            elif timeline.status == "IN_PROGRESS":
                now_t = datetime.now(timezone.utc).replace(tzinfo=None)
                if end_t and (now_t - end_t).total_seconds() > 600:
                    timeline.status = "COMPLETED"

            # Check for multiple touches / rework using count query rather than loading full objects
            touch_stmt = select(func.count(ClaimTimeline.id)).where(
                and_(
                    ClaimTimeline.associate_id == associate_id,
                    ClaimTimeline.claim_id == claim_id
                )
            )
            touch_res = await db.execute(touch_stmt)
            touch_count = touch_res.scalar() or 1

            # Evaluate full NVA heuristics
            flags = evaluate_nva_flags(total_sec, total_idle, switches, app_breakdown, touch_count)
            timeline.nva_flags_json = json.dumps(flags)

            updated_count += 1

    if len(events) > 50:
        gc.collect()

    return updated_count


def evaluate_nva_flags(
    total_sec: int,
    idle_sec: int,
    switches: int,
    app_breakdown: Dict[str, int],
    touch_count: int = 1
) -> List[str]:
    """
    Evaluates Non-Value-Added (NVA) friction heuristics on a claim timeline:
    - Rule 1 (EXCEL_OVERUSE): Excel active time >= 40% of duration (min 180s).
    - Rule 2 (APP_SWITCHING): App context toggles >= 8 switches.
    - Rule 3 (LONG_IDLE): Continuous/accumulated idle duration >= 180s.
    - Rule 4 (OUTLIER): Total handling duration >= 1200s (20 mins).
    - Rule 5 (REWORK): Multiple touches / sessions on same claim (touch_count >= 2).
    """
    flags: List[str] = []
    if total_sec <= 0:
        return flags

    # Rule 1: Excel Overuse
    excel_time = app_breakdown.get("Excel", 0)
    if total_sec >= 180 and (excel_time / total_sec) >= 0.40:
        flags.append("EXCEL_OVERUSE")

    # Rule 2: Excessive App Switching
    if switches >= 8:
        flags.append("APP_SWITCHING")

    # Rule 3: Long Idle Incidents
    if idle_sec >= 180:
        flags.append("LONG_IDLE")

    # Rule 4: Outlier Handling Duration
    if total_sec >= 1200:
        flags.append("OUTLIER")

    # Rule 5: Rework / Multiple Touches
    if touch_count >= 2:
        flags.append("REWORK")

    return flags
