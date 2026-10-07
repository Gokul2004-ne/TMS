import asyncio
import os
import sys

# Ensure project root and backend are in sys.path
SCRATCH_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRATCH_DIR)
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

for p in [ROOT_DIR, BACKEND_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.database import get_session_maker
    from backend.services.kpi_calculator import calculate_associate_kpis
except ImportError:
    from database import get_session_maker  # type: ignore[no-redef]
    from services.kpi_calculator import calculate_associate_kpis  # type: ignore[no-redef]


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
