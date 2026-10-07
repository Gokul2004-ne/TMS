import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from database import get_session_maker
from services.kpi_calculator import calculate_associate_kpis

async def main():
    sm = get_session_maker()
    async with sm() as db:
        k = await calculate_associate_kpis(db, "EMP101")
        print("Associate name:", k["associate_name"])
        print("Completed claims:", k["completed_claims_count"])
        print("Target claims:", k["target_claims"])
        print("AHT minutes:", k["aht_minutes"])
        print("Idle percentage:", k["idle_percentage"])
        print("Efficiency score:", k["efficiency_score"])
        print("Active claim ID:", k["active_claim_id"])
        print("App distribution:", k["app_distribution"])
        print("Recent claims count:", len(k["timelines"]))

if __name__ == "__main__":
    asyncio.run(main())
