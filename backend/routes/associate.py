import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from database import get_db
from models import Associate, Session, ClaimTimeline, Event
from schemas import (
    AssociateTodayOut,
    ClaimTimelineItem,
    ClaimTimelineDetail,
    AppBreakdown
)
from services.kpi_calculator import calculate_associate_kpis

router = APIRouter(prefix="/api/associate", tags=["Associate"])


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
        active_claim_id=kpis["active_claim_id"],
        app_distribution=kpis["app_distribution"],
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


@router.get("/{associate_id}/claims/{claim_id}/timeline", response_model=ClaimTimelineDetail)
async def get_claim_timeline_detail(
    associate_id: str, claim_id: str, db: AsyncSession = Depends(get_db)
):
    """Detailed visual timeline breakdown and raw events for a specific claim."""
    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == claim_id)
    )
    tl_res = await db.execute(tl_stmt)
    timeline = tl_res.scalars().first()
    if not timeline:
        raise HTTPException(status_code=404, detail="Claim timeline not found")

    # Fetch raw events
    ev_stmt = select(Event).where(
        and_(Event.associate_id == associate_id, Event.claim_id == claim_id)
    ).order_by(Event.timestamp.asc())
    ev_res = await db.execute(ev_stmt)
    events = ev_res.scalars().all()

    breakdown_dict = json.loads(timeline.app_breakdown_json or "{}")
    tot = timeline.total_duration_seconds or 1

    palette = {
        "Excel": "#107c41",
        "Chrome": "#4285f4",
        "Edge": "#0078d7",
        "ClaimPlatform": "#8b5cf6",
        "BillingPortal": "#6366f1"
    }

    app_breakdowns = [
        AppBreakdown(
            app_name=k,
            duration_seconds=v,
            percentage=round((v / tot) * 100.0, 1),
            color=palette.get(k, "#94a3b8")
        )
        for k, v in breakdown_dict.items()
    ]

    raw_events_out = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "app_name": e.app_name,
            "window_title": e.window_title,
            "timestamp": e.timestamp.isoformat(),
            "is_idle": e.is_idle
        }
        for e in events
    ]

    return ClaimTimelineDetail(
        claim_id=timeline.claim_id,
        associate_id=timeline.associate_id,
        start_time=timeline.start_time,
        end_time=timeline.end_time,
        total_duration_seconds=timeline.total_duration_seconds,
        active_duration_seconds=timeline.active_duration_seconds,
        idle_duration_seconds=timeline.idle_duration_seconds,
        app_switches_count=timeline.app_switches_count,
        status=timeline.status,
        nva_flags=json.loads(timeline.nva_flags_json or "[]"),
        app_breakdowns=app_breakdowns,
        raw_events=raw_events_out
    )
