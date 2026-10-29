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

    subgraph Cloud Infrastructure ["Cloud Backend & Database"]
        AppSail["Catalyst AppSail Backend\n(FastAPI / Python 3.11)"]
        AivenDB[("Aiven Cloud PostgreSQL 18.6\n(SSL Encrypted - port 10058)")]
        Excel["TMS_Completed_Claims.xlsx\n(Automated Daily Export)"]
        
        Agent -->|HTTP POST /api/events| AppSail
        Agent -->|HTTP POST /api/associate/...| AppSail
        AppSail -->|asyncpg + SQLAlchemy| AivenDB
        AppSail -->|openpyxl / pandas| Excel
    end

    subgraph Supervisor & Analytics ["Supervisor Analytics"]
        Dashboard["TMS Web Dashboard\n(React 18 / Tailwind / Vite)"]
        Dashboard -->|HTTP GET /api/associate/EMP101/today| AppSail
        Dashboard -->|Live Telemetry & Stopwatch| AppSail
    end
```

## Architectural Tenets
1. **Zero Disturbance / Zero Lag**: Desktop telemetry operates in an async loop with sub-millisecond local caching, ensuring no stutter for the associate.
2. **Deterministic State Reconciliation**: All claim updates made on NovaArc platform are polled and pushed to Aiven PostgreSQL within 1-2 seconds.
3. **Resilient Data Persistence**: Aiven Cloud PostgreSQL 18.6 serves as the single source of truth for telemetry and audit compliance, backed up continuously.
