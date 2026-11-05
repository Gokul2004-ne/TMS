# Architecture Overview

```mermaid
flowchart TD
    subgraph Associate Desktop ["Associate Desktop (Windows 11)"]
        Browser["Chrome / Edge Browser\n(NovaArc RCM Portal)"]
        Agent["TMS Desktop Agent\n(agent/main.py / TMS-Agent.exe)"]
        Modal["Claim Work Assistant\n(agent/dialog.py)"]
        Tracker["Win32 & UIA Tracker\n(agent/tracker.py)"]
        Tray["System Tray\n(agent/tray.py)"]
        
        Browser -->|Foreground & URL| Tracker
        Tracker -->|Detected Window / Claim| Agent
        Agent -->|Pops Modal On-Demand| Modal
        Modal -->|Claim Context Assigned| Agent
        Agent -->|Status Icon / Exit| Tray
    end

    subgraph Cloud Infrastructure ["Hostinger VPS Backend & Database"]
        HostingerAPI["Hostinger VPS Backend\n(FastAPI / Nginx :8080)"]
        PostgresDB[("Hostinger Dedicated PostgreSQL\n(tms_db - port 5432)")]
        Excel["TMS_Completed_Claims.xlsx\n(Automated Daily Export)"]
        
        Agent -->|HTTP POST /api/events| HostingerAPI
        Agent -->|HTTP POST /api/associate/...| HostingerAPI
        HostingerAPI -->|asyncpg + SQLAlchemy| PostgresDB
        HostingerAPI -->|openpyxl / pandas| Excel
    end

    subgraph Supervisor & Analytics ["Supervisor Analytics"]
        Dashboard["TMS Web Dashboard\n(React 18 / Tailwind / Vite)"]
        Dashboard -->|HTTP GET /api/associate/EMP101/today| HostingerAPI
        Dashboard -->|Live Telemetry & Stopwatch| HostingerAPI
    end
```

## Architectural Tenets
1. **Zero Disturbance / Zero Lag**: Desktop telemetry operates in an async loop with sub-millisecond local caching, ensuring no stutter for the associate.
2. **Deterministic State Reconciliation**: All claim updates made on NovaArc platform are polled and pushed to PostgreSQL within 1-2 seconds.
3. **Resilient Data Persistence**: Hostinger Dedicated PostgreSQL serves as the single source of truth for telemetry and audit compliance, backed up continuously.

