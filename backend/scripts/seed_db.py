"""Database Seed Script for TMS Platform.

Populates SQLite / PostgreSQL with:
- 4 realistic Associates
- Active & Historical Sessions
- 60 realistic ClaimTimelines with event-level distributions & NVA flags
- Raw Events for timeline visualization
- 5-day historical DailySummary rollups
"""

import os
import sys
import json
import random
import asyncio
from datetime import datetime, timedelta, date, time

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db, get_session_maker, get_engine
from models import Associate, Session, Event, ClaimTimeline, DailySummary
from services.daily_rollup import DailyRollupService


ASSOCIATES_DATA = [
    {
        "id": "EMP101",
        "name": "Priya Sharma",
        "email": "priya.sharma@tms-health.corp",
        "role": "ASSOCIATE",
        "target_daily_claims": 40
    },
    {
        "id": "EMP102",
        "name": "Marcus Vance",
        "email": "marcus.vance@tms-health.corp",
        "role": "ASSOCIATE",
        "target_daily_claims": 35
    },
    {
        "id": "EMP103",
        "name": "Elena Rostova",
        "email": "elena.rostova@tms-health.corp",
        "role": "ASSOCIATE",
        "target_daily_claims": 30
    },
    {
        "id": "EMP104",
        "name": "David Kim",
        "email": "david.kim@tms-health.corp",
        "role": "ASSOCIATE",
        "target_daily_claims": 45
    }
]

APP_PROFILES = [
    "ClaimPlatform",
    "Excel",
    "Chrome",
    "Outlook",
    "InternalPortal"
]


def generate_claim_scenario(index: int, associate_id: str, claim_id: str, start_dt: datetime):
    """Generates realistic duration, app breakdown, switches, and NVA flags based on index."""
    # Deterministic scenarios based on index
    scenario_type = index % 6

    if scenario_type == 0:
        # Standard Clean Adjudication
        duration = random.randint(240, 380)
        idle = random.randint(10, 45)
        active = duration - idle
        switches = random.randint(2, 5)
        breakdown = {
            "ClaimPlatform": round(active * 0.75),
            "Chrome": round(active * 0.15),
            "Outlook": round(active * 0.10)
        }
        flags = []
        status = "COMPLETED"

    elif scenario_type == 1:
        # Excel Overuse (Calculation / copy-paste bottleneck)
        duration = random.randint(420, 650)
        idle = random.randint(20, 50)
        active = duration - idle
        switches = random.randint(4, 7)
        excel_sec = round(active * 0.55)  # > 40%
        platform_sec = active - excel_sec
        breakdown = {
            "Excel": excel_sec,
            "ClaimPlatform": platform_sec,
            "Outlook": 15
        }
        flags = ["EXCEL_OVERUSE"]
        status = "COMPLETED"

    elif scenario_type == 2:
        # High App Switching (Scattered reference lookups)
        duration = random.randint(400, 700)
        idle = random.randint(30, 80)
        active = duration - idle
        switches = random.randint(9, 14)  # >= 8 switches
        breakdown = {
            "ClaimPlatform": round(active * 0.40),
            "Chrome": round(active * 0.25),
            "Excel": round(active * 0.20),
            "InternalPortal": round(active * 0.10),
            "Outlook": round(active * 0.05)
        }
        flags = ["APP_SWITCHING"]
        status = "COMPLETED"

    elif scenario_type == 3:
        # Long Inactivity / Distraction
        duration = random.randint(500, 850)
        idle = random.randint(190, 320)  # >= 180s idle
        active = duration - idle
        switches = random.randint(3, 6)
        breakdown = {
            "ClaimPlatform": round(active * 0.60),
            "Chrome": round(active * 0.30),
            "Outlook": round(active * 0.10)
        }
        flags = ["LONG_IDLE"]
        status = "COMPLETED"

    elif scenario_type == 4:
        # Outlier Duration (Complex adjudication or stalled inquiry)
        duration = random.randint(1250, 1500)  # >= 1200s
        idle = random.randint(100, 220)
        active = duration - idle
        switches = random.randint(10, 16)
        breakdown = {
            "ClaimPlatform": round(active * 0.45),
            "Chrome": round(active * 0.30),
            "Excel": round(active * 0.15),
            "Outlook": round(active * 0.10)
        }
        flags = ["OUTLIER", "APP_SWITCHING"]
        if idle >= 180:
            flags.append("LONG_IDLE")
        status = "COMPLETED"

    else:
        # Rework / Multi-touch Claim
        duration = random.randint(350, 550)
        idle = random.randint(20, 60)
        active = duration - idle
        switches = random.randint(5, 8)
        breakdown = {
            "ClaimPlatform": round(active * 0.60),
            "Chrome": round(active * 0.25),
            "Outlook": round(active * 0.15)
        }
        flags = ["REWORK"]
        status = "REWORK"

    end_dt = start_dt + timedelta(seconds=duration)
    return {
        "duration": duration,
        "active": active,
        "idle": idle,
        "switches": switches,
        "breakdown": breakdown,
        "flags": flags,
        "status": status,
        "end_dt": end_dt
    }


async def seed():
    print("==================================================")
    print("  TMS DATABASE SEEDER (Day-0 Realistic Population)")
    print("==================================================")
    print("-> Initializing Database schema...")
    await init_db()

    session_maker = get_session_maker()
    async with session_maker() as db:
        # 1. Seed Associates
        print("-> Seeding 4 Associates...")
        for a_data in ASSOCIATES_DATA:
            assoc = await db.get(Associate, a_data["id"])
            if not assoc:
                assoc = Associate(
                    id=a_data["id"],
                    name=a_data["name"],
                    email=a_data["email"],
                    role=a_data["role"],
                    target_daily_claims=a_data["target_daily_claims"],
                    created_at=datetime.utcnow() - timedelta(days=30)
                )
                db.add(assoc)
            else:
                assoc.name = a_data["name"]
                assoc.email = a_data["email"]
                assoc.target_daily_claims = a_data["target_daily_claims"]
        await db.commit()

        # 2. Seed 5 days of Sessions, Claims, and Events
        today = date.today()
        base_claim_number = 1001
        total_claims_created = 0
        total_events_created = 0

        # Mapping of claims count per associate
        assoc_distribution = [
            ("EMP101", 25),
            ("EMP102", 15),
            ("EMP103", 10),
            ("EMP104", 10)
        ]

        for assoc_id, claims_quota in assoc_distribution:
            print(f"-> Generating {claims_quota} claims for Associate {assoc_id}...")
            # Distribute claims over the past 4 days plus today
            claims_per_day = max(1, claims_quota // 5)
            created_for_assoc = 0

            for day_offset in range(4, -1, -1):
                target_day = today - timedelta(days=day_offset)
                session_start = datetime.combine(target_day, time(9, 0, 0))
                session_id = f"sess-{assoc_id}-{target_day.strftime('%Y%m%d')}"

                # Ensure Session exists
                existing_sess = await db.get(Session, session_id)
                if not existing_sess:
                    sess = Session(
                        id=session_id,
                        associate_id=assoc_id,
                        start_time=session_start,
                        end_time=session_start + timedelta(hours=8),
                        total_duration_seconds=28800,
                        is_active=(day_offset == 0)
                    )
                    db.add(sess)
                    await db.flush()

                # Generate day's claims
                num_claims_today = claims_per_day if day_offset > 0 else (claims_quota - created_for_assoc)
                current_time = session_start + timedelta(minutes=15)

                for _ in range(num_claims_today):
                    claim_id = f"CLM{base_claim_number}"
                    base_claim_number += 1
                    total_claims_created += 1
                    created_for_assoc += 1

                    scenario = generate_claim_scenario(
                        index=total_claims_created,
                        associate_id=assoc_id,
                        claim_id=claim_id,
                        start_dt=current_time
                    )

                    timeline = ClaimTimeline(
                        claim_id=claim_id,
                        session_id=session_id,
                        associate_id=assoc_id,
                        start_time=current_time,
                        end_time=scenario["end_dt"],
                        total_duration_seconds=scenario["duration"],
                        active_duration_seconds=scenario["active"],
                        idle_duration_seconds=scenario["idle"],
                        app_switches_count=scenario["switches"],
                        app_breakdown_json=json.dumps(scenario["breakdown"]),
                        status=scenario["status"],
                        nva_flags_json=json.dumps(scenario["flags"])
                    )
                    db.add(timeline)

                    # Generate realistic discrete events for this claim
                    # 1. CLAIM_DETECTED event
                    e_detect = Event(
                        session_id=session_id,
                        associate_id=assoc_id,
                        claim_id=claim_id,
                        event_type="CLAIM_DETECTED",
                        app_name="ClaimPlatform",
                        window_title=f"Claim Adjudication - {claim_id}",
                        timestamp=current_time,
                        is_idle=False,
                        agent_version="1.0.0"
                    )
                    db.add(e_detect)
                    total_events_created += 1

                    # 2. App switches
                    t_cursor = current_time + timedelta(seconds=random.randint(30, 60))
                    for app_name, sec in scenario["breakdown"].items():
                        e_switch = Event(
                            session_id=session_id,
                            associate_id=assoc_id,
                            claim_id=claim_id,
                            event_type="APP_SWITCH",
                            app_name=app_name,
                            window_title=f"{app_name} - Working on {claim_id}",
                            timestamp=t_cursor,
                            is_idle=False,
                            agent_version="1.0.0"
                        )
                        db.add(e_switch)
                        total_events_created += 1
                        t_cursor += timedelta(seconds=min(sec, 120))

                    # 3. Idle event if idle flagged
                    if scenario["idle"] >= 180:
                        e_idle = Event(
                            session_id=session_id,
                            associate_id=assoc_id,
                            claim_id=claim_id,
                            event_type="IDLE_START",
                            app_name="Desktop",
                            window_title="Inactivity Detected",
                            timestamp=current_time + timedelta(seconds=scenario["active"]),
                            is_idle=True,
                            agent_version="1.0.0"
                        )
                        db.add(e_idle)
                        total_events_created += 1

                    # Advance cursor with a short break
                    current_time = scenario["end_dt"] + timedelta(seconds=random.randint(60, 240))

                await db.commit()

        # 3. Compute and persist DailySummaries using DailyRollupService
        print("-> Computing DailySummaries for past 5 days...")
        rollup_service = DailyRollupService()
        for day_offset in range(4, -1, -1):
            target_day = today - timedelta(days=day_offset)
            summaries = await rollup_service.rollup_all_associates(db, target_day)
            print(f"   Rollup {target_day.strftime('%Y-%m-%d')}: {len(summaries)} associate summaries computed.")

    print("==================================================")
    print("SUCCESS: DATABASE SEED COMPLETE!")
    print(f"- Associates: {len(ASSOCIATES_DATA)}")
    print(f"- Total Claims Seeded: {total_claims_created}")
    print(f"- Total Events Seeded: {total_events_created}")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(seed())
