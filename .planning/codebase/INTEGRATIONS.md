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

## 2. Aiven Cloud PostgreSQL Database
- **Cluster**: `pg-6e76a1e-tms-novaarc`
- **Host**: `pg-6e76a1e-tms-novaarc.h.aivencloud.com:10058`
- **Engine**: PostgreSQL 18.6 with SSL (`sslmode=require`)
- **Tables**:
  - `associates`: Registered billing employees.
  - `sessions`: Login sessions, active/idle time tracking.
  - `events`: Second-by-second activity audit log.
  - `employee_claims`: Assigned claims, status, and worked times.
  - `claim_timelines`: Dwell times per application and claim.
  - `daily_summaries`: Aggregate AHT, total claims, productivity metrics.
  - `claim_benchmarks`: Standard expected handling times per status/type.

## 3. Zoho Catalyst AppSail (Cloud Backend Host)
- **AppSail ID**: `tms-backend`
- **Public Domain**: `https://tms-backend-50047231328.development.catalystappsail.in`
- **Stack**: Python 3.11 with FastAPI and Uvicorn.
- **Config**: `backend/app-config.json` containing live `DATABASE_URL` pointing directly to Aiven Cloud.

## 4. Microsoft Excel Reporting Engine
- **Target File**: `TMS_Completed_Claims.xlsx`
- **Trigger**: Generated / appended upon claim completion via `openpyxl`.
- **Columns**: Claim ID, Associate ID, Claim Type, Final Status, Handling Time (Minutes), Start Timestamp, Completion Timestamp.
