import json
from datetime import datetime, date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from database import get_db
from models import Associate, Session, ClaimTimeline
from schemas import (
    TeamOverviewOut,
    AssociateOverviewItem,
    NVASummaryOut
)
from services.kpi_calculator import calculate_associate_kpis

router = APIRouter(prefix="/api/team", tags=["Team"])


@router.get("/overview", response_model=TeamOverviewOut)
async def get_team_overview(db: AsyncSession = Depends(get_db)):
    """Supervisor view aggregating active shifts, team AHT, and individual status."""
    assoc_res = await db.execute(select(Associate))
    associates = assoc_res.scalars().all()

    # If no associates exist in DB, provide default seed associates so dashboard renders immediately
    if not associates:
        # Auto-create sample seed associates for out-of-the-box demo
        seed_data = [
            ("EMP101", "Priya Sharma", "priya.s@company.com"),
            ("EMP102", "Rahul Verma", "rahul.v@company.com"),
            ("EMP103", "Ananya Iyer", "ananya.i@company.com"),
            ("EMP104", "Karthik Raja", "karthik.r@company.com"),
        ]
        for aid, aname, amail in seed_data:
            a = Associate(id=aid, name=aname, email=amail, role="ASSOCIATE")
            db.add(a)
        await db.commit()
        assoc_res = await db.execute(select(Associate))
        associates = assoc_res.scalars().all()

    assoc_items: List[AssociateOverviewItem] = []
    total_claims = 0
    total_aht_sum = 0.0
    total_idle_sum = 0.0
    total_eff_sum = 0.0
    active_count = 0
    active_alerts = []

    for a in associates:
        kpis = await calculate_associate_kpis(db, a.id)
        
        # Check active session
        sess_stmt = select(Session).where(
            (Session.associate_id == a.id) & (Session.is_active == True)
        )
        s_res = await db.execute(sess_stmt)
        has_active = s_res.scalars().first() is not None

        status_str = "ACTIVE" if has_active else "OFFLINE"
        if has_active and kpis["idle_percentage"] > 25.0:
            status_str = "IDLE"

        if has_active:
            active_count += 1

        total_claims += kpis["completed_claims_count"]
        total_aht_sum += kpis["aht_minutes"]
        total_idle_sum += kpis["idle_percentage"]
        total_eff_sum += kpis["efficiency_score"]

        # Count NVA flags across this associate's claims
        flags_count = sum(len(json.loads(t.nva_flags_json or "[]")) for t in kpis["timelines"])

        # Detect alerts
        if kpis["idle_percentage"] > 30.0:
            active_alerts.append({
                "associate_id": a.id,
                "associate_name": a.name,
                "type": "HIGH_IDLE",
                "message": f"{a.name} has exceeded 30% idle time today ({kpis['idle_percentage']}%)."
            })
        if flags_count >= 5:
            active_alerts.append({
                "associate_id": a.id,
                "associate_name": a.name,
                "type": "NVA_SPIKE",
                "message": f"{a.name} logged {flags_count} NVA flags across recent claims."
            })

        assoc_items.append(
            AssociateOverviewItem(
                associate_id=a.id,
                name=a.name,
                status=status_str,
                current_claim_id=kpis["active_claim_id"],
                completed_claims=kpis["completed_claims_count"],
                aht_minutes=kpis["aht_minutes"],
                idle_percentage=kpis["idle_percentage"],
                efficiency_score=kpis["efficiency_score"],
                flags_count=flags_count
            )
        )

    n_assoc = len(associates) or 1
    avg_aht = round(total_aht_sum / n_assoc, 1)
    avg_idle = round(total_idle_sum / n_assoc, 1)
    avg_eff = round(total_eff_sum / n_assoc, 1)

    return TeamOverviewOut(
        date=str(date.today()),
        total_associates=len(associates),
        active_associates_count=active_count,
        total_claims_completed=total_claims,
        team_aht_minutes=avg_aht,
        team_idle_percentage=avg_idle,
        team_efficiency_score=avg_eff,
        associates=assoc_items,
        active_alerts=active_alerts
    )


@router.get("/nva-summary", response_model=NVASummaryOut)
async def get_team_nva_summary(db: AsyncSession = Depends(get_db)):
    """Summary of Non-Value-Added activities across the team."""
    tl_res = await db.execute(select(ClaimTimeline))
    timelines = tl_res.scalars().all()

    counts = {
        "EXCEL_OVERUSE": 0,
        "APP_SWITCHING": 0,
        "LONG_IDLE": 0,
        "OUTLIER": 0,
        "REWORK": 0
    }
    lost_seconds = 0

    for t in timelines:
        flags = json.loads(t.nva_flags_json or "[]")
        for f in flags:
            if f in counts:
                counts[f] += 1
        
        # Calculate estimated NVA lost time: idle time + excessive Excel time
        lost_seconds += t.idle_duration_seconds
        breakdown = json.loads(t.app_breakdown_json or "{}")
        excel_sec = breakdown.get("Excel", 0)
        if excel_sec > 180:
            lost_seconds += int(excel_sec * 0.4)  # estimate 40% of excessive Excel as manual lookup waste

    lost_hours = round(lost_seconds / 3600.0, 1)
    top_cat = max(counts.items(), key=lambda x: x[1])[0] if timelines else "EXCEL_OVERUSE"

    return NVASummaryOut(
        date=str(date.today()),
        excel_overuse_claims_count=counts["EXCEL_OVERUSE"],
        app_switching_spikes_count=counts["APP_SWITCHING"],
        long_idle_incidents_count=counts["LONG_IDLE"],
        outlier_claims_count=counts["OUTLIER"],
        rework_claims_count=counts["REWORK"],
        total_nva_time_lost_hours=lost_hours,
        top_nva_category=top_cat,
        breakdown_by_category=counts
    )
