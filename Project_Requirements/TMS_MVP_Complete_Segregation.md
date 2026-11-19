# TMS — Complete MVP Work Segregation Plan
### AI-Powered Transaction Intelligence Platform · 4 Members · Full Parallel Execution

---

## 📐 Non-Negotiable Day-0 Agreement (ALL 4 MEMBERS — 1 HOUR SYNC)

Before anyone writes a single line of code, all 4 members agree on these contracts.
Once signed off, all 4 work **fully in parallel with zero blockers**.

### ✅ Shared Event Schema (the backbone of the entire system)

```json
{
  "associate_id":  "EMP123",
  "session_id":    "sess-abc-001",
  "claim_id":      "CLM1003",
  "event_type":    "APP_SWITCH",
  "app_name":      "Excel",
  "window_title":  "Tracker.xlsx - Microsoft Excel",
  "timestamp":     "2026-10-06T09:11:00Z",
  "is_idle":       false,
  "agent_version": "1.0.0"
}
```

**event_type values (agreed):**
`SESSION_START` | `SESSION_END` | `APP_SWITCH` | `IDLE_START` | `IDLE_END` | `CLAIM_SET` | `CLAIM_SWITCH` | `CLAIM_CLOSE`

**app_name values (agreed):**
`"Claim Platform"` | `"Payer Portal"` | `"Excel"` | `"Outlook"` | `"Chrome"` | `"Other"`

### ✅ Agreed Process-to-Executable Map

```
EXCEL.EXE       → "Excel"
chrome.exe      → "Chrome"
msedge.exe      → "Chrome"
OUTLOOK.EXE     → "Outlook"
ClaimApp.exe    → "Claim Platform"
PayerPortal.exe → "Payer Portal"
*               → "Other"
```

### ✅ Mock Data Protocol
- **Member 2** creates `backend/mock_responses/` (static JSON for every GET endpoint) → **delivered Day 1**
- **Member 3** creates `ai/mock_insights.json` + `ai/sample_timelines.json` → **delivered Day 1**
- **Member 4** uses `USE_MOCK = true` flag and builds entire UI against mocks
- **Member 1** uses their own `mock_backend.py` (local Flask stub)

---

## 📁 Full Monorepo Folder Structure

```
TMS-MVP/
│
├── shared/
│   ├── event-schema.json              ← Agreed Day-0 schema
│   └── app-map.json                   ← Process → AppName mapping
│
├── agent/                             ← MEMBER 1
│   ├── main.py
│   ├── tracker.py
│   ├── claim_context.py
│   ├── dialog.py
│   ├── emitter.py
│   ├── idle_monitor.py
│   ├── tray.py
│   ├── config.json
│   ├── mock_backend.py
│   ├── requirements.txt
│   └── build.spec                     ← PyInstaller spec
│
├── backend/                           ← MEMBER 2
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── events.py
│   │   ├── sessions.py
│   │   ├── associate.py
│   │   └── team.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── timeline_builder.py
│   │   └── kpi_calculator.py
│   ├── mock_responses/
│   │   ├── today.json
│   │   ├── claims.json
│   │   ├── claim_detail.json
│   │   ├── team_overview.json
│   │   ├── nva_summary.json
│   │   └── insights.json
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env.example
│   └── docker-compose.yml
│
├── ai/                                ← MEMBER 3
│   ├── main.py
│   ├── nva_engine.py
│   ├── team_aggregator.py
│   ├── gemini_insights.py
│   ├── sample_timelines.json
│   ├── mock_insights.json
│   ├── requirements.txt
│   └── Dockerfile
│
└── dashboard/                         ← MEMBER 4
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── config.ts
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── api/
        │   ├── types.ts
        │   ├── client.ts
        │   └── mock.ts
        ├── components/
        │   ├── Sidebar.tsx
        │   ├── Header.tsx
        │   ├── ActiveClaimCard.tsx
        │   ├── DailySummaryBar.tsx
        │   ├── ClaimGanttChart.tsx
        │   ├── ClaimDetailBreakdown.tsx
        │   ├── AppPieChart.tsx
        │   ├── TeamTable.tsx
        │   ├── NVALeaderboard.tsx
        │   ├── InsightCard.tsx
        │   └── LoadingSkeleton.tsx
        └── pages/
            ├── Associate.tsx
            ├── Team.tsx
            └── Insights.tsx
```

---

---

# 👤 MEMBER 1 — Windows Desktop Agent

**Role**: Desktop Intelligence / Systems Engineer
**Stack**: Python 3.11, `psutil`, `pygetwindow`, `pynput`, `tkinter`, `pystray`, `Pillow`, `requests`, `PyInstaller`

---

## Files to Build

### `agent/requirements.txt`

```
psutil==5.9.8
pygetwindow==0.0.9
pynput==1.7.6
pystray==0.19.5
Pillow==10.3.0
requests==2.31.0
pyinstaller==6.6.0
```

---

### `agent/config.json`

```json
{
  "associate_id": "EMP001",
  "associate_name": "John Smith",
  "api_base_url": "http://localhost:8000",
  "ai_base_url": "http://localhost:8001",
  "poll_interval_seconds": 3,
  "idle_threshold_seconds": 120,
  "batch_emit_seconds": 10,
  "claim_id_regex": "CLM\\d+",
  "app_map": {
    "EXCEL.EXE":        "Excel",
    "chrome.exe":       "Chrome",
    "msedge.exe":       "Chrome",
    "OUTLOOK.EXE":      "Outlook",
    "ClaimApp.exe":     "Claim Platform",
    "PayerPortal.exe":  "Payer Portal"
  },
  "claim_platform_apps": ["Claim Platform", "Chrome"],
  "local_queue_path": "event_queue.jsonl"
}
```

---

### `agent/tracker.py`

**Purpose**: Poll the foreground window every N seconds, detect app switches

**Functions to implement:**

```python
class WindowTracker:
    def __init__(self, config: dict)
    def get_active_window(self) -> dict:
        # Returns: { process_name, window_title, app_name }
        # Uses: psutil.Process(pid).name() + pygetwindow.getActiveWindow()
    def resolve_app_name(self, process_name: str) -> str:
        # Maps process name → friendly app name using config["app_map"]
        # Default: "Other"
    def has_switched(self, previous: dict, current: dict) -> bool:
        # True if app_name changed
    def start_polling(self, on_switch_callback: callable)
        # Loops every poll_interval_seconds
        # Calls on_switch_callback(previous, current) on app switch
```

---

### `agent/idle_monitor.py`

**Purpose**: Detect keyboard/mouse inactivity → emit IDLE_START / IDLE_END

**Functions to implement:**

```python
class IdleMonitor:
    def __init__(self, threshold_seconds: int, on_idle: callable, on_active: callable)
    def _on_activity(self, *args)
        # Reset last_activity_time = now()
        # If was_idle → call on_active(), set was_idle = False
    def _check_loop(self)
        # Every 10 seconds: if (now - last_activity) > threshold → call on_idle(), set was_idle = True
    def start(self)
        # pynput.keyboard.Listener + pynput.mouse.Listener
        # threading.Thread for _check_loop
    def stop(self)
```

---

### `agent/claim_context.py`

**Purpose**: Maintain the "Current Claim Context" state machine

**State machine:**
```
NONE → SET (CLAIM_SET event) → ACTIVE
ACTIVE → SWITCH (CLAIM_SWITCH event) → ACTIVE (new claim)
ACTIVE → CLOSED (CLAIM_CLOSE event) → NONE
```

**Functions to implement:**

```python
class ClaimContextManager:
    def __init__(self, config: dict, on_event: callable)

    def try_auto_detect(self, window_title: str) -> str | None:
        # Regex: re.search(config["claim_id_regex"], window_title)
        # Returns claim_id string or None

    def set_claim(self, claim_id: str, source: str = "auto")
        # If no current claim → emit CLAIM_SET
        # If different claim → emit CLAIM_SWITCH (pauses old, starts new)
        # Updates self.current_claim_id

    def close_claim(self)
        # Emit CLAIM_CLOSE for current claim
        # Sets current_claim_id = None

    def on_app_switched(self, previous: dict, current: dict)
        # Called by tracker on every APP_SWITCH
        # If new app is in claim_platform_apps:
        #     try_auto_detect(window_title)
        #     If detected → set_claim()
        #     If NOT detected AND no current claim → trigger dialog

    def get_current_claim(self) -> str | None

    @property
    def recent_claims(self) -> list[str]
        # Last 10 claim IDs seen in this session
```

---

### `agent/dialog.py`

**Purpose**: Tkinter popup dialog — "Which claim are you working on?"

**Functions to implement:**

```python
class ClaimDialog:
    def __init__(self, recent_claims: list[str], on_confirm: callable, on_skip: callable)

    def show(self)
        # tkinter.Toplevel window — always on top
        # Title: "Claim Work Assistant"
        # Label: "A claim platform is open.\nWhich claim are you working on?"
        # Dropdown (ttk.Combobox): recent_claims list
        # Text entry: for new claim ID manual entry
        # Buttons:
        #   "Continue with Existing" → on_confirm(selected_claim_id)
        #   "New Claim"              → on_confirm(text_entry_value)
        #   "Skip"                   → on_skip()
        # Window: 380×240px, centered on screen, topmost=True

    def _on_confirm(self)
    def _on_skip(self)
    def destroy(self)
```

---

### `agent/emitter.py`

**Purpose**: Batch event queue → POST to backend API with local fallback

**Functions to implement:**

```python
class EventEmitter:
    def __init__(self, config: dict)

    def enqueue(self, event: dict)
        # Appends to self._queue (thread-safe list)

    def _build_event(self, event_type: str, **kwargs) -> dict
        # Builds full event dict with associate_id, session_id, timestamp, agent_version
        # Merges kwargs (claim_id, app_name, window_title, is_idle)

    def emit_now(self, event_type: str, **kwargs)
        # Build event → enqueue immediately → attempt flush

    def _flush_loop(self)
        # Every batch_emit_seconds:
        #   Drain self._queue → POST /api/events (array payload)
        #   On success → done
        #   On failure → write to local_queue_path (.jsonl file)

    def _retry_local_queue(self)
        # On successful flush: read local_queue_path, POST those too, clear file

    def start(self)
        # threading.Thread for _flush_loop

    def stop(self)
        # Final flush before shutdown
```

---

### `agent/tray.py`

**Purpose**: System tray icon with status tooltip and right-click menu

**Functions to implement:**

```python
class TrayIcon:
    def __init__(self, on_quit: callable)

    def create_icon_image(self, color: str) -> Image
        # PIL: draw a small 64×64 circle (green=active, grey=idle, red=error)

    def update_tooltip(self, claim_id: str | None, app_name: str | None)
        # "TMS Agent — Tracking CLM1003 · Payer Portal"
        # "TMS Agent — No active claim"

    def update_status(self, status: str)
        # "active" | "idle" | "error" — changes icon color

    def start(self)
        # pystray.Icon with menu:
        #   "TMS Agent v1.0"  (title, disabled)
        #   "Current: CLM1003" (dynamic)
        #   separator
        #   "Quit" → on_quit()

    def stop(self)
```

---

### `agent/main.py`

**Purpose**: Entry point — wires all components together

**What it does (step by step):**

```
1. Load config.json
2. Start EventEmitter (background flush thread)
3. Emit SESSION_START
4. Start TrayIcon
5. Start IdleMonitor
   → on_idle:   emitter.emit_now("IDLE_START"); tray.update_status("idle")
   → on_active: emitter.emit_now("IDLE_END");   tray.update_status("active")
6. Start WindowTracker.start_polling(on_switch_callback)
   → on_switch_callback:
       a. emitter.emit_now("APP_SWITCH", app_name=current.app_name, window_title=current.window_title)
       b. claim_context.on_app_switched(previous, current)
       c. tray.update_tooltip(claim_context.get_current_claim(), current.app_name)
7. ClaimContextManager.on_event → emitter.emit_now(event_type, claim_id=..., ...)
8. On tray "Quit" / SIGTERM:
   → emitter.emit_now("SESSION_END")
   → emitter.stop()  ← final flush
   → tray.stop()
```

---

### `agent/mock_backend.py`

**Purpose**: Local Flask stub server — used only for self-testing without Member 2's backend

```python
# 25-line Flask server
# POST /api/events        → prints received events, returns {"status": "ok"}
# POST /api/sessions/start → returns {"session_id": "mock-sess-001"}
# POST /api/sessions/end   → returns {"status": "ok"}
# GET  /health             → returns {"status": "healthy"}
# Run on port 8000
```

---

### `agent/build.spec`

- PyInstaller spec to build single `.exe`
- Bundles: `config.json`, `shared/app-map.json`
- Output: `dist/TMS-Agent.exe`
- Windows startup registry key added via post-build script

---

### ✅ Member 1 — Complete Deliverables Checklist

- [ ] `requirements.txt`
- [ ] `config.json` (with app_map and all settings)
- [ ] `tracker.py` — `WindowTracker` class (poll + app switch detection)
- [ ] `idle_monitor.py` — `IdleMonitor` class (pynput + threshold check)
- [ ] `claim_context.py` — `ClaimContextManager` class (state machine + auto-detect + dialog trigger)
- [ ] `dialog.py` — `ClaimDialog` class (Tkinter popup, dropdown, new claim entry)
- [ ] `emitter.py` — `EventEmitter` class (queue + batch POST + local `.jsonl` fallback)
- [ ] `tray.py` — `TrayIcon` class (pystray + dynamic tooltip + color icon)
- [ ] `main.py` — wires all components, handles SESSION_START/END
- [ ] `mock_backend.py` — local Flask stub for self-testing
- [ ] `build.spec` — PyInstaller packaging config
- [ ] **End-to-end test**: Run agent → open apps → see events in mock backend console

---
---

# 👤 MEMBER 2 — Backend API + Database + KPI Engine

**Role**: Backend Engineer
**Stack**: Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 15, `uvicorn`, Docker

---

## Database Schema (5 Tables)

```sql
-- 1. Associates
CREATE TABLE associates (
    id            VARCHAR(50) PRIMARY KEY,          -- "EMP123"
    name          VARCHAR(100) NOT NULL,
    team          VARCHAR(100),
    process       VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Sessions
CREATE TABLE sessions (
    id                  VARCHAR(100) PRIMARY KEY,   -- "sess-abc-001"
    associate_id        VARCHAR(50) REFERENCES associates(id),
    started_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ,
    total_idle_seconds  INTEGER DEFAULT 0,
    agent_version       VARCHAR(20)
);

-- 3. Raw Events
CREATE TABLE events (
    id            SERIAL PRIMARY KEY,
    associate_id  VARCHAR(50) NOT NULL,
    session_id    VARCHAR(100) NOT NULL,
    claim_id      VARCHAR(50),                      -- nullable
    event_type    VARCHAR(30) NOT NULL,
    app_name      VARCHAR(50),
    window_title  VARCHAR(500),
    timestamp     TIMESTAMPTZ NOT NULL,
    is_idle       BOOLEAN DEFAULT FALSE,
    received_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_events_session   ON events(session_id);
CREATE INDEX idx_events_claim     ON events(claim_id);
CREATE INDEX idx_events_associate ON events(associate_id, timestamp);

-- 4. Claim Timelines (built from raw events)
CREATE TABLE claim_timelines (
    id              SERIAL PRIMARY KEY,
    claim_id        VARCHAR(50) NOT NULL,
    associate_id    VARCHAR(50) NOT NULL,
    session_id      VARCHAR(100) NOT NULL,
    app_name        VARCHAR(50) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    duration_seconds INTEGER,
    is_idle         BOOLEAN DEFAULT FALSE,
    nva_flags       TEXT[],                         -- filled by Member 3's AI engine
    nva_seconds     INTEGER DEFAULT 0
);
CREATE INDEX idx_timelines_claim     ON claim_timelines(claim_id);
CREATE INDEX idx_timelines_associate ON claim_timelines(associate_id, started_at);

-- 5. Daily Summary (pre-computed)
CREATE TABLE daily_summary (
    id                       SERIAL PRIMARY KEY,
    associate_id             VARCHAR(50) NOT NULL,
    date                     DATE NOT NULL,
    session_id               VARCHAR(100),
    total_claims             INTEGER DEFAULT 0,
    total_productive_seconds INTEGER DEFAULT 0,
    total_idle_seconds       INTEGER DEFAULT 0,
    total_nva_seconds        INTEGER DEFAULT 0,
    avg_claim_time_seconds   INTEGER DEFAULT 0,
    transactions_per_hour    FLOAT DEFAULT 0,
    productive_percent       FLOAT DEFAULT 0,
    idle_percent             FLOAT DEFAULT 0,
    nva_percent              FLOAT DEFAULT 0,
    login_time               TIMESTAMPTZ,
    logout_time              TIMESTAMPTZ,
    computed_at              TIMESTAMPTZ DEFAULT now(),
    UNIQUE(associate_id, date)
);
```

---

## Files to Build

### `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy==2.0.30
alembic==1.13.1
asyncpg==0.29.0
psycopg2-binary==2.9.9
pydantic==2.7.1
pydantic-settings==2.3.0
python-dotenv==1.0.1
httpx==0.27.0
```

---

### `backend/.env.example`

```env
DATABASE_URL=postgresql+asyncpg://tms_user:tms_pass@localhost:5432/tms_db
AI_SERVICE_URL=http://localhost:8001
SECRET_KEY=change-me-in-production
```

---

### `backend/docker-compose.yml`

```yaml
version: "3.9"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: tms_user
      POSTGRES_PASSWORD: tms_pass
      POSTGRES_DB: tms_db
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db]
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  pgdata:
```

---

### `backend/database.py`

```python
# SQLAlchemy async engine setup
# create_async_engine(DATABASE_URL)
# AsyncSessionLocal = async_sessionmaker(engine)
# async def get_db() → yields AsyncSession  (FastAPI dependency)
# async def create_tables()  → called on startup
```

---

### `backend/models.py`

```python
# SQLAlchemy ORM models matching schema above:
# class Associate(Base)
# class Session(Base)
# class Event(Base)
# class ClaimTimeline(Base)
# class DailySummary(Base)
```

---

### `backend/schemas.py`

```python
# Pydantic v2 request/response schemas:

class EventPayload(BaseModel):
    associate_id: str
    session_id: str
    claim_id: str | None
    event_type: Literal["SESSION_START","SESSION_END","APP_SWITCH",
                        "IDLE_START","IDLE_END","CLAIM_SET",
                        "CLAIM_SWITCH","CLAIM_CLOSE"]
    app_name: str | None
    window_title: str | None
    timestamp: datetime
    is_idle: bool = False
    agent_version: str

class BulkEventsRequest(BaseModel):
    events: list[EventPayload]   # max 100 per batch

class SessionStartRequest(BaseModel):
    associate_id: str
    session_id: str
    started_at: datetime
    agent_version: str

class SessionEndRequest(BaseModel):
    session_id: str
    ended_at: datetime

# Response schemas:
class ClaimTimelineResponse(BaseModel)
class AssociateTodayResponse(BaseModel)
class TeamOverviewResponse(BaseModel)
class NVASummaryResponse(BaseModel)
```

---

### `backend/routes/events.py`

```python
router = APIRouter(prefix="/api/events", tags=["events"])

@router.post("/", status_code=202)
async def ingest_events(payload: BulkEventsRequest, db: AsyncSession = Depends(get_db)):
    # 1. Validate all events
    # 2. Bulk insert into events table (INSERT ... ON CONFLICT DO NOTHING)
    # 3. Trigger timeline_builder.process_session(session_id) as background task
    # Returns: {"accepted": N, "session_id": "..."}

@router.get("/health")
async def health(): return {"status": "healthy"}
```

---

### `backend/routes/sessions.py`

```python
router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.post("/start")
async def session_start(payload: SessionStartRequest, db: AsyncSession = Depends(get_db)):
    # Upsert associate (INSERT INTO associates IF NOT EXISTS)
    # Insert into sessions table
    # Returns: {"session_id": payload.session_id, "status": "started"}

@router.post("/end")
async def session_end(payload: SessionEndRequest, db: AsyncSession = Depends(get_db)):
    # Update sessions.ended_at
    # Trigger kpi_calculator.compute_daily_summary(session_id)
    # Returns: {"status": "ended", "summary_computed": true}
```

---

### `backend/routes/associate.py`

```python
router = APIRouter(prefix="/api/associate", tags=["associate"])

@router.get("/{associate_id}/today")
async def get_today(associate_id: str, db: AsyncSession = Depends(get_db)):
    # Returns: AssociateTodayResponse
    # {
    #   associate: {id, name, team},
    #   session: {session_id, login_time, is_active},
    #   summary: {total_claims, avg_claim_time_seconds, productive_percent,
    #             idle_percent, nva_percent, transactions_per_hour},
    #   current_claim: {claim_id, app_name, elapsed_seconds} | null,
    #   live_status: "active" | "idle" | "offline"
    # }

@router.get("/{associate_id}/claims")
async def get_claims(associate_id: str, date: str = None, db: AsyncSession = Depends(get_db)):
    # Returns list of all claims for associate today (or given date)
    # Each claim: {claim_id, started_at, ended_at, total_seconds, is_open,
    #              app_breakdown: [{app_name, seconds, percent}],
    #              nva_flags: [], nva_seconds}

@router.get("/{associate_id}/claims/{claim_id}/timeline")
async def get_claim_timeline(associate_id: str, claim_id: str, db: AsyncSession = Depends(get_db)):
    # Returns full per-app timeline for one claim
    # [{app_name, started_at, ended_at, duration_seconds, is_idle, nva_flags}]
```

---

### `backend/routes/team.py`

```python
router = APIRouter(prefix="/api/team", tags=["team"])

@router.get("/overview")
async def get_team_overview(date: str = None, db: AsyncSession = Depends(get_db)):
    # Returns list of all associates with today's summary + live status
    # [{associate_id, name, team, live_status, current_claim,
    #   total_claims, avg_claim_time_seconds, productive_percent,
    #   nva_percent, transactions_per_hour}]

@router.get("/nva-summary")
async def get_nva_summary(date: str = None, db: AsyncSession = Depends(get_db)):
    # Aggregates nva_flags across all claims for the team today
    # Returns: {team_nva_percent, top_nva_by_type: [...], top_nva_by_associate: [...]}
```

---

### `backend/services/timeline_builder.py`

**Purpose**: Consume raw `events` rows → build `claim_timelines` rows

```python
async def process_session(session_id: str, db: AsyncSession):
    """
    Algorithm:
    1. Fetch all APP_SWITCH, IDLE_START, IDLE_END, CLAIM_SET,
       CLAIM_SWITCH, CLAIM_CLOSE events for session_id, ordered by timestamp

    2. Walk events in order, maintaining:
       - current_claim_id
       - current_app_name
       - current_segment_start
       - is_currently_idle

    3. On APP_SWITCH:
       - Close current segment (ended_at = event.timestamp)
       - duration = ended_at - started_at (in seconds)
       - INSERT into claim_timelines
       - Open new segment (started_at = event.timestamp, app_name = new app)

    4. On IDLE_START within a segment:
       - Mark is_idle = True on the current open segment

    5. On CLAIM_SWITCH:
       - Close all open segments for old claim
       - Switch current_claim_id to new claim

    6. On SESSION_END:
       - Close all open segments with ended_at = SESSION_END timestamp

    7. On CLAIM_CLOSE:
       - Close open segment for that claim
    """

async def get_claim_summary(claim_id: str, db: AsyncSession) -> dict:
    """
    Returns aggregated per-app time for one claim:
    {total_seconds, app_breakdown: [{app_name, seconds, percent}]}
    """
```

---

### `backend/services/kpi_calculator.py`

**Purpose**: Compute `daily_summary` from `claim_timelines` + `sessions`

```python
async def compute_daily_summary(session_id: str, db: AsyncSession):
    """
    Computes and upserts into daily_summary:

    total_productive_seconds = SUM(duration_seconds WHERE NOT is_idle)
                               over all claim_timelines for this session

    total_idle_seconds       = SUM(duration_seconds WHERE is_idle)

    total_nva_seconds        = SUM(nva_seconds) from claim_timelines

    total_claims             = COUNT(DISTINCT claim_id) in session

    avg_claim_time_seconds   = total_productive_seconds / total_claims

    productive_percent       = total_productive_seconds /
                               (total_productive_seconds + total_idle_seconds) * 100

    idle_percent             = total_idle_seconds /
                               (total_productive_seconds + total_idle_seconds) * 100

    nva_percent              = total_nva_seconds / total_productive_seconds * 100

    transactions_per_hour    = total_claims / (total_productive_seconds / 3600)
    """

def calculate_capacity_gap(expected_tx_per_day: int, actual_tx: int,
                            avg_tx_time_seconds: int) -> dict:
    """
    Returns:
    {
      expected: 48, actual: 40,
      gap: 8,
      gap_minutes: 80,
      productivity_percent: 83.3
    }
    """
```

---

### `backend/mock_responses/` (6 JSON files — delivered to Member 4 on Day 1)

**`today.json`** — `GET /api/associate/EMP001/today`
```json
{
  "associate": { "id": "EMP001", "name": "John Smith", "team": "AR Team A" },
  "session": { "session_id": "sess-001", "login_time": "2026-10-06T08:02:00Z", "is_active": true },
  "summary": {
    "total_claims": 12, "avg_claim_time_seconds": 686,
    "productive_percent": 74.2, "idle_percent": 9.1, "nva_percent": 16.7,
    "transactions_per_hour": 5.3
  },
  "current_claim": { "claim_id": "CLM1003", "app_name": "Payer Portal", "elapsed_seconds": 513 },
  "live_status": "active"
}
```

**`claims.json`** — `GET /api/associate/EMP001/claims`
```json
[
  {
    "claim_id": "CLM1001", "started_at": "2026-10-06T08:05:00Z",
    "ended_at": "2026-10-06T08:16:00Z", "total_seconds": 660, "is_open": false,
    "app_breakdown": [
      {"app_name": "Claim Platform", "seconds": 198, "percent": 30},
      {"app_name": "Payer Portal",   "seconds": 264, "percent": 40},
      {"app_name": "Excel",          "seconds": 132, "percent": 20},
      {"app_name": "Outlook",        "seconds":  66, "percent": 10}
    ],
    "nva_flags": ["EXCEL_OVERUSE"], "nva_seconds": 92
  }
]
```

**`claim_detail.json`** — `GET /api/associate/EMP001/claims/CLM1003/timeline`

**`team_overview.json`** — `GET /api/team/overview`

**`nva_summary.json`** — `GET /api/team/nva-summary`

**`insights.json`** — `GET /api/insights` (proxied from Member 3)

---

### `backend/main.py`

```python
app = FastAPI(title="TMS API", version="1.0.0")

# CORS (allow dashboard origin)
# Include routers: events, sessions, associate, team
# Startup: create_tables()
# GET /health

# Proxy endpoint for AI insights:
@app.get("/api/insights")
async def get_insights():
    # httpx.AsyncClient → GET AI_SERVICE_URL/ai/insights
    # Returns AI service response directly
```

---

### ✅ Member 2 — Complete Deliverables Checklist

- [ ] `requirements.txt`
- [ ] `.env.example`
- [ ] `docker-compose.yml` (PostgreSQL + API, one command)
- [ ] `database.py` — async SQLAlchemy engine + session factory + dependency
- [ ] `models.py` — 5 ORM models
- [ ] `schemas.py` — all Pydantic request/response models
- [ ] `routes/events.py` — `POST /api/events` (bulk ingest)
- [ ] `routes/sessions.py` — `POST /api/sessions/start` + `/end`
- [ ] `routes/associate.py` — `GET /api/associate/{id}/today` + `/claims` + `/claims/{id}/timeline`
- [ ] `routes/team.py` — `GET /api/team/overview` + `/nva-summary`
- [ ] `services/timeline_builder.py` — event → claim timeline algorithm
- [ ] `services/kpi_calculator.py` — daily KPI computation
- [ ] `mock_responses/today.json`
- [ ] `mock_responses/claims.json`
- [ ] `mock_responses/claim_detail.json`
- [ ] `mock_responses/team_overview.json`
- [ ] `mock_responses/nva_summary.json`
- [ ] `mock_responses/insights.json`
- [ ] `main.py` — FastAPI app wiring + CORS + AI proxy endpoint
- [ ] Alembic migrations (`alembic init` + first migration)
- [ ] Swagger UI working at `/docs`
- [ ] **End-to-end test**: Send mock events → verify claim_timelines built → verify KPIs computed

---
---

# 👤 MEMBER 3 — AI / NVA Engine + Gemini Insights

**Role**: AI/Data Engineer
**Stack**: Python 3.11, FastAPI, `google-generativeai`, `pandas`, `statistics` (stdlib)

---

## Files to Build

### `ai/requirements.txt`

```
fastapi==0.111.0
uvicorn==0.30.1
google-generativeai==0.7.2
pandas==2.2.2
python-dotenv==1.0.1
httpx==0.27.0
```

---

### `ai/sample_timelines.json` (Delivered Day 1 — 30 realistic claim timelines)

```json
[
  {
    "claim_id": "CLM1001",
    "associate_id": "EMP001",
    "session_id": "sess-001",
    "total_seconds": 660,
    "segments": [
      {"app_name": "Claim Platform", "duration_seconds": 130, "is_idle": false},
      {"app_name": "Payer Portal",   "duration_seconds": 220, "is_idle": false},
      {"app_name": "Excel",          "duration_seconds": 200, "is_idle": false},
      {"app_name": "Claim Platform", "duration_seconds":  80, "is_idle": false},
      {"app_name": "Excel",          "duration_seconds":  30, "is_idle": false}
    ]
  }
  // ... 29 more entries with varied patterns
]
```

---

### `ai/mock_insights.json` (Delivered Day 1 — for Member 4 to use immediately)

```json
{
  "generated_at": "2026-10-06T10:00:00Z",
  "insights": [
    {
      "type": "warning",
      "icon": "🔴",
      "title": "Excel dependency is high today",
      "body": "Associates spend 28% of claim time in Excel — above the 20% threshold. Consider automating the Excel-to-platform data transfer.",
      "metric": "28% Excel time",
      "affected": "8 associates"
    },
    {
      "type": "opportunity",
      "icon": "🟡",
      "title": "Excessive app switching detected",
      "body": "Average 6.2 app switches per claim across the team. Integrating the payer portal directly could reduce this by ~40%.",
      "metric": "6.2 switches/claim",
      "affected": "31 claims"
    },
    {
      "type": "win",
      "icon": "🟢",
      "title": "Average claim time improved this week",
      "body": "Team average dropped from 14.2 min to 12.8 min compared to last week — a 9.8% improvement.",
      "metric": "−1.4 min avg",
      "affected": "All associates"
    }
  ]
}
```

---

### `ai/nva_engine.py`

**Purpose**: Apply 5 NVA detection rules to claim timelines

```python
NVA_RULES = {
    "EXCEL_OVERUSE":   "Excel time exceeds 30% of total claim time",
    "APP_SWITCHING":   "More than 5 app switches in a single claim",
    "IDLE_IN_TX":      "Idle time > 2 minutes while claim is open",
    "REWORK":          "Claim re-opened within 30 minutes of previous close",
    "OUTLIER_CLAIM":   "Claim time exceeds 2× team average"
}

class NVAEngine:
    def __init__(self, thresholds: dict = None)
        # thresholds = {
        #   "excel_percent": 30,
        #   "app_switches": 5,
        #   "idle_seconds": 120,
        #   "rework_window_minutes": 30,
        #   "outlier_multiplier": 2.0
        # }

    def analyze_claim(self, timeline: dict) -> dict:
        """
        Input: one claim timeline dict (matches sample_timelines.json format)
        Output:
        {
          "claim_id": "CLM1001",
          "total_seconds": 660,
          "nva_seconds": 230,
          "nva_percent": 34.8,
          "nva_flags": ["EXCEL_OVERUSE", "APP_SWITCHING"],
          "app_breakdown": {"Excel": 230, "Claim Platform": 210, ...},
          "switch_count": 4,
          "excel_percent": 34.8,
          "idle_seconds": 0
        }

        Rules applied:
        EXCEL_OVERUSE:  excel_seconds / total_seconds > threshold
        APP_SWITCHING:  count of distinct consecutive app transitions > threshold
        IDLE_IN_TX:     sum(seg.duration WHERE seg.is_idle) > threshold
        OUTLIER_CLAIM:  total_seconds > (team_avg * multiplier)
                        — team_avg injected via set_team_avg()
        """

    def analyze_batch(self, timelines: list[dict]) -> list[dict]:
        # Compute team_avg first, then analyze each
        # Returns list of analysis results

    def set_team_avg(self, avg_seconds: float)
        # Called before analyze_batch so OUTLIER_CLAIM rule has context
```

---

### `ai/team_aggregator.py`

**Purpose**: Aggregate NVA results across all claims for the team

```python
class TeamAggregator:

    def aggregate(self, analyses: list[dict]) -> dict:
        """
        Input: list of claim analysis results from NVAEngine.analyze_batch()
        Output:
        {
          "total_claims_analyzed": 87,
          "team_nva_percent": 23.4,
          "team_avg_claim_seconds": 742,
          "top_nva_by_type": [
            {"type": "EXCEL_OVERUSE", "label": "Excel time > 30%",
             "total_minutes": 142, "affected_claims": 18, "percent_of_claims": 20.7},
            {"type": "APP_SWITCHING", "label": "Excessive app switches",
             "total_minutes": 87,  "affected_claims": 31, "percent_of_claims": 35.6},
            {"type": "IDLE_IN_TX",   "label": "Idle within transaction",
             "total_minutes": 63,  "affected_claims": 9,  "percent_of_claims": 10.3}
          ],
          "top_nva_by_associate": [
            {"associate_id": "EMP001", "name": "John Smith",
             "nva_percent": 35.1, "total_nva_minutes": 42},
            {"associate_id": "EMP002", "name": "Mary Davis",
             "nva_percent": 27.4, "total_nva_minutes": 31}
          ],
          "app_time_breakdown": {
            "Claim Platform": {"total_minutes": 312, "percent": 32},
            "Payer Portal":   {"total_minutes": 274, "percent": 28},
            "Excel":          {"total_minutes": 225, "percent": 23},
            "Outlook":        {"total_minutes":  98, "percent": 10},
            "Other":          {"total_minutes":  68, "percent":  7}
          }
        }
        """

    def compute_capacity_gap(self, total_associates: int,
                              work_hours: float,
                              standard_tx_minutes: float,
                              actual_tx: int) -> dict:
        """
        Returns:
        {
          expected_tx: 48, actual_tx: 40, gap: 8,
          gap_minutes: 80, productivity_percent: 83.3,
          capacity_recovered_if_nva_eliminated_minutes: 142
        }
        """
```

---

### `ai/gemini_insights.py`

**Purpose**: Use Gemini API to generate 3 plain-English management insights

```python
import google.generativeai as genai

class GeminiInsightGenerator:
    def __init__(self, api_key: str)
        # genai.configure(api_key=api_key)
        # self.model = genai.GenerativeModel("gemini-1.5-flash")
        # self._cache: dict = {}
        # self._cache_ttl_seconds = 3600  # refresh hourly

    def generate_insights(self, team_summary: dict) -> list[dict]:
        """
        1. Check cache — if fresh, return cached insights
        2. Build prompt with team_summary data:
           - team_nva_percent
           - top_nva_by_type (top 3)
           - team_avg_claim_seconds
           - app_time_breakdown
           - capacity_gap data
        3. Call Gemini API:
           prompt = f'''
           You are a productivity analyst for an AR (Accounts Receivable) team.
           Here is today's productivity data:
           {json.dumps(team_summary, indent=2)}

           Generate exactly 3 concise management insights.
           Return a JSON array. Each object must have:
           - "type": one of "warning", "opportunity", "win"
           - "icon": matching emoji (🔴 warning, 🟡 opportunity, 🟢 win)
           - "title": max 8 words
           - "body": max 2 sentences, actionable
           - "metric": key number (e.g., "28% Excel time")
           - "affected": who is affected (e.g., "8 associates")
           Return ONLY valid JSON, no markdown.
           '''
        4. Parse response → list[dict]
        5. Cache result with timestamp
        6. On API error → return fallback hardcoded insights from mock_insights.json
        """

    def _fallback_insights(self) -> list[dict]:
        # Load and return mock_insights.json data
```

---

### `ai/main.py`

**Purpose**: FastAPI microservice exposing 3 endpoints

```python
app = FastAPI(title="TMS AI Engine", version="1.0.0")

# On startup: load sample_timelines.json
# Initialize NVAEngine, TeamAggregator, GeminiInsightGenerator

@app.post("/ai/analyze-claims")
async def analyze_claims(timelines: list[dict]):
    """
    Input: array of claim timeline dicts
    Steps:
      1. nva_engine.analyze_batch(timelines)
      2. Returns list of NVA analysis results per claim
    """

@app.get("/ai/team-nva-summary")
async def team_nva_summary(date: str = None):
    """
    1. Fetch claim timelines from backend DB via httpx
       GET http://backend:8000/api/team/claims?date={date}
    2. Run analyze_batch + aggregate
    3. Return TeamAggregator.aggregate() result
    """

@app.get("/ai/insights")
async def get_insights():
    """
    1. GET /ai/team-nva-summary (self-call or reuse result)
    2. gemini_generator.generate_insights(team_summary)
    3. Return: { generated_at, insights: [...] }
    Cache: 1 hour (avoid hammering Gemini)
    """

@app.get("/health")
async def health(): return {"status": "healthy"}
```

---

### `ai/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

### ✅ Member 3 — Complete Deliverables Checklist

- [ ] `requirements.txt`
- [ ] `sample_timelines.json` — 30 realistic claim timelines (**Day 1**)
- [ ] `mock_insights.json` — 3 hardcoded insight cards (**Day 1**, for Member 4)
- [ ] `nva_engine.py` — `NVAEngine` class with 5 rules + `analyze_claim()` + `analyze_batch()`
- [ ] `team_aggregator.py` — `TeamAggregator.aggregate()` + `compute_capacity_gap()`
- [ ] `gemini_insights.py` — `GeminiInsightGenerator` with Gemini API + cache + fallback
- [ ] `main.py` — FastAPI microservice with 3 endpoints + health
- [ ] `Dockerfile`
- [ ] `.env.example` with `GEMINI_API_KEY=`, `BACKEND_URL=`
- [ ] **End-to-end test**: Feed `sample_timelines.json` → verify NVA flags correct → verify Gemini response parses correctly

---
---

# 👤 MEMBER 4 — React Dashboard (3 Screens)

**Role**: Frontend Engineer
**Stack**: Vite, React 18, TypeScript, Recharts, Axios, CSS Variables (dark theme)

---

## Files to Build

### `dashboard/package.json`

```json
{
  "name": "tms-dashboard",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "recharts": "^2.12.7",
    "axios": "^1.7.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.13"
  }
}
```

---

### `dashboard/src/index.css` — Design System (Dark Mode)

```css
/* Google Font: Inter */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --bg-base:     #0d1117;
  --bg-surface:  #161b22;
  --bg-elevated: #21262d;
  --bg-hover:    #30363d;

  --accent-teal:   #00b4d8;
  --accent-green:  #3fb950;
  --accent-amber:  #d29922;
  --accent-red:    #f85149;

  --text-primary:   #e6edf3;
  --text-secondary: #8b949e;
  --text-muted:     #484f58;

  --border:       #30363d;

  --app-claim:  #00b4d8;
  --app-payer:  #3fb950;
  --app-excel:  #d29922;
  --app-outlook:#8b949e;
  --app-other:  #484f58;

  --radius: 8px;
  --radius-lg: 12px;
  font-family: 'Inter', system-ui, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg-base); color: var(--text-primary); }

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-active  { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
.dot-idle    { background: var(--accent-amber); }
.dot-offline { background: var(--text-muted); }

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius);
}
```

---

### `dashboard/src/config.ts`

```typescript
export const USE_MOCK = true;   // flip to false when backend is live
export const API_BASE = "http://localhost:8000";
export const AI_BASE  = "http://localhost:8001";
export const POLL_INTERVAL_MS = 30_000;

export const APP_COLORS: Record<string, string> = {
  "Claim Platform": "#00b4d8",
  "Payer Portal":   "#3fb950",
  "Excel":          "#d29922",
  "Outlook":        "#8b949e",
  "Other":          "#484f58",
};
```

---

### `dashboard/src/api/types.ts`

```typescript
export interface Associate { id: string; name: string; team: string; }
export interface SessionInfo { session_id: string; login_time: string; is_active: boolean; }
export interface DailySummary {
  total_claims: number; avg_claim_time_seconds: number;
  productive_percent: number; idle_percent: number;
  nva_percent: number; transactions_per_hour: number;
}
export interface CurrentClaim { claim_id: string; app_name: string; elapsed_seconds: number; }
export interface AssociateTodayResponse {
  associate: Associate; session: SessionInfo;
  summary: DailySummary; current_claim: CurrentClaim | null;
  live_status: "active" | "idle" | "offline";
}
export interface AppBreakdown { app_name: string; seconds: number; percent: number; }
export interface ClaimRecord {
  claim_id: string; started_at: string; ended_at: string | null;
  total_seconds: number; is_open: boolean;
  app_breakdown: AppBreakdown[]; nva_flags: string[]; nva_seconds: number;
}
export interface TeamMember {
  associate_id: string; name: string; team: string;
  live_status: "active" | "idle" | "offline"; current_claim: string | null;
  total_claims: number; avg_claim_time_seconds: number;
  productive_percent: number; nva_percent: number; transactions_per_hour: number;
}
export interface NVAType {
  type: string; label: string; total_minutes: number;
  affected_claims: number; percent_of_claims: number;
}
export interface NVASummary {
  team_nva_percent: number; team_avg_claim_seconds: number; total_claims_analyzed: number;
  top_nva_by_type: NVAType[];
  top_nva_by_associate: Array<{ associate_id: string; name: string; nva_percent: number; total_nva_minutes: number; }>;
  app_time_breakdown: Record<string, { total_minutes: number; percent: number }>;
}
export interface Insight {
  type: "warning" | "opportunity" | "win";
  icon: string; title: string; body: string; metric: string; affected: string;
}
export interface InsightsResponse { generated_at: string; insights: Insight[]; }
```

---

### `dashboard/src/api/mock.ts`

```typescript
// Exports typed mock data objects matching each API shape
// Populated from backend/mock_responses/*.json + ai/mock_insights.json
// Member 4 creates this file independently using the agreed response schemas

export const mockToday: AssociateTodayResponse = { ... }
export const mockClaims: ClaimRecord[] = [ ... ]
export const mockClaimDetail: ClaimTimelineSegment[] = [ ... ]
export const mockTeamOverview: TeamMember[] = [ ... ]
export const mockNVASummary: NVASummary = { ... }
export const mockInsights: InsightsResponse = { ... }
```

---

### `dashboard/src/api/client.ts`

```typescript
// All 6 fetch functions — returns mock or real based on USE_MOCK flag
export async function fetchAssociateToday(id: string): Promise<AssociateTodayResponse>
export async function fetchAssociateClaims(id: string, date?: string): Promise<ClaimRecord[]>
export async function fetchClaimTimeline(associateId: string, claimId: string): Promise<ClaimTimelineSegment[]>
export async function fetchTeamOverview(date?: string): Promise<TeamMember[]>
export async function fetchNVASummary(date?: string): Promise<NVASummary>
export async function fetchInsights(): Promise<InsightsResponse>
```

---

## 10 Components to Build

### `Sidebar.tsx`
- Logo + "TMS" title
- Nav links: Associate, Team, Insights (active = teal left border highlight)
- Associate selector dropdown at bottom (changes which associate is viewed on Associate page)
- Props: `activePage`, `onNavigate`, `selectedAssociate`, `associates[]`, `onAssociateChange`

### `Header.tsx`
- Page title + "Last updated: HH:MM AM" + 🔄 refresh button
- Props: `title`, `lastUpdated: Date`, `onRefresh`

### `ActiveClaimCard.tsx`
- Shows: Claim ID (large teal text), live status dot + current app, elapsed time (ticking every 1s via `setInterval`)
- Shows "No active claim" state when `current_claim = null`
- Props: `currentClaim: CurrentClaim | null`, `liveStatus`

### `DailySummaryBar.tsx`
- Horizontal strip: Claims | Avg Time | Productive % | Idle % | NVA % | Tx/hr
- Color-coded: green for productive, amber for idle, red for NVA
- Props: `summary: DailySummary`, `loginTime: string`

### `ClaimGanttChart.tsx`
- One horizontal row per claim, segmented by app color
- X-axis: time of day (HH:MM format)
- Clicking a bar → fires `onClaimSelect(claim_id)`
- Built with Recharts `BarChart` (horizontal layout) + custom colored `Cell`s
- Props: `claims: ClaimRecord[]`, `onClaimSelect: (id: string) => void`, `selectedClaimId: string | null`

### `ClaimDetailBreakdown.tsx`
- Shows selected claim's app-by-app time (horizontal bar chart)
- NVA flags shown as ⚠️ badge next to flagged apps
- Total time + NVA time summary line at top
- Props: `claim: ClaimRecord | null`

### `AppPieChart.tsx`
- Recharts `PieChart` (donut) showing app time distribution
- Color per app from `APP_COLORS` config
- Custom tooltip: "Excel — 4m 15s (31%)"
- Props: `appBreakdown: AppBreakdown[]`, `title?: string`

### `TeamTable.tsx`
- Columns: Associate | Status | Claims | Avg Time | NVA% | Current Claim
- Live status animated pulse dot
- Sortable by Claims, Avg Time, NVA% (click column header)
- Click row → navigate to Associate page for that person
- Props: `members: TeamMember[]`, `onRowClick: (id: string) => void`

### `NVALeaderboard.tsx`
- Horizontal bar chart (Recharts), one bar per NVA type
- Sorted descending by total_minutes
- Shows: NVA type label + total minutes + affected claims count
- Props: `nvaSummary: NVASummary`

### `InsightCard.tsx`
- Colored left border: red=warning, amber=opportunity, green=win
- Icon + Title (bold) + body text + metric badge + affected badge
- Subtle hover lift effect (CSS transform)
- Props: `insight: Insight`

### `LoadingSkeleton.tsx`
- Shimmer placeholder for any loading state
- Props: `width: string`, `height: string`, `className?: string`

---

## 3 Pages to Build

### `pages/Associate.tsx`

**Grid layout (2 columns):**
```
Row 1: [ActiveClaimCard]          [DailySummaryBar — full width]
Row 2: [ClaimGanttChart (left)]   [AppPieChart (right)]
Row 3: [ClaimDetailBreakdown — full width]
```

**State:** `today`, `claims`, `selectedClaimId`, `isLoading`
**Behavior:**
- Fetch on mount + `setInterval(POLL_INTERVAL_MS)` auto-refresh
- `ActiveClaimCard` ticks locally via `setInterval(1000)` — no refetch
- Click Gantt bar → update `selectedClaimId` → `ClaimDetailBreakdown` re-renders
- Show `LoadingSkeleton` in each card while loading

---

### `pages/Team.tsx`

**Grid layout:**
```
Row 1: Page title + date + sort control
Row 2: [TeamTable — full width]
Row 3: [NVALeaderboard (left)]   [AppPieChart team total (right)]
```

**State:** `teamMembers`, `nvaSummary`, `sortBy`, `isLoading`
**Behavior:**
- Auto-refresh every 30s
- Click `TeamTable` row → `navigate("/associate/" + id)`
- Sort dropdown: "Claims" | "Avg Time" | "NVA %"

---

### `pages/Insights.tsx`

**Layout:**
```
Row 1: "🤖 TODAY'S AI INSIGHTS" heading + generated_at + 🔄 Refresh button
Row 2: [InsightCard warning]
Row 3: [InsightCard opportunity]
Row 4: [InsightCard win]
Row 5: [NVALeaderboard]
Row 6: [AppPieChart — team level]
```

**State:** `insights`, `nvaSummary`, `isRefreshing`
**Behavior:**
- Fetch on mount
- Refresh button → re-fetch + spinner on button
- Show `generated_at` as "Generated: Oct 6, 10:00 AM"

---

### `App.tsx`

```typescript
// React Router v6 setup
// Layout: fixed Sidebar (left) + main content area (right)
// Routes:
//   /                    → redirect → /associate/EMP001
//   /associate/:id       → <Associate />
//   /team                → <Team />
//   /insights            → <Insights />
// Global state: selectedAssociateId (useState, synced to URL param)
```

---

### ✅ Member 4 — Complete Deliverables Checklist

- [ ] `package.json` + `vite.config.ts` + `tsconfig.json` + `index.html`
- [ ] `src/index.css` — full dark mode CSS design system
- [ ] `src/config.ts` — `USE_MOCK`, `APP_COLORS`, `API_BASE`, `POLL_INTERVAL_MS`
- [ ] `src/api/types.ts` — all TypeScript interfaces (8 types)
- [ ] `src/api/mock.ts` — all 6 mock data objects
- [ ] `src/api/client.ts` — all 6 fetch functions with mock/real toggle
- [ ] `src/components/Sidebar.tsx`
- [ ] `src/components/Header.tsx`
- [ ] `src/components/ActiveClaimCard.tsx` — live ticking timer
- [ ] `src/components/DailySummaryBar.tsx`
- [ ] `src/components/ClaimGanttChart.tsx` — Recharts horizontal bar, clickable
- [ ] `src/components/ClaimDetailBreakdown.tsx` — per-app breakdown + NVA flags
- [ ] `src/components/AppPieChart.tsx` — Recharts donut
- [ ] `src/components/TeamTable.tsx` — sortable + clickable rows + live dots
- [ ] `src/components/NVALeaderboard.tsx` — horizontal Recharts bar
- [ ] `src/components/InsightCard.tsx` — colored border + hover effect
- [ ] `src/components/LoadingSkeleton.tsx` — shimmer
- [ ] `src/pages/Associate.tsx` — full layout + state + auto-refresh
- [ ] `src/pages/Team.tsx` — full layout + sort + row navigation
- [ ] `src/pages/Insights.tsx` — full layout + refresh button
- [ ] `src/App.tsx` — router + sidebar layout
- [ ] `src/main.tsx` — React entry point
- [ ] **End-to-end test**: All 3 screens render with mock data → flip `USE_MOCK=false` → live data works

---
---

## 📅 3-Week Sprint (All Parallel)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DAY 0 — 1 Hour All-Hands Sync (EVERYONE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Finalize and commit shared/event-schema.json
  ✅ Agree app_name values + app_map (process → app name)
  ✅ M2 commits mock_responses/ (6 JSON files) → unblocks M4
  ✅ M3 commits sample_timelines.json + mock_insights.json → unblocks M4
  ✅ GitHub repo created, 4 branches: agent/, backend/, ai/, dashboard/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WEEK 1 — Build Foundation (All 4 Members in Parallel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 M1  tracker.py (app switch) + idle_monitor.py + emitter.py
     → Events flowing into mock_backend.py, verified in console
 M2  DB schema + migrations + POST /api/events + GET /health
     → docker-compose up, Swagger at /docs working
 M3  nva_engine.py (all 5 rules) tested against sample_timelines.json
     → NVA flags correct for 30 test timelines
 M4  Vite scaffold + index.css + all types + mock client
     → All 3 pages rendered with mock data, navigation works
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WEEK 2 — Core Engines (All 4 Members in Parallel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 M1  claim_context.py + dialog.py + tray.py + session tracking
     → Full agent running: tray shows claim, dialog pops correctly
 M2  timeline_builder.py + kpi_calculator.py + all GET endpoints live
     → /api/associate/EMP001/today returns real DB data
 M3  team_aggregator.py + gemini_insights.py + FastAPI service running
     → /ai/insights returns Gemini-generated insights
 M4  All 10 components polished, auto-refresh, skeleton loading states
     → Gantt chart clickable, TeamTable sortable, InsightCards styled
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WEEK 3 — Integration + Polish (Coordinated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 M1  window-title regex auto-detection + PyInstaller .exe packaging
     → TMS-Agent.exe installs and auto-starts on Windows login
 M2  M3's /ai/analyze-claims called after each timeline build + stored
     → NVA flags in DB populated by real AI engine
 M3  Gemini prompt tuning + 1-hour cache + graceful fallback on error
     → Insights refresh correctly, no API hammering
 M4  USE_MOCK=false → integration bugs fixed + final polish
     → Full end-to-end demo flow working
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 END OF WEEK 3 — DEMO DAY 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔗 Integration Handoff Protocol

| When | From | To | What |
|---|---|---|---|
| **Day 0** | M2 | M4 | `mock_responses/` folder (6 JSON files) — hard deadline |
| **Day 0** | M3 | M4 | `mock_insights.json` + `sample_timelines.json` — hard deadline |
| **Week 2, Day 1** | M2 | M1 | `POST /api/events` live → M1 switches off mock_backend |
| **Week 2, Day 3** | M2 | M4 | All GET endpoints live → M4 switches endpoints one at a time |
| **Week 2, Day 5** | M3 | M2 | `POST /ai/analyze-claims` ready → M2 calls it post timeline-build |
| **Week 3, Day 1** | M3 | M4 | `GET /ai/insights` live → M4 flips last mock |
| **Week 3, Day 3** | All | All | `docker-compose up` → full stack verified locally |

---

## 🎯 MVP Demo Flow (Week 3 End)

```
1. Agent starts on demo PC → system tray: "TMS Agent — No active claim"
2. Open Claim Platform → dialog appears: "Which claim are you working on?"
3. Select CLM1003 → tray updates: "TMS Agent — Tracking CLM1003 · Claim Platform"
4. Switch to Chrome (Payer Portal) → agent auto-tracks, no dialog
5. Open Excel → agent tracks Excel time
6. Switch back to Claim Platform, click CLM1005 → dialog: "Switch to CLM1005?"
7. Confirm → CLM1003 closed, CLM1005 now active
8. DASHBOARD (on second screen):
   - Associate page: CLM1003 timeline shows Claim Platform → Payer Portal → Excel
   - CLM1005 shows as "Active" with live ticking timer
   - Productive: 74%, NVA: 17%, Tx/hr: 5.3
9. Team page: All associates, live status dots, NVA leaderboard
10. Insights page: "Excel dependency at 28% — automation opportunity"
```
