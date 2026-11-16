# System Integrations & External Services

## 1. NovaArc RCM Web Platform
- **URL**: `https://krishna-caare.github.io/Novaarc-RCM/`
- **Architecture**: Single Page Application (SPA) using hash-based routing:
  - `#/login` (Pre-authentication landing)
  - `#/dashboard` (Operations overview)
  - `#/claims` (Active claims grid, adjudication, status updates)
  - `#/queues` (Priority AR queues)
- **Integration Points**:
  - Windows UIAutomation tree inspection for address bar and active elements.
  - REST JSON fallback for claims list and individual claim verification.

## 2. Hostinger VPS PostgreSQL Database
- **Host**: `127.0.0.1:5432` (Hostinger VPS local loopback)
- **Database**: `tms_db` (owned by `tms_user`)
- **Engine**: Dedicated PostgreSQL with asyncpg connection
- **Tables**:
  - `associates`: Registered billing employees.
  - `sessions`: Login sessions, active/idle time tracking.
  - `events`: Second-by-second activity audit log.
  - `employee_claims`: Assigned claims, status, and worked times.
  - `claim_timelines`: Dwell times per application and claim.
  - `daily_summaries`: Aggregate AHT, total claims, productivity metrics.
  - `claim_benchmarks`: Standard expected handling times per status/type.

## 3. Hostinger VPS Backend Host
- **Public Domain / URL**: `http://187.127.207.41:8080`
- **Internal Microservice**: Port 8005 via Nginx reverse proxy on port 8080
- **Stack**: Python 3.12/3.11 with FastAPI and Uvicorn managed via systemd (`tms.service`).
- **Resource Constraints**: Capped at 1.5GB RAM maximum to safeguard existing host applications.

## 4. Microsoft Excel Reporting Engine
- **Target File**: `TMS_Completed_Claims.xlsx`
- **Trigger**: Generated / appended upon claim completion via `openpyxl`.
- **Columns**: Claim ID, Associate ID, Claim Type, Final Status, Handling Time (Minutes), Start Timestamp, Completion Timestamp.

