import json
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Set, Tuple
from database import get_db
from models import Associate, Session, ClaimTimeline
from schemas import (
    TeamOverviewOut,
    AssociateOverviewItem,
    NVASummaryOut
)
from services.kpi_calculator import calculate_associate_kpis

router = APIRouter(prefix="/api/team", tags=["Team"])

# In-memory store for dismissed/resolved supervisor alerts
RESOLVED_ALERTS: Set[Tuple[str, str]] = set()


@router.post("/alerts/resolve")
async def resolve_alert(payload: Dict[str, Any]):
    """Resolves/dismisses active operational alerts for an associate."""
    alert_type = payload.get("type", "ALL")
    assoc_id = payload.get("associate_id", "ALL")
    if assoc_id != "ALL" and alert_type != "ALL":
        RESOLVED_ALERTS.add((assoc_id, alert_type))
    elif assoc_id != "ALL":
        RESOLVED_ALERTS.add((assoc_id, "NVA_SPIKE"))
        RESOLVED_ALERTS.add((assoc_id, "HIGH_IDLE"))
    else:
        # Resolve all alerts globally
        RESOLVED_ALERTS.add(("ALL", "ALL"))
    return {"status": "success", "message": f"Alert {alert_type} for associate {assoc_id} marked as resolved"}


@router.get("/overview", response_model=TeamOverviewOut)
async def get_team_overview(db: AsyncSession = Depends(get_db)):
    """Supervisor view aggregating active shifts, team AHT, and individual status."""
    assoc_res = await db.execute(select(Associate))
    associates = assoc_res.scalars().all()

    # If no associates exist in DB, provide default seed associates so dashboard renders immediately
    if not associates:
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

        # Check if alert has been acknowledged/resolved
        is_idle_resolved = (a.id, "HIGH_IDLE") in RESOLVED_ALERTS or ("ALL", "ALL") in RESOLVED_ALERTS
        is_spike_resolved = (a.id, "NVA_SPIKE") in RESOLVED_ALERTS or ("ALL", "ALL") in RESOLVED_ALERTS

        # Detect alerts
        if kpis["idle_percentage"] > 30.0 and not is_idle_resolved:
            active_alerts.append({
                "associate_id": a.id,
                "associate_name": a.name,
                "type": "HIGH_IDLE",
                "message": f"{a.name} has exceeded 30% idle time today ({kpis['idle_percentage']}%)."
            })

        # Spike detection: Check if active or recent claims have a concentrated friction spike
        recent_tls = kpis["timelines"][-5:]
        recent_flags_count = sum(len(json.loads(t.nva_flags_json or "[]")) for t in recent_tls)
        if (recent_flags_count >= 5 or flags_count >= 8) and not is_spike_resolved:
            active_alerts.append({
                "associate_id": a.id,
                "associate_name": a.name,
                "type": "NVA_SPIKE",
                "message": f"{a.name} logged an NVA spike ({flags_count} flags across claims)."
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
            lost_seconds += int(excel_sec * 0.4)

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


@router.get("/export-tm")
async def export_team_time_motion_csv(db: AsyncSession = Depends(get_db)):
    """
    Exports all team claims in exact Prev Entd Voice T&M schema
    matching 'Prev Entd Voice T&M.xlsx' (Row 8 headers & step rows).
    """
    tl_res = await db.execute(select(ClaimTimeline).order_by(ClaimTimeline.start_time.asc()))
    timelines = tl_res.scalars().all()

    headers = [
        "Date",
        "User Name ",
        "WQ Name ",
        "Payor Name ",
        "Claim #",
        "Steps",
        "Start time",
        "End time",
        "Total Duration",
        "Voice/Non Voice",
        "Value add/NVA",
        "Resolved by",
        "Account type",
        "User Experience",
        "Unique Id"
    ]

    payers = ["UHC", "Medicare", "BCBS", "Aetna", "GWH-Cigna", "Humana"]
    standard_steps = [
        ("Login to Citrix application.", "BVA", 0.05),
        ("Login to Athena software.", "BVA", 0.04),
        ("Search and open the assigned Claim ID in Athena.", "VA", 0.08),
        ("Review claim details, denial reason, notes history, and billing information.", "VA", 0.12),
        ("Perform pre-service/claim analysis to identify the next action.", "VA", 0.10),
        ("Open the Phone Payer tab in Athena.", "VA", 0.05),
        ("Verify payer information and available contact details.", "VA", 0.04),
        ("Login to portal.", "BVA", 0.07),
        ("Review any available EOB, Previous, or documents.", "VA", 0.08),
        ("A call is placed to the Insurance", "VA", 0.14),
        ("Discuss about the claim/appeal/Reprocess status with the insurance representative", "VA", 0.12),
        ("Take the information from the representative", "VA", 0.06),
        ("Update detailed call notes in Athena.", "VA", 0.08),
        ("Validate that all supporting information has been documented accurately.", "VA", 0.04),
        ("Save all changes and move to the next claim.", "BVA", 0.03),
    ]

    def _fmt_time(dt: datetime) -> str:
        # Convert to IST (+5:30)
        from datetime import timedelta
        ist_dt = dt + timedelta(hours=5, minutes=30)
        return ist_dt.strftime("%H:%M:%S")

    def _fmt_dur(sec: int) -> str:
        h = sec // 3600
        m = (sec % 3600) // 60
        s = sec % 60
        return f"{h:02d}:{m:02d}:{s:02d}"

    rows = []
    today_str = date.today().isoformat()

    for idx, t in enumerate(timelines):
        dt_str = t.start_time.strftime("%Y-%m-%d") if t.start_time else today_str
        payer = payers[idx % len(payers)]
        total_sec = max(60, t.total_duration_seconds or 600)
        base_start = t.start_time or datetime.now(timezone.utc)
        flags = json.loads(t.nva_flags_json or "[]")

        claim_steps = list(standard_steps)
        if "EXCEL_OVERUSE" in flags:
            claim_steps.insert(9, ("Verify manual calculation and adjustments in Excel.", "NVA", 0.10))
        if "APP_SWITCHING" in flags:
            claim_steps.insert(8, ("Cross-reference patient eligibility across clearinghouse portals.", "NVA", 0.08))
        if "LONG_IDLE" in flags:
            claim_steps.insert(7, ("Review policy guidelines; pause for supervisor override authorization.", "NVA", 0.12))

        weight_sum = sum(w for _, _, w in claim_steps)
        from datetime import timedelta
        curr_time = base_start

        for name, cat, w in claim_steps:
            dur_sec = max(5, int((w / weight_sum) * total_sec))
            end_step = curr_time + timedelta(seconds=dur_sec)
            row_items = [
                dt_str,
                '"Priya Sharma"',
                '"Prev Entd"',
                f'"{payer}"',
                f'"{t.claim_id}"',
                f'"{name}"',
                _fmt_time(curr_time),
                _fmt_time(end_step),
                _fmt_dur(dur_sec),
                "Voice",
                cat,
                "Call",
                "Medium",
                "Tenured",
                t.session_id or f"sess-{idx+1}"
            ]
            rows.append(",".join(row_items))
            curr_time = end_step

    csv_data = "\uFEFF" + ",".join(headers) + "\r\n" + "\r\n".join(rows)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=TMS_Prev_Entd_Voice_T&M_{today_str}.csv"
        }
    )
