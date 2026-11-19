# TMS — MVP Architecture & Workflow
### AI-Powered Transaction Intelligence Platform

---

## 1. System Architecture — Big Picture

```mermaid
graph TB
    subgraph DESKTOP["🖥️  Associate's Windows PC"]
        direction TB
        AGENT["⚙️ Windows Agent\n(Background .exe)"]
        TRAY["📌 System Tray\nLive Status"]
        DIALOG["💬 Claim Prompt\nDialog (Tkinter)"]
        APPS["📂 Applications\nClaim Platform · Excel · Chrome · Outlook"]
        AGENT <--> TRAY
        AGENT --> DIALOG
        APPS --> AGENT
    end

    subgraph BACKEND["🗄️  Backend Server"]
        direction TB
        API["🔌 FastAPI\nREST API\n:8000"]
        TLB["⚙️ Timeline Builder\nService"]
        KPI["📊 KPI Calculator\nService"]
        DB[("🐘 PostgreSQL\n5 Tables")]
        API --> TLB --> DB
        API --> KPI --> DB
    end

    subgraph AI["🤖  AI Engine"]
        direction TB
        AIAPI["🔌 FastAPI\nAI Service\n:8001"]
        NVA["🔍 NVA Rule\nEngine"]
        AGG["📈 Team\nAggregator"]
        GEM["✨ Gemini API\nInsights Generator"]
        AIAPI --> NVA
        AIAPI --> AGG
        AIAPI --> GEM
    end

    subgraph DASHBOARD["🌐  Management Dashboard"]
        direction TB
        REACT["⚛️ React App\n(Vite + TypeScript)"]
        P1["📋 Associate\nPage"]
        P2["👥 Team\nPage"]
        P3["🤖 Insights\nPage"]
        REACT --> P1
        REACT --> P2
        REACT --> P3
    end

    AGENT -->|"POST /api/events\n(JSON batch every 10s)"| API
    API -->|"POST /ai/analyze-claims\n(after timeline built)"| AIAPI
    REACT -->|"GET /api/associate/:id/today\nGET /api/team/overview\nGET /api/insights\n(every 30s poll)"| API
    API -->|"proxies"| AIAPI
    GEM <-->|"Gemini 1.5 Flash\nAPI Call"| GEMCLOUD["☁️ Google\nGemini Cloud"]
```

---

## 2. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Windows Agent** | Python 3.11, `psutil`, `pygetwindow`, `pynput`, `tkinter`, `pystray` | Native Windows APIs, lightweight, packagable as .exe |
| **Backend API** | FastAPI + `uvicorn` (async) | High-throughput async event ingestion, auto Swagger docs |
| **Database** | PostgreSQL 15 | Relational integrity, time-series queries, JSON support |
| **ORM** | SQLAlchemy 2.0 (async) + Alembic | Type-safe queries, schema migrations |
| **AI Engine** | FastAPI + `google-generativeai` | Microservice isolation, Gemini 1.5 Flash for insights |
| **NVA Rules** | Pure Python (no ML) | Deterministic, fast, no training data needed for MVP |
| **Dashboard** | React 18 + Vite + TypeScript | Fast HMR dev, type-safe, production-ready bundle |
| **Charts** | Recharts | React-native, composable, works with our data shape |
| **Packaging** | Docker Compose (backend + AI + DB) | One-command local setup |
| **Agent Packaging** | PyInstaller | Single .exe, no Python runtime needed on agent PC |

---

## 3. Data Flow — Event to Dashboard

```mermaid
sequenceDiagram
    participant PC as 🖥️ Associate's PC
    participant AG as ⚙️ Windows Agent
    participant API as 🔌 FastAPI Backend
    participant DB as 🐘 PostgreSQL
    participant TLB as ⚙️ Timeline Builder
    participant AIE as 🤖 AI Engine
    participant DASH as 🌐 Dashboard

    Note over AG: Agent polls every 3 seconds
    PC->>AG: App window switches (e.g., Excel → Chrome)
    AG->>AG: Detect APP_SWITCH event
    AG->>AG: Queue event (in-memory)

    Note over AG: Every 10 seconds: batch flush
    AG->>API: POST /api/events [{event1, event2, ...}]
    API->>DB: INSERT INTO events (bulk)
    API-->>AG: 202 Accepted

    Note over API: Background task triggered
    API->>TLB: process_session(session_id)
    TLB->>DB: SELECT events WHERE session_id ORDER BY timestamp
    TLB->>TLB: Walk events → build timeline segments
    TLB->>DB: INSERT INTO claim_timelines

    TLB->>AIE: POST /ai/analyze-claims (timelines)
    AIE->>AIE: Apply 5 NVA rules per claim
    AIE-->>TLB: NVA flags + nva_seconds per claim
    TLB->>DB: UPDATE claim_timelines SET nva_flags, nva_seconds

    Note over DASH: Dashboard polls every 30 seconds
    DASH->>API: GET /api/associate/EMP001/today
    API->>DB: SELECT daily_summary, current session, live claim
    API-->>DASH: AssociateTodayResponse (JSON)
    DASH->>DASH: Re-render Associate page

    DASH->>API: GET /api/insights
    API->>AIE: GET /ai/insights (proxy)
    AIE->>AIE: Check 1-hour cache
    AIE->>AIE: team_aggregator.aggregate(today's NVA data)
    AIE->>AIE: gemini.generate_insights(team_summary)
    AIE-->>API: 3 insight cards (JSON)
    API-->>DASH: InsightsResponse
    DASH->>DASH: Re-render Insights page
```

---

## 4. Windows Agent — Internal Architecture

```mermaid
graph LR
    subgraph AGENT["Windows Agent Process (main.py)"]
        direction TB

        subgraph THREADS["Background Threads"]
            T1["Thread 1\nWindowTracker.poll()\nevery 3s"]
            T2["Thread 2\nIdleMonitor.check()\nevery 10s"]
            T3["Thread 3\nEventEmitter.flush()\nevery 10s"]
        end

        CTX["ClaimContextManager\n(State Machine)"]
        TRAY2["TrayIcon\n(pystray)"]
        DLG["ClaimDialog\n(tkinter)"]
        QUEUE["Event Queue\n(thread-safe list)"]
        LOCAL["Local Fallback\nevent_queue.jsonl"]

        T1 -->|"APP_SWITCH detected"| CTX
        T2 -->|"IDLE_START / IDLE_END"| QUEUE
        CTX -->|"CLAIM_SET / CLAIM_SWITCH"| QUEUE
        CTX -->|"auto-detect fails"| DLG
        DLG -->|"user selects claim"| CTX
        CTX -->|"updates tooltip"| TRAY2
        T1 -->|"APP_SWITCH event"| QUEUE
        T3 -->|"drain queue"| HTTP{"HTTP\nPOST /api/events"}
        HTTP -->|"on failure"| LOCAL
        LOCAL -->|"on next success"| HTTP
    end
```

### Agent State Machine

```mermaid
stateDiagram-v2
    [*] --> SESSION_ACTIVE : Agent starts\nSESSION_START emitted

    SESSION_ACTIVE --> CLAIM_ACTIVE : CLAIM_SET\n(auto or dialog)
    SESSION_ACTIVE --> IDLE : IDLE_START\n(2 min no input)

    CLAIM_ACTIVE --> APP_TRACKING : APP_SWITCH detected\n(segment recorded)
    APP_TRACKING --> APP_TRACKING : Next APP_SWITCH\n(new segment)
    CLAIM_ACTIVE --> CLAIM_SWITCH : New Claim detected\n(CLAIM_SWITCH emitted)
    CLAIM_SWITCH --> CLAIM_ACTIVE : New claim now active
    CLAIM_ACTIVE --> IDLE_IN_TX : IDLE_START within open claim

    IDLE_IN_TX --> CLAIM_ACTIVE : IDLE_END
    IDLE --> SESSION_ACTIVE : IDLE_END\n(any keyboard/mouse)

    CLAIM_ACTIVE --> SESSION_ACTIVE : CLAIM_CLOSE emitted
    SESSION_ACTIVE --> [*] : Agent quits\nSESSION_END emitted
```

---

## 5. Claim Detection Workflow

```mermaid
flowchart TD
    A["App Switch Detected\n(Claim Platform or Chrome becomes active)"] --> B

    B{"Is there a\nCLM\\d+ pattern\nin window title?"}
    B -->|Yes| C["Auto-detect Claim ID\nfrom window title\ne.g. 'CLM1003 - Robert Wilson'"]
    B -->|No| D{"Is current\nactive claim\nalready set?"}

    C --> E{"Same as\ncurrent claim?"}
    E -->|Yes| F["No action needed\nContinue tracking"]
    E -->|No| G["Emit CLAIM_SWITCH\nold claim → PAUSED\nnew claim → ACTIVE"]

    D -->|Yes| H["Continue tracking\nunder current claim"]
    D -->|No| I["Show Claim Dialog\n'Which claim are you\nworking on?'"]

    I --> J{"User response?"}
    J -->|"Select from dropdown\n(recent claims)"| K["Emit CLAIM_SET\nwith selected claim_id"]
    J -->|"Type new claim ID"| L["Validate format\nCLM\\d+"]
    J -->|Skip| M["Continue without\nclaim context\n(activity tracked as unclaimed)"]

    L -->|Valid| K
    L -->|Invalid| N["Show error\n'Invalid Claim ID format'\nRe-prompt"]

    K --> O["Update Tray Tooltip\n'Tracking CLM1003'"]
    G --> O
```

---

## 6. Backend — Request Flow

```mermaid
flowchart LR
    subgraph ROUTES["API Routes Layer"]
        R1["POST /api/events"]
        R2["POST /api/sessions/start\nPOST /api/sessions/end"]
        R3["GET /api/associate/:id/today\nGET /api/associate/:id/claims\nGET /api/associate/:id/claims/:cid/timeline"]
        R4["GET /api/team/overview\nGET /api/team/nva-summary"]
        R5["GET /api/insights\n(AI proxy)"]
    end

    subgraph SERVICES["Services Layer"]
        S1["timeline_builder.py\nprocess_session()"]
        S2["kpi_calculator.py\ncompute_daily_summary()"]
        S3["httpx → AI Service"]
    end

    subgraph DB2["Database Layer"]
        D1["events table"]
        D2["claim_timelines table"]
        D3["daily_summary table"]
        D4["sessions table"]
        D5["associates table"]
    end

    R1 -->|"Bulk INSERT"| D1
    R1 -->|"BackgroundTask"| S1
    S1 -->|"SELECT"| D1
    S1 -->|"INSERT"| D2
    S1 -->|"Calls"| S2
    S2 -->|"SELECT"| D2
    S2 -->|"UPSERT"| D3

    R2 -->|"INSERT/UPDATE"| D4

    R3 -->|"SELECT JOIN"| D2
    R3 -->|"SELECT"| D3
    R3 -->|"SELECT"| D5

    R4 -->|"SELECT"| D3
    R4 -->|"SELECT"| D2

    R5 --> S3 -->|"GET /ai/insights"| AIE2["AI Engine\n:8001"]
```

---

## 7. Database Schema — Entity Relationship

```mermaid
erDiagram
    ASSOCIATES {
        varchar id PK
        varchar name
        varchar team
        varchar process
        timestamptz created_at
    }

    SESSIONS {
        varchar id PK
        varchar associate_id FK
        timestamptz started_at
        timestamptz ended_at
        int total_idle_seconds
        varchar agent_version
    }

    EVENTS {
        serial id PK
        varchar associate_id
        varchar session_id FK
        varchar claim_id
        varchar event_type
        varchar app_name
        varchar window_title
        timestamptz timestamp
        boolean is_idle
        timestamptz received_at
    }

    CLAIM_TIMELINES {
        serial id PK
        varchar claim_id
        varchar associate_id FK
        varchar session_id FK
        varchar app_name
        timestamptz started_at
        timestamptz ended_at
        int duration_seconds
        boolean is_idle
        text[] nva_flags
        int nva_seconds
    }

    DAILY_SUMMARY {
        serial id PK
        varchar associate_id FK
        date date
        varchar session_id FK
        int total_claims
        int total_productive_seconds
        int total_idle_seconds
        int total_nva_seconds
        int avg_claim_time_seconds
        float transactions_per_hour
        float productive_percent
        float idle_percent
        float nva_percent
        timestamptz login_time
        timestamptz logout_time
    }

    ASSOCIATES ||--o{ SESSIONS : "has"
    ASSOCIATES ||--o{ CLAIM_TIMELINES : "works on"
    ASSOCIATES ||--o{ DAILY_SUMMARY : "summarized in"
    SESSIONS ||--o{ EVENTS : "generates"
    SESSIONS ||--o{ CLAIM_TIMELINES : "contains"
    SESSIONS ||--|| DAILY_SUMMARY : "summarized as"
```

---

## 8. Timeline Builder — Core Algorithm

```mermaid
flowchart TD
    A["Start: process_session(session_id)"] --> B
    B["Fetch all events for session\nORDER BY timestamp ASC"]
    B --> C["Initialize state:\ncurrent_claim = null\ncurrent_app = null\nseg_start = null\nopen_segments = {}"]

    C --> D["Loop through events"]

    D --> E{event_type?}

    E -->|SESSION_START| F["seg_start = event.timestamp\ncurrent_app = 'None'"]
    E -->|APP_SWITCH| G["Close current segment\n→ INSERT claim_timelines\n(claim_id, app_name, started_at,\n ended_at=event.ts, duration)\nOpen new: seg_start = event.ts\ncurrent_app = event.app_name"]
    E -->|CLAIM_SET| H["current_claim = event.claim_id"]
    E -->|CLAIM_SWITCH| I["Close all open segments\nfor old claim\ncurrent_claim = new claim_id"]
    E -->|CLAIM_CLOSE| J["Close segment for that claim\ncurrent_claim = null"]
    E -->|IDLE_START| K["Mark current open segment\nis_idle = true"]
    E -->|IDLE_END| L["Mark is_idle = false\nfor next segment"]
    E -->|SESSION_END| M["Close ALL open segments\nended_at = event.timestamp"]

    F --> D
    G --> D
    H --> D
    I --> D
    J --> D
    K --> D
    L --> D
    M --> N["Trigger compute_daily_summary(session_id)"]
    N --> O["UPSERT daily_summary table"]
    O --> P["Call POST /ai/analyze-claims\n(send built timelines)"]
    P --> Q["Store NVA flags back\nUPDATE claim_timelines"]
    Q --> Z["Done ✓"]
```

---

## 9. AI Engine — NVA Detection Flow

```mermaid
flowchart TD
    subgraph INPUT["Input"]
        CT["Claim Timeline\n{claim_id, segments[]}"]
    end

    subgraph RULES["5 NVA Rules Applied in Order"]
        R1{"Rule 1\nExcel > 30%\nof claim time?"}
        R2{"Rule 2\nApp switches\n> 5 in claim?"}
        R3{"Rule 3\nIdle > 2 min\nwhile claim open?"}
        R4{"Rule 4\nClaim reopened\nwithin 30 min?"}
        R5{"Rule 5\nClaim time >\n2× team avg?"}
    end

    subgraph OUTPUT["Output per Claim"]
        OUT["nva_flags: [EXCEL_OVERUSE, APP_SWITCHING]\nnva_seconds: 255\nnva_percent: 38.6%\napp_breakdown: {...}"]
    end

    CT --> R1
    R1 -->|Yes| FLAG1["Flag: EXCEL_OVERUSE\nnva_seconds += excel_seconds"]
    R1 -->|No| R2
    FLAG1 --> R2
    R2 -->|Yes| FLAG2["Flag: APP_SWITCHING\nnva_seconds += switch_overhead"]
    R2 -->|No| R3
    FLAG2 --> R3
    R3 -->|Yes| FLAG3["Flag: IDLE_IN_TX\nnva_seconds += idle_seconds"]
    R3 -->|No| R4
    FLAG3 --> R4
    R4 -->|Yes| FLAG4["Flag: REWORK\nnva_seconds += rework_time"]
    R4 -->|No| R5
    FLAG4 --> R5
    R5 -->|Yes| FLAG5["Flag: OUTLIER_CLAIM"]
    R5 -->|No| MERGE
    FLAG5 --> MERGE["Merge all flags\nCompute totals"]
    MERGE --> OUT
```

---

## 10. Gemini Insights — Generation Flow

```mermaid
sequenceDiagram
    participant DASH as 🌐 Dashboard
    participant API as 🔌 FastAPI Backend
    participant AIE as 🤖 AI Engine
    participant CACHE as 🕐 1-hr Cache
    participant GEM as ✨ Gemini API
    participant FB as 📄 Fallback JSON

    DASH->>API: GET /api/insights
    API->>AIE: GET /ai/insights (proxy)
    AIE->>CACHE: Is cache fresh? (< 1 hour old)

    alt Cache HIT
        CACHE-->>AIE: Return cached insights
        AIE-->>API: insights[]
        API-->>DASH: InsightsResponse
    else Cache MISS
        AIE->>AIE: team_aggregator.aggregate(today's NVA data)
        AIE->>GEM: generate_content(prompt + team_summary JSON)

        alt Gemini responds OK
            GEM-->>AIE: Raw text response (JSON string)
            AIE->>AIE: json.loads(response) → insights[]
            AIE->>CACHE: Store with timestamp
            AIE-->>API: insights[]
            API-->>DASH: InsightsResponse ✅
        else Gemini error / timeout
            GEM-->>AIE: Error / 429 Rate Limit
            AIE->>FB: Load mock_insights.json
            FB-->>AIE: Hardcoded insights
            AIE-->>API: fallback insights[]
            API-->>DASH: InsightsResponse ⚠️ (with "cached" flag)
        end
    end
```

---

## 11. Dashboard — Component & Data Flow

```mermaid
graph TD
    subgraph APP["App.tsx — React Router"]
        ROUTER["React Router v6\n/ → /associate/:id\n/team\n/insights"]
    end

    subgraph LAYOUT["Layout"]
        SIDEBAR["Sidebar.tsx\nNav + Associate Selector"]
        HEADER["Header.tsx\nTitle + Last Updated + Refresh"]
    end

    subgraph PAGE1["Page: Associate"]
        ACC["ActiveClaimCard.tsx\n⏱️ Live ticking timer"]
        DSB["DailySummaryBar.tsx\n📊 KPI strip"]
        CGC["ClaimGanttChart.tsx\n📊 Recharts horizontal bars"]
        CDB["ClaimDetailBreakdown.tsx\n📊 App breakdown + NVA flags"]
        APC1["AppPieChart.tsx\n🥧 Donut chart"]
    end

    subgraph PAGE2["Page: Team"]
        TTB["TeamTable.tsx\n👥 Live sortable table"]
        NVL["NVALeaderboard.tsx\n📊 Horizontal bar chart"]
        APC2["AppPieChart.tsx\n🥧 Team-level donut"]
    end

    subgraph PAGE3["Page: Insights"]
        IC1["InsightCard.tsx 🔴"]
        IC2["InsightCard.tsx 🟡"]
        IC3["InsightCard.tsx 🟢"]
        NVL2["NVALeaderboard.tsx"]
        APC3["AppPieChart.tsx"]
    end

    subgraph APILAYER["API Layer (client.ts)"]
        M["USE_MOCK toggle"]
        MOCK["mock.ts\n(static JSON)"]
        REAL["axios → FastAPI :8000"]
        M -->|true| MOCK
        M -->|false| REAL
    end

    ROUTER --> PAGE1
    ROUTER --> PAGE2
    ROUTER --> PAGE3
    SIDEBAR --> ROUTER

    PAGE1 -->|"fetchAssociateToday(id)\nfetchAssociateClaims(id)\npoll every 30s"| APILAYER
    PAGE2 -->|"fetchTeamOverview()\nfetchNVASummary()\npoll every 30s"| APILAYER
    PAGE3 -->|"fetchInsights()\nfetchNVASummary()\non mount + refresh btn"| APILAYER

    CGC -->|"onClaimSelect(claim_id)"| CDB
    TTB -->|"onRowClick(associate_id)"| ROUTER
```

---

## 12. Deployment Topology

```mermaid
graph TB
    subgraph ASSOC_PCS["Associate PCs (N machines)"]
        EXE1["TMS-Agent.exe\nEMP001"]
        EXE2["TMS-Agent.exe\nEMP002"]
        EXE3["TMS-Agent.exe\nEMP003"]
    end

    subgraph SERVER["Server / Docker Host"]
        DC["docker-compose up"]

        subgraph CONTAINERS["Containers"]
            CONT_API["tms-api\nFastAPI :8000"]
            CONT_AI["tms-ai\nAI Engine :8001"]
            CONT_DB["tms-db\nPostgreSQL :5432"]
        end

        DC --> CONT_API
        DC --> CONT_AI
        DC --> CONT_DB
        CONT_API <--> CONT_DB
        CONT_API <--> CONT_AI
    end

    subgraph MANAGERS["Manager Browsers"]
        MGR1["Manager 1\nChrome → localhost:5173"]
        MGR2["Manager 2\nChrome → localhost:5173"]
    end

    subgraph FRONTEND["Dashboard (Static Build)"]
        VITE["Vite Build\nnpm run build\n→ dist/ served by API\nor Nginx"]
    end

    EXE1 -->|"POST /api/events\nHTTP"| CONT_API
    EXE2 -->|"POST /api/events\nHTTP"| CONT_API
    EXE3 -->|"POST /api/events\nHTTP"| CONT_API

    MGR1 -->|"GET /api/*\n:8000"| CONT_API
    MGR2 -->|"GET /api/*\n:8000"| CONT_API

    CONT_AI -->|"Gemini 1.5 Flash\nHTTPS"| GCP["☁️ Google Cloud\nGemini API"]
```

---

## 13. End-to-End Workflow — Single Claim Lifecycle

```mermaid
sequenceDiagram
    participant ASSOC as 👤 Associate
    participant AGENT as ⚙️ Agent
    participant CLAIM_APP as 🖥️ Claim Platform
    participant PORTAL as 🌐 Payer Portal
    participant EXCEL as 📊 Excel
    participant API2 as 🔌 Backend API
    participant AIE2 as 🤖 AI Engine
    participant DASH2 as 📊 Dashboard

    Note over ASSOC,DASH2: 09:00 — Associate starts work
    ASSOC->>CLAIM_APP: Opens Claim Platform
    CLAIM_APP->>AGENT: Foreground window = Claim Platform
    AGENT->>AGENT: Regex scan window title → no CLM pattern
    AGENT->>ASSOC: 💬 Dialog: "Which claim are you working on?"
    ASSOC->>AGENT: Selects CLM1003
    AGENT->>API2: POST /api/events [SESSION_START, CLAIM_SET(CLM1003)]

    Note over ASSOC,DASH2: 09:05 — Working on CLM1003
    ASSOC->>CLAIM_APP: Reviews claim details (2m 10s)
    ASSOC->>PORTAL: Switches to Payer Portal
    PORTAL->>AGENT: Foreground = Chrome (Payer Portal)
    AGENT->>API2: POST /api/events [APP_SWITCH(Chrome, CLM1003)]

    ASSOC->>PORTAL: Checks eligibility (3m 40s)
    ASSOC->>EXCEL: Opens Excel tracker
    EXCEL->>AGENT: Foreground = EXCEL.EXE
    AGENT->>API2: POST /api/events [APP_SWITCH(Excel, CLM1003)]

    ASSOC->>EXCEL: Updates data (4m 15s)
    ASSOC->>CLAIM_APP: Back to Claim Platform
    CLAIM_APP->>AGENT: Foreground = Claim Platform
    AGENT->>API2: POST /api/events [APP_SWITCH(Claim Platform, CLM1003)]

    ASSOC->>CLAIM_APP: Updates outcome, closes CLM1003

    Note over API2,AIE2: Backend processes session
    API2->>API2: timeline_builder.process_session()
    API2->>AIE2: POST /ai/analyze-claims (CLM1003 timeline)
    AIE2->>AIE2: Excel 4m15s = 31% → Flag EXCEL_OVERUSE
    AIE2->>AIE2: 3 app switches → below threshold, no flag
    AIE2-->>API2: {nva_flags: [EXCEL_OVERUSE], nva_seconds: 255}
    API2->>API2: UPDATE claim_timelines SET nva_flags

    Note over DASH2: Manager views dashboard
    DASH2->>API2: GET /api/associate/EMP001/today
    API2-->>DASH2: CLM1003: 13m35s total, 31% Excel, NVA: 255s
    DASH2->>DASH2: Renders Gantt + Donut + NVA flags ⚠️

    DASH2->>API2: GET /api/insights
    API2->>AIE2: GET /ai/insights
    AIE2->>AIE2: Gemini prompt with team data
    AIE2-->>DASH2: "Excel dependency at 31% — automate data transfer"
```

---

## 14. Error Handling & Resilience

```mermaid
flowchart TD
    subgraph AGENT_ERR["Agent Error Handling"]
        A1["Backend unreachable"] --> A2["Queue to event_queue.jsonl\n(local disk)"]
        A2 --> A3["Retry on next\nsuccessful connection"]

        B1["Dialog skipped by user"] --> B2["Activity tracked\nunder claim_id = null\n(orphan events)"]

        C1["Auto-detect fails"] --> C2["Show dialog\n(fallback)"]
    end

    subgraph BACKEND_ERR["Backend Error Handling"]
        D1["Duplicate events received"] --> D2["INSERT ON CONFLICT\nDO NOTHING\n(idempotent)"]

        E1["AI Engine down"] --> E2["Timeline built without\nNVA flags\nnva_flags = []"]
        E2 --> E3["NVA analysis runs\nwhen AI recovers\n(retroactive update)"]

        F1["Malformed event JSON"] --> F2["Log + discard\n(400 Bad Request)"]
    end

    subgraph AI_ERR["AI Engine Error Handling"]
        G1["Gemini API error\nor 429 rate limit"] --> G2["Return fallback\nmock_insights.json"]
        G2 --> G3["Add 'cached' flag\nin response"]

        H1["Team NVA data empty\n(no timelines yet)"] --> H2["Return empty insights\nwith message:\n'Not enough data yet today'"]
    end

    subgraph DASH_ERR["Dashboard Error Handling"]
        I1["API unreachable\n(fetch fails)"] --> I2["Show last cached data\n+ 'Data may be stale' banner"]
        I2 --> I3["Retry on next\n30-second poll"]

        J1["USE_MOCK = true"] --> J2["Always uses\nstatic mock.ts data\n(never fails)"]
    end
```

---

## 15. MVP — What's In, What's Out

| Feature | ✅ In MVP | Reason |
|---|---|---|
| App switch tracking | ✅ | Core requirement |
| Idle time detection | ✅ | Core KPI |
| Claim prompt dialog | ✅ | Primary claim detection |
| Window title regex (CLM\d+) | ✅ | Simple auto-detect |
| Session start/end | ✅ | Core requirement |
| Claim timeline builder | ✅ | Core requirement |
| 5 NVA rules (rule-based) | ✅ | No ML needed |
| KPI calculator (all 7 KPIs) | ✅ | Core requirement |
| Gemini AI insights (3 cards) | ✅ | Key differentiator |
| Associate dashboard | ✅ | Core dashboard |
| Team overview | ✅ | Core dashboard |
| Insights page | ✅ | Key differentiator |
| 30-second polling | ✅ | Sufficient for MVP |
| Local event fallback queue | ✅ | Resilience |
| System tray icon | ✅ | UX essential |
| DOM/URL browser claim detection | ❌ Skip | Complex, post-MVP |
| UI Automation / OCR | ❌ Skip | Complex, post-MVP |
| WebSocket real-time | ❌ Skip | Polling sufficient |
| Before vs. After comparison | ❌ Skip | Needs baseline history |
| Automation opportunity scorer | ❌ Skip | Post-MVP |
| Admin panel | ❌ Skip | Post-MVP |
| Multi-client/process hierarchy | ❌ Skip | Post-MVP |
