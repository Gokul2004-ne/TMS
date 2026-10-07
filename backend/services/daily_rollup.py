"""Daily Rollup Service for TMS Backend.

Aggregates completed claims for associates over a specific day to generate
persisted DailySummary records with throughput, AHT, idle ratios, and efficiency score.
"""

from datetime import datetime, date, time
from typing import Dict, Any, List, Optional
import json
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models import ClaimTimeline, DailySummary, Associate
from services.kpi_calculator import KPICalculator


class DailyRollupService:
    """Computes daily rollups from completed ClaimTimeline entries."""

    def __init__(self):
        self.kpi_calc = KPICalculator()

    async def compute_daily_summary(
        self,
        db: AsyncSession,
        associate_id: str,
        target_date: date
    ) -> Optional[DailySummary]:
        """Calculates and persists or updates the DailySummary for an associate on target_date."""
        start_dt = datetime.combine(target_date, time.min)
        end_dt = datetime.combine(target_date, time.max)
        date_str = target_date.strftime("%Y-%m-%d")

        # Query all claims completed or touched by this associate on this date
        stmt = select(ClaimTimeline).where(
            and_(
                ClaimTimeline.associate_id == associate_id,
                ClaimTimeline.end_time >= start_dt,
                ClaimTimeline.end_time <= end_dt
            )
        )
        result = await db.execute(stmt)
        claims: List[ClaimTimeline] = result.scalars().all()

        if not claims:
            return None

        total_claims = len(claims)
        total_active_sec = sum(c.active_duration_seconds or 0 for c in claims)
        total_idle_sec = sum(c.idle_duration_seconds or 0 for c in claims)
        total_duration_sec = total_active_sec + total_idle_sec

        # Average Handling Time in seconds
        avg_aht_sec = float(total_duration_sec / total_claims) if total_claims > 0 else 0.0

        # Count total NVA flags
        total_nva_flags = 0
        for c in claims:
            if c.nva_flags_json:
                try:
                    flags = json.loads(c.nva_flags_json)
                    total_nva_flags += len(flags)
                except Exception:
                    pass

        # Efficiency Score using KPICalculator logic
        efficiency_score = self.kpi_calc.calculate_efficiency_score(
            claims_count=total_claims,
            aht_minutes=avg_aht_sec / 60.0,
            idle_ratio=(total_idle_sec / total_duration_sec) if total_duration_sec > 0 else 0.0,
            nva_flags_count=total_nva_flags
        )

        # Check if record already exists for this date and associate
        check_stmt = select(DailySummary).where(
            and_(
                DailySummary.associate_id == associate_id,
                DailySummary.date == date_str
            )
        )
        existing_res = await db.execute(check_stmt)
        summary = existing_res.scalar_one_or_none()

        if summary is None:
            summary = DailySummary(
                associate_id=associate_id,
                date=date_str,
                total_claims_completed=total_claims,
                total_work_seconds=total_duration_sec,
                total_active_seconds=total_active_sec,
                total_idle_seconds=total_idle_sec,
                aht_seconds=avg_aht_sec,
                efficiency_score=efficiency_score
            )
            db.add(summary)
        else:
            summary.total_claims_completed = total_claims
            summary.total_work_seconds = total_duration_sec
            summary.total_active_seconds = total_active_sec
            summary.total_idle_seconds = total_idle_sec
            summary.aht_seconds = avg_aht_sec
            summary.efficiency_score = efficiency_score

        await db.commit()
        await db.refresh(summary)
        return summary

    async def rollup_all_associates(
        self,
        db: AsyncSession,
        target_date: date
    ) -> List[DailySummary]:
        """Runs daily rollup for all associates in the system."""
        assoc_stmt = select(Associate.id)
        res = await db.execute(assoc_stmt)
        associate_ids = res.scalars().all()

        summaries = []
        for a_id in associate_ids:
            s = await self.compute_daily_summary(db, a_id, target_date)
            if s:
                summaries.append(s)
        return summaries

