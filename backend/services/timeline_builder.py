import re
import json
import gc
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from models import Event, ClaimTimeline
from services.kpi_calculator import canonical_app_name


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

        # Check if this claim is currently active in memory
        is_active_override = False
        override_start = None
        try:
            from routes.associate import ACTIVE_CLAIM_OVERRIDE
            curr_ov = ACTIVE_CLAIM_OVERRIDE.get(associate_id, {})
            is_active_override = (
                curr_ov.get("claim_id") == claim_id
                and curr_ov.get("status") == "IN_PROGRESS"
            )
            if is_active_override and curr_ov.get("set_at"):
                override_start = _normalize_dt(curr_ov.get("set_at"))
        except Exception:
            pass

        # Look up existing timeline record for this associate and claim
        stmt = select(ClaimTimeline).where(
            and_(
                ClaimTimeline.associate_id == associate_id,
                ClaimTimeline.claim_id == claim_id
            )
        ).order_by(ClaimTimeline.id.desc())
        res = await db.execute(stmt)
        timeline = res.scalars().first()

        ev_has_detected = any(e.event_type == "CLAIM_DETECTED" for e in ev_list)
        ev_max_ts = _normalize_dt(ev_list[-1].timestamp)

        # Prevent stale pre-close batches from mutating or re-opening an already COMPLETED claim
        if timeline and timeline.status == "COMPLETED" and not is_active_override:
            tl_end = _normalize_dt(timeline.end_time)
            if not ev_has_detected and tl_end and ev_max_ts and ev_max_ts <= (tl_end + timedelta(seconds=5)):
                continue

        if not timeline or (timeline.status == "COMPLETED" and (is_active_override or ev_has_detected)):
            start_ts = override_start or _normalize_dt(ev_list[0].timestamp)
            timeline = ClaimTimeline(
                claim_id=claim_id,
                associate_id=associate_id,
                session_id=session_id,
                start_time=start_ts,
                end_time=None if is_active_override else _normalize_dt(ev_list[-1].timestamp),
                total_duration_seconds=0,
                active_duration_seconds=0,
                idle_duration_seconds=0,
                system_buffer_seconds=0,
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

        # Scope events STRICTLY to this timeline touch so historical sessions never bleed in
        ev_conditions = [
            Event.associate_id == associate_id,
            Event.claim_id == claim_id
        ]
        tl_start_norm = _normalize_dt(timeline.start_time)
        if tl_start_norm:
            ev_conditions.append(Event.timestamp >= (tl_start_norm - timedelta(seconds=2)))

        # Memory optimization: Select ONLY required column primitives capped to most recent 400 events
        all_ev_stmt = select(
            Event.timestamp,
            Event.app_name,
            Event.is_idle,
            Event.event_type,
            Event.window_title
        ).where(
            and_(*ev_conditions)
        ).order_by(Event.timestamp.desc()).limit(400)
        all_ev_res = await db.execute(all_ev_stmt)
        all_events = list(reversed(all_ev_res.all()))

        if all_events:
            start_t = _normalize_dt(all_events[0][0])
            end_t = _normalize_dt(all_events[-1][0])
            if not timeline.start_time:
                timeline.start_time = start_t
            timeline.end_time = end_t

            total_active = 0
            total_idle = 0
            total_buffer = 0
            app_breakdown: Dict[str, int] = {}
            switches = 0
            last_app = None
            has_closed = False

            # Time-slicing algorithm: calculate delta between sequential events
            for i in range(len(all_events)):
                curr_ts, curr_app, curr_idle, curr_type, curr_title = all_events[i]
                canon_app = canonical_app_name(curr_app or "Application")
                if curr_type == "CLAIM_CLOSED":
                    has_closed = True
                elif curr_type == "CLAIM_DETECTED":
                    has_closed = False

                is_switch = False
                if last_app and canon_app.lower() != last_app.lower():
                    switches += 1
                    is_switch = True
                last_app = canon_app

                if i < len(all_events) - 1:
                    next_ts = all_events[i + 1][0]
                    t_curr = _normalize_dt(curr_ts)
                    t_next = _normalize_dt(next_ts)
                    delta = int((t_next - t_curr).total_seconds()) if t_next and t_curr else 0
                    duration_slice = max(1, min(delta, 120))
                else:
                    delta = 3
                    duration_slice = 3  # Default poll interval for final event

                # System Buffer Time (>10s app launch delay): exclude from active AHT
                if curr_type == "APP_LOAD_BUFFER":
                    m = re.search(r"(\d+)\s*s\s*load", curr_title or "", re.IGNORECASE)
                    buf_val = int(m.group(1)) if m else duration_slice
                    buf_val = max(11, min(buf_val, 120))
                    total_buffer += buf_val
                    continue
                elif (is_switch or curr_type == "APP_SWITCH") and delta > 10:
                    buf_val = min(delta - 5, 120)
                    total_buffer += buf_val
                    duration_slice = max(1, duration_slice - buf_val)
                else:
                    duration_slice = min(duration_slice, 30)

                if curr_idle:
                    total_idle += duration_slice
                else:
                    total_active += duration_slice
                    app_breakdown[canon_app] = app_breakdown.get(canon_app, 0) + duration_slice

            total_sec = total_active + total_idle + total_buffer
            timeline.total_duration_seconds = total_sec
            timeline.active_duration_seconds = total_active
            timeline.idle_duration_seconds = total_idle
            timeline.system_buffer_seconds = total_buffer
            timeline.app_switches_count = switches
            timeline.app_breakdown_json = json.dumps(app_breakdown)

            if has_closed and not is_active_override:
                timeline.status = "COMPLETED"
                timeline.end_time = end_t
            elif is_active_override:
                timeline.status = "IN_PROGRESS"
                timeline.end_time = None
            elif timeline.status != "COMPLETED":
                now_t = datetime.now(timezone.utc).replace(tzinfo=None)
                if end_t and (now_t - end_t).total_seconds() > 43200:
                    timeline.status = "COMPLETED"
                    timeline.end_time = end_t
                else:
                    timeline.status = "IN_PROGRESS"
                    timeline.end_time = None

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
