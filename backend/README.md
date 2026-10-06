# Backend API and Database Engine (`backend/`)

**High-Throughput Telemetry Ingestion, Timeline Reconstruction, and KPI Analytics**  
*Lead Engineer: Member 2 (Backend & Database Engineer)*

---

## 1. Module Overview and Responsibility

The backend microservice is built with **FastAPI** and **SQLAlchemy 2.0 (Async)**. It serves as the data nervous system of TMS, handling high-volume telemetry ingestion from desktop agents, reconstructing raw app visits into coherent claim timelines, and computing operational performance metrics.

### Key Operational Goals
1. **High Ingestion Throughput**: Safely accepts multi-event bulk batches (`POST /api/events`) without locking the database.
2. **Timeline Slicing & Synthesis**: Groups raw sequential window focus events into consolidated `ClaimTimeline` records with application breakdown percentages.
3. **KPI Precision**: Calculates real-time Average Handling Time (AHT), Idle Time Ratios, and composite Associate Efficiency Scores.

---

## 2. Module Architecture and Flow

### Router-to-Service Architecture

```mermaid
flowchart TD
    subgraph IngressClients ["Callers"]
        Agent["Desktop Agent (Member 1)"]
        Dashboard["Web Dashboard (Member 4)"]
        AIService["AI Service (Member 3)"]
    end

    subgraph FastAPILayer ["FastAPI Router Controllers (backend/routes/)"]
        R_Events["events.py<br/>POST /api/events"]
        R_Sessions["sessions.py<br/>POST /api/sessions/start, /end"]
        R_Associate["associate.py<br/>GET /api/associate/{id}/today<br/>GET /api/associate/{id}/claims"]
        R_Team["team.py<br/>GET /api/team/overview<br/>GET /api/team/nva-summary"]
        R_AI["ai_proxy.py<br/>GET /api/insights"]
    end

    subgraph LogicServices ["Domain Services (backend/services/)"]
        TL_Builder["TimelineBuilder Service<br/>- Event time-slicing<br/>- Active vs. Idle durations<br/>- app_breakdown_json synthesis<br/>- NVA heuristic flags"]
        KPI_Calc["KPICalculator Service<br/>- AHT (minutes)<br/>- Idle Percentage (%)<br/>- Composite Efficiency (0-100)<br/>- Operational alerts"]
    end

    subgraph ORMLayer ["SQLAlchemy Models (backend/models.py)"]
        M_Associate[("Associate")]
        M_Session[("Session")]
        M_Event[("Event")]
        M_Timeline[("ClaimTimeline")]
        M_Summary[("DailySummary")]
    end

    subgraph DatabaseStore ["PostgreSQL 15 / SQLite Database"]
        DB[(tms_db)]
    end

    Agent -->|"Bulk Ingest"| R_Events
    Dashboard -->|"Shift Telemetry"| R_Associate
    Dashboard -->|"Team Overview"| R_Team
    Dashboard -->|"Recommendations"| R_AI

    R_Events --> TL_Builder
    R_Associate --> KPI_Calc
    R_Team --> KPI_Calc

    TL_Builder --> M_Timeline
    TL_Builder --> M_Event
    KPI_Calc --> M_Timeline

    M_Associate --> DB
    M_Session --> DB
    M_Event --> DB
    M_Timeline --> DB
    M_Summary --> DB

    R_AI -.->|"HTTP GET /ai/insights"| AIService
```

### Relational Database Schema (ERD)

```mermaid
erDiagram
    ASSOCIATE ||--o{ SESSION : has
    ASSOCIATE ||--o{ EVENT : generates
    ASSOCIATE ||--o{ CLAIM_TIMELINE : works_on
    ASSOCIATE ||--o{ DAILY_SUMMARY : receives

    SESSION ||--o{ EVENT : contains
    SESSION ||--o{ CLAIM_TIMELINE : spans

    ASSOCIATE {
        string id PK "e.g. EMP101"
        string name
        string email
        string role "ASSOCIATE / SUPERVISOR"
        int target_daily_claims "Default: 40"
        datetime created_at
    }

    SESSION {
        string id PK "UUID / sess-..."
        string associate_id FK
        datetime start_time
        datetime end_time
        int total_duration_seconds
        boolean is_active
    }

    EVENT {
        int id PK "Autoincrement"
        string session_id FK
        string associate_id FK
        string claim_id "Indexed"
        string event_type "APP_SWITCH / IDLE_START / etc."
        string app_name
        string window_title
        datetime timestamp "Indexed"
        boolean is_idle
        string agent_version
    }

    CLAIM_TIMELINE {
        int id PK "Autoincrement"
        string claim_id "Indexed"
        string session_id FK
        string associate_id FK
        datetime start_time
        datetime end_time
        int total_duration_seconds
        int active_duration_seconds
        int idle_duration_seconds
        int app_switches_count
        string app_breakdown_json "e.g. {'Excel': 140, 'Chrome': 320}"
        string status "IN_PROGRESS / COMPLETED / REWORK"
        string nva_flags_json "e.g. ['EXCEL_OVERUSE', 'APP_SWITCHING']"
    }

    DAILY_SUMMARY {
        int id PK "Autoincrement"
        string associate_id FK
        string date "Indexed (YYYY-MM-DD)"
        int total_claims_completed
        int total_work_seconds
        int total_active_seconds
        int total_idle_seconds
        float aht_seconds
        float efficiency_score
    }
```

---

## 3. Implemented Inventory

| File | Component / Route | Current Responsibility |
| :--- | :--- | :--- |
| [`database.py`](file:///b:/Projects/TMS/backend/database.py) | Database Setup | Async SQLAlchemy configuration with lazy initialization. Seamlessly switches between SQLite (`sqlite+aiosqlite`) for zero-dependency local dev and PostgreSQL (`postgresql+asyncpg`) for production. |
| [`models.py`](file:///b:/Projects/TMS/backend/models.py) | ORM Models | Defines all 5 relational models with foreign keys and composite indexes (`idx_events_claim_time`, `idx_timeline_claim_associate`). |
| [`schemas.py`](file:///b:/Projects/TMS/backend/schemas.py) | Pydantic Schemas | Data validation models for all API requests and responses (`BulkEventsIn`, `AssociateTodayOut`, `TeamOverviewOut`, etc.). |
| [`services/timeline_builder.py`](file:///b:/Projects/TMS/backend/services/timeline_builder.py) | `TimelineBuilder` | Groups incoming events by claim context, updates timeline timestamps, calculates durations, and flags NVA rules. |
| [`services/kpi_calculator.py`](file:///b:/Projects/TMS/backend/services/kpi_calculator.py) | `KPICalculator` | Computes associate AHT, idle ratios, efficiency score, and aggregates application share breakdown. |
| [`routes/events.py`](file:///b:/Projects/TMS/backend/routes/events.py) | `POST /api/events` | High-throughput bulk event ingestion. Auto-creates associate and session records if they do not yet exist. |
| [`routes/sessions.py`](file:///b:/Projects/TMS/backend/routes/sessions.py) | `POST /api/sessions/start`, `/end` | Session lifecycle endpoints. |
| [`routes/associate.py`](file:///b:/Projects/TMS/backend/routes/associate.py) | `GET /api/associate/{id}/today` | Returns associate shift KPIs, active claim, app share, and recent claim items. |
| [`routes/team.py`](file:///b:/Projects/TMS/backend/routes/team.py) | `GET /api/team/overview`, `/nva-summary` | Aggregates active associates, team-wide AHT, alert triggers, and NVA category counts. |
| [`routes/ai_proxy.py`](file:///b:/Projects/TMS/backend/routes/ai_proxy.py) | `GET /api/insights` | Fetches insights from the AI microservice with automatic rule-based fallback when the AI engine is offline. |
| [`mock_responses/`](file:///b:/Projects/TMS/backend/mock_responses/) | Day-0 Static Mocks | 6 static JSON files matching exact endpoint responses for offline frontend development. |
| [`docker-compose.yml`](file:///b:/Projects/TMS/backend/docker-compose.yml) | Container Config | Runs PostgreSQL 15, FastAPI Backend, and AI Engine in unified Docker network. |
| [`main.py`](file:///b:/Projects/TMS/backend/main.py) | Application Entrypoint | Mounts CORS middleware, lifespan auto table creation, and root `/health` route. |

---

## 4. What to Implement Further

1. **Alembic Database Migrations (`backend/alembic/`)**:
   - Configure versioned schema migration tracking instead of relying on `Base.metadata.create_all()`.
2. **Realistic Historical Seeder Script (`backend/scripts/seed_db.py`)**:
   - Seed 4 associates (`EMP101`–`EMP104`) and 60 realistic historical claims matching data from `Project_Requirements/Prev Entd Voice T&M.xlsx`.
3. **Daily Summary Aggregation Background Job (`backend/services/daily_rollup.py`)**:
   - Nightly rollup job that aggregates completed `ClaimTimeline` entries into `DailySummary` rows.
4. **Session Watchdog (Auto-Timeout)**:
   - Mark sessions as `is_active = False` if no agent telemetry is received for > 15 minutes.
5. **Automated Integration Test Suite (`backend/tests/test_api.py`)**:
   - Pytest tests covering event ingestion, duration math, and KPI rollups.

---

## 5. How to Implement

### Step 1: Setting Up Alembic Migrations
```bash
cd backend
pip install alembic
alembic init alembic
```
In `alembic/env.py`, set:
```python
from models import Base
target_metadata = Base.metadata
```
Generate and apply migration:
```bash
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

### Step 2: Writing `backend/scripts/seed_db.py`
Create `backend/scripts/seed_db.py`:
```python
import asyncio
from datetime import datetime, timedelta
import json
from database import get_session_maker, init_db
from models import Associate, Session, ClaimTimeline

async def seed():
    await init_db()
    session_maker = get_session_maker()
    async with session_maker() as db:
        # Seed 4 associates
        associates = [
            Associate(id="EMP101", name="Priya Sharma", email="priya@company.com"),
            Associate(id="EMP102", name="Rahul Verma", email="rahul@company.com"),
            Associate(id="EMP103", name="Ananya Iyer", email="ananya@company.com"),
            Associate(id="EMP104", name="Karthik Raja", email="karthik@company.com"),
        ]
        for a in associates:
            db.add(a)
        await db.commit()

        # Seed historical claims
        base_time = datetime.utcnow() - timedelta(hours=6)
        claims = [
            ("CLM1025", 600, 580, 20, 5, {"ClaimPlatform": 350, "Chrome": 230}, []),
            ("CLM1026", 900, 750, 150, 12, {"ClaimPlatform": 310, "Excel": 390}, ["EXCEL_OVERUSE", "APP_SWITCHING"]),
            ("CLM1027", 430, 410, 20, 4, {"ClaimPlatform": 260, "Chrome": 150}, []),
        ]
        for cid, tot, act, idle, sw, bdown, flags in claims:
            tl = ClaimTimeline(
                claim_id=cid,
                associate_id="EMP101",
                session_id="sess-seed-001",
                start_time=base_time,
                end_time=base_time + timedelta(seconds=tot),
                total_duration_seconds=tot,
                active_duration_seconds=act,
                idle_duration_seconds=idle,
                app_switches_count=sw,
                app_breakdown_json=json.dumps(bdown),
                status="COMPLETED",
                nva_flags_json=json.dumps(flags)
            )
            db.add(tl)
            base_time += timedelta(seconds=tot + 60)
        await db.commit()
        print("Database seeded successfully with historical claims.")

if __name__ == "__main__":
    asyncio.run(seed())
```

### Step 3: Implementing Daily Rollup Service (`backend/services/daily_rollup.py`)
```python
from datetime import date
from sqlalchemy import select, func
from models import ClaimTimeline, DailySummary

async def run_daily_rollup(db, target_date: str):
    """Aggregates completed claims for a date and writes to daily_summaries."""
    stmt = select(ClaimTimeline).where(ClaimTimeline.status == "COMPLETED")
    res = await db.execute(stmt)
    timelines = res.scalars().all()

    total_claims = len(timelines)
    total_work = sum(t.total_duration_seconds for t in timelines)
    total_active = sum(t.active_duration_seconds for t in timelines)
    total_idle = sum(t.idle_duration_seconds for t in timelines)
    aht = round((total_work / total_claims) / 60.0, 1) if total_claims else 0.0

    summary = DailySummary(
        associate_id="EMP101",
        date=target_date,
        total_claims_completed=total_claims,
        total_work_seconds=total_work,
        total_active_seconds=total_active,
        total_idle_seconds=total_idle,
        aht_seconds=aht * 60.0,
        efficiency_score=85.0
    )
    db.add(summary)
    await db.commit()
```

---

## 6. How to Run and Test

```bash
cd backend
pip install -r requirements.txt

# Run with SQLite (instant local dev)
uvicorn main:app --reload --port 8000

# Or run with Docker Compose (PostgreSQL)
docker-compose up -d
```
- Swagger API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
