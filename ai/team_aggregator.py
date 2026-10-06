from datetime import date
from typing import List, Dict, Any


class TeamAggregator:
    """Aggregates batch analyzed claim timelines into team-level NVA summaries."""

    def aggregate(self, enriched_claims: List[Dict[str, Any]]) -> Dict[str, Any]:
        counts = {
            "EXCEL_OVERUSE": 0,
            "APP_SWITCHING": 0,
            "LONG_IDLE": 0,
            "OUTLIER": 0,
            "REWORK": 0
        }

        total_lost_sec = 0

        for c in enriched_claims:
            flags = c.get("nva_flags", [])
            for f in flags:
                if f in counts:
                    counts[f] += 1

            # Lost time estimation:
            # 1. Direct idle time
            idle_sec = c.get("idle_duration_seconds", 0)
            total_lost_sec += idle_sec

            # 2. Wasteful Excel lookup time (estimate 40% of Excel time if flagged)
            if "EXCEL_OVERUSE" in flags:
                excel_sec = c.get("app_breakdown", {}).get("Excel", 0)
                total_lost_sec += int(excel_sec * 0.40)

            # 3. Context switching penalty (5 seconds per switch over threshold)
            switches = c.get("app_switches_count", 0)
            if switches > 8:
                total_lost_sec += (switches - 8) * 5

        lost_hours = round(total_lost_sec / 3600.0, 1)
        top_cat = max(counts.items(), key=lambda x: x[1])[0] if any(counts.values()) else "EXCEL_OVERUSE"

        return {
            "date": str(date.today()),
            "total_analyzed_claims": len(enriched_claims),
            "excel_overuse_claims_count": counts["EXCEL_OVERUSE"],
            "app_switching_spikes_count": counts["APP_SWITCHING"],
            "long_idle_incidents_count": counts["LONG_IDLE"],
            "outlier_claims_count": counts["OUTLIER"],
            "rework_claims_count": counts["REWORK"],
            "total_nva_time_lost_hours": lost_hours,
            "top_nva_category": top_cat,
            "breakdown_by_category": counts
        }
