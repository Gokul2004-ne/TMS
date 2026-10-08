import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Dict, Optional, Any
from database import get_db
from models import Associate, Session, ClaimTimeline, Event
from schemas import (
    AssociateTodayOut,
    ClaimTimelineItem,
    ClaimTimelineDetail,
    AppBreakdown,
    SetActiveClaimIn,
    ActiveClaimOut
)
from services.kpi_calculator import (
    calculate_associate_kpis,
    get_vibrant_rgb_color,
    format_app_distribution
)

router = APIRouter(prefix="/api/associate", tags=["Associate"])

# In-memory storage for real-time manual active claim overrides
ACTIVE_CLAIM_OVERRIDE: Dict[str, Dict[str, Any]] = {}


@router.get("/{associate_id}/active-claim", response_model=ActiveClaimOut)
async def get_active_claim(associate_id: str):
    """Returns the currently active claim context for an associate."""
    entry = ACTIVE_CLAIM_OVERRIDE.get(associate_id, {})
    return ActiveClaimOut(
        associate_id=associate_id,
        active_claim_id=entry.get("claim_id", "UNASSIGNED"),
        patient_name=entry.get("patient_name"),
        status=entry.get("status", "IN_PROGRESS")
    )


@router.post("/{associate_id}/active-claim", response_model=ActiveClaimOut, status_code=status.HTTP_200_OK)
async def set_active_claim(
    associate_id: str, payload: SetActiveClaimIn, db: AsyncSession = Depends(get_db)
):
    """Sets the active claim context manually (from dashboard modal or agent prompt)."""
    clean_claim = payload.claim_id.strip().upper()
    ACTIVE_CLAIM_OVERRIDE[associate_id] = {
        "claim_id": clean_claim,
        "patient_name": payload.patient_name,
        "status": payload.status or "IN_PROGRESS",
        "set_at": datetime.now(timezone.utc)
    }

    # Find active session
    sess_stmt = select(Session).where(
        and_(Session.associate_id == associate_id, Session.is_active == True)
    ).order_by(Session.start_time.desc())
    sess_res = await db.execute(sess_stmt)
    active_sess = sess_res.scalars().first()
    sess_id = active_sess.id if active_sess else f"sess-{associate_id.lower()}-default"

    # Emit an explicit CLAIM_DETECTED event
    event = Event(
        session_id=sess_id,
        associate_id=associate_id,
        claim_id=clean_claim,
        event_type="CLAIM_DETECTED",
        app_name="ClaimPlatform",
        window_title=f"Claim Work Assistant: {clean_claim} {payload.patient_name or ''}".strip(),
        timestamp=datetime.now(timezone.utc),
        is_idle=False,
        agent_version="1.0.0"
    )
    db.add(event)

    # Check if a timeline already exists for this claim
    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == clean_claim)
    )
    tl_res = await db.execute(tl_stmt)
    tl = tl_res.scalars().first()
    if tl:
        tl.status = "IN_PROGRESS"
    else:
        new_tl = ClaimTimeline(
            claim_id=clean_claim,
            session_id=sess_id,
            associate_id=associate_id,
            start_time=datetime.now(timezone.utc),
            status="IN_PROGRESS",
            total_duration_seconds=0,
            active_duration_seconds=0,
            idle_duration_seconds=0,
            app_switches_count=0,
            app_breakdown_json="{}",
            nva_flags_json="[]"
        )
        db.add(new_tl)

    await db.commit()

    return ActiveClaimOut(
        associate_id=associate_id,
        active_claim_id=clean_claim,
        patient_name=payload.patient_name,
        status=payload.status or "IN_PROGRESS"
    )


@router.get("/{associate_id}/today", response_model=AssociateTodayOut)
async def get_associate_today(associate_id: str, db: AsyncSession = Depends(get_db)):
    """Fetches real-time dashboard data for the associate's current shift."""
    kpis = await calculate_associate_kpis(db, associate_id)

    # Check for active session
    sess_stmt = select(Session).where(
        and_(Session.associate_id == associate_id, Session.is_active == True)
    ).order_by(Session.start_time.desc())
    sess_res = await db.execute(sess_stmt)
    active_sess = sess_res.scalars().first()

    # Determine active claim ID (prioritize manual override from dashboard)
    active_override = ACTIVE_CLAIM_OVERRIDE.get(associate_id, {}).get("claim_id")
    resolved_active_claim = active_override or kpis["active_claim_id"]

    # For every active claim, application time share cycle shows that specific active claim's app breakdown.
    # For every new claim ID, it starts empty (0 time, empty list) so existing previous claim data is not shown.
    if resolved_active_claim and resolved_active_claim != "UNASSIGNED":
        active_breakdown: Dict[str, int] = {}
        for t in reversed(kpis["timelines"]):
            if t.claim_id == resolved_active_claim:
                try:
                    active_breakdown = json.loads(t.app_breakdown_json or "{}")
                except Exception:
                    active_breakdown = {}
                break
        claim_app_distribution = format_app_distribution(active_breakdown)
    else:
        claim_app_distribution = []

    recent_claims = []
    for t in kpis["timelines"][-15:]:
        flags = json.loads(t.nva_flags_json or "[]")
        breakdown = json.loads(t.app_breakdown_json or "{}")
        recent_claims.append(
            ClaimTimelineItem(
                claim_id=t.claim_id,
                associate_id=t.associate_id,
                session_id=t.session_id,
                start_time=t.start_time,
                end_time=t.end_time,
                total_duration_seconds=t.total_duration_seconds,
                active_duration_seconds=t.active_duration_seconds,
                idle_duration_seconds=t.idle_duration_seconds,
                app_switches_count=t.app_switches_count,
                status=t.status,
                nva_flags=flags,
                app_breakdown=breakdown
            )
        )

    return AssociateTodayOut(
        associate_id=associate_id,
        associate_name=kpis["associate_name"],
        session_id=active_sess.id if active_sess else None,
        is_active=bool(active_sess),
        target_claims=kpis["target_claims"],
        completed_claims_count=kpis["completed_claims_count"],
        aht_minutes=kpis["aht_minutes"],
        total_work_seconds=kpis["total_work_seconds"],
        total_active_seconds=kpis["total_active_seconds"],
        total_idle_seconds=kpis["total_idle_seconds"],
        idle_percentage=kpis["idle_percentage"],
        efficiency_score=kpis["efficiency_score"],
        active_claim_id=resolved_active_claim,
        app_distribution=claim_app_distribution,
        recent_claims=recent_claims
    )


@router.get("/{associate_id}/claims", response_model=List[ClaimTimelineItem])
async def get_associate_claims(associate_id: str, db: AsyncSession = Depends(get_db)):
    """Lists all claim timelines handled by this associate."""
    stmt = select(ClaimTimeline).where(
        ClaimTimeline.associate_id == associate_id
    ).order_by(ClaimTimeline.start_time.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    items = []
    for t in records:
        items.append(
            ClaimTimelineItem(
                claim_id=t.claim_id,
                associate_id=t.associate_id,
                session_id=t.session_id,
                start_time=t.start_time,
                end_time=t.end_time,
                total_duration_seconds=t.total_duration_seconds,
                active_duration_seconds=t.active_duration_seconds,
                idle_duration_seconds=t.idle_duration_seconds,
                app_switches_count=t.app_switches_count,
                status=t.status,
                nva_flags=json.loads(t.nva_flags_json or "[]"),
                app_breakdown=json.loads(t.app_breakdown_json or "{}")
            )
        )
    return items


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/{associate_id}/claims/{claim_id}/timeline", response_model=ClaimTimelineDetail)
async def get_claim_timeline_detail(
    associate_id: str, claim_id: str, db: AsyncSession = Depends(get_db)
):
    """Detailed visual timeline breakdown and raw events for a specific claim (latest events first)."""
    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == claim_id)
    )
    tl_res = await db.execute(tl_stmt)
    timeline = tl_res.scalars().first()
    if not timeline:
        raise HTTPException(status_code=404, detail="Claim timeline not found")

    # Fetch raw events with latest timestamp at top (descending)
    ev_stmt = select(Event).where(
        and_(Event.associate_id == associate_id, Event.claim_id == claim_id)
    ).order_by(Event.timestamp.desc())
    ev_res = await db.execute(ev_stmt)
    events = ev_res.scalars().all()

    breakdown_dict = json.loads(timeline.app_breakdown_json or "{}")
    tot = timeline.total_duration_seconds or 1

    app_breakdowns = [
        AppBreakdown(
            app_name=k,
            duration_seconds=v,
            percentage=round((v / tot) * 100.0, 1),
            color=get_vibrant_rgb_color(k, idx)
        )
        for idx, (k, v) in enumerate(breakdown_dict.items())
    ]

    raw_events_out = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "app_name": e.app_name,
            "window_title": e.window_title,
            "timestamp": ensure_utc(e.timestamp).isoformat(),
            "is_idle": e.is_idle
        }
        for e in events
    ]

    return ClaimTimelineDetail(
        claim_id=timeline.claim_id,
        associate_id=timeline.associate_id,
        start_time=ensure_utc(timeline.start_time),
        end_time=ensure_utc(timeline.end_time),
        total_duration_seconds=timeline.total_duration_seconds,
        active_duration_seconds=timeline.active_duration_seconds,
        idle_duration_seconds=timeline.idle_duration_seconds,
        app_switches_count=timeline.app_switches_count,
        status=timeline.status,
        nva_flags=json.loads(timeline.nva_flags_json or "[]"),
        app_breakdowns=app_breakdowns,
        raw_events=raw_events_out
    )


@router.post("/{associate_id}/claims/{claim_id}/complete")
async def complete_claim(
    associate_id: str,
    claim_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Marks a claim as COMPLETED, records end timestamp, calculates final durations,
    updates active override status, and writes/updates TMS_Completed_Claims.xlsx.
    """
    clean_cid = claim_id.strip().upper()
    now = datetime.now(timezone.utc)

    # Find timeline or create completed timeline
    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == clean_cid)
    )
    tl_res = await db.execute(tl_stmt)
    tl = tl_res.scalars().first()

    if not tl:
        # Create completed timeline if associate worked without explicit record
        sess_stmt = select(Session).where(
            and_(Session.associate_id == associate_id, Session.is_active == True)
        ).order_by(Session.start_time.desc())
        sess_res = await db.execute(sess_stmt)
        active_sess = sess_res.scalars().first()
        sess_id = active_sess.id if active_sess else f"sess-{associate_id.lower()}-1"

        tl = ClaimTimeline(
            claim_id=clean_cid,
            session_id=sess_id,
            associate_id=associate_id,
            start_time=now,
            end_time=now,
            total_duration_seconds=180,
            active_duration_seconds=180,
            idle_duration_seconds=0,
            app_switches_count=2,
            status="COMPLETED",
            app_breakdown_json='{"NovaArc RCM": 180}',
            nva_flags_json="[]"
        )
        db.add(tl)
    else:
        tl.status = "COMPLETED"
        tl.end_time = now
        st = tl.start_time if getattr(tl.start_time, "tzinfo", None) else (tl.start_time.replace(tzinfo=timezone.utc) if tl.start_time else now)
        dur = max(60, int((now - st).total_seconds())) if st else 180
        tl.total_duration_seconds = max(tl.total_duration_seconds or 0, dur)
        if not tl.active_duration_seconds:
            tl.active_duration_seconds = tl.total_duration_seconds

    # Emit CLAIM_CLOSED event
    close_event = Event(
        session_id=tl.session_id,
        associate_id=associate_id,
        claim_id=clean_cid,
        event_type="CLAIM_CLOSED",
        app_name="ClaimPlatform",
        window_title=f"Claim Work Assistant: {clean_cid} Closed and Completed",
        timestamp=now,
        is_idle=False,
        agent_version="1.0.0"
    )
    db.add(close_event)

    # Update active override status if this was active claim
    if associate_id in ACTIVE_CLAIM_OVERRIDE:
        if ACTIVE_CLAIM_OVERRIDE[associate_id].get("claim_id") == clean_cid:
            ACTIVE_CLAIM_OVERRIDE[associate_id]["status"] = "COMPLETED"

    await db.commit()
    await db.refresh(tl)

    # Export to Excel sheet
    excel_path = None
    try:
        from services.excel_exporter import export_claim_to_excel
        excel_path = await export_claim_to_excel(db, associate_id, clean_cid)
    except Exception as e:
        print(f"[API] Error exporting completed claim to Excel: {e}")

    return {
        "status": "success",
        "message": f"Claim {clean_cid} marked COMPLETED",
        "claim_id": clean_cid,
        "claim_status": tl.status,
        "total_duration_seconds": tl.total_duration_seconds,
        "excel_export_path": excel_path
    }


@router.post("/{associate_id}/claims/{claim_id}/status")
async def update_claim_status(
    associate_id: str,
    claim_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the status of a claim timeline (e.g. toggling IN_PROGRESS <-> COMPLETED).
    """
    clean_cid = claim_id.strip().upper()
    new_status = payload.get("status", "IN_PROGRESS").strip().upper()
    now = datetime.now(timezone.utc)

    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == clean_cid)
    )
    tl_res = await db.execute(tl_stmt)
    tl = tl_res.scalars().first()

    if tl:
        tl.status = new_status
        if new_status == "COMPLETED":
            tl.end_time = now
            st = tl.start_time if getattr(tl.start_time, "tzinfo", None) else (tl.start_time.replace(tzinfo=timezone.utc) if tl.start_time else now)
            dur = max(60, int((now - st).total_seconds())) if st else 180
            tl.total_duration_seconds = max(tl.total_duration_seconds or 0, dur)
        await db.commit()
        await db.refresh(tl)

    if associate_id in ACTIVE_CLAIM_OVERRIDE and ACTIVE_CLAIM_OVERRIDE[associate_id].get("claim_id") == clean_cid:
        ACTIVE_CLAIM_OVERRIDE[associate_id]["status"] = new_status

    excel_path = None
    if new_status == "COMPLETED":
        try:
            from services.excel_exporter import export_claim_to_excel
            excel_path = await export_claim_to_excel(db, associate_id, clean_cid)
        except Exception as e:
            print(f"[API] Error updating Excel export: {e}")

    return {
        "status": "success",
        "claim_id": clean_cid,
        "new_status": new_status,
        "excel_export_path": excel_path
    }

