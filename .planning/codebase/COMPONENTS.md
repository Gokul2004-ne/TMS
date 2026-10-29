# Component Directory & Responsibilities

## 1. Desktop Telemetry Agent (`agent/`)
- [agent/main.py](file:///b:/Projects/TMS_full_working/TMS/agent/main.py):
  - Primary runtime loop orchestrator.
  - Manages session lifecycle (`SESSION_START`, `SESSION_END`), idle detection transitions, global hotkeys (`Ctrl+Shift+C`), and dual-sync event queuing.
  - Controls modal prompting logic with strict foreground guards.
- [agent/dialog.py](file:///b:/Projects/TMS_full_working/TMS/agent/dialog.py):
  - Custom Tkinter modal dialog (`ClaimDialog`).
  - Low-level Win32 keyboard (`WH_KEYBOARD_LL`) and mouse (`WH_MOUSE_LL`) hooks enforcing focus while modal.
  - Minimized floating chip mode for examining platform claims.
  - Completely preserves the OS desktop taskbar.
- [agent/tracker.py](file:///b:/Projects/TMS_full_working/TMS/agent/tracker.py):
  - Window title, process, and UIAutomation address bar URL extractor.
  - 3-Pillar page identity resolution (`clean_url`, `website_name`, `page_header`, `used_for`).
  - Exact route and hash parsing (`#/login`, `#/dashboard`, `#/claims`) with sub-0.15s cache invalidation.
- [agent/claim_context.py](file:///b:/Projects/TMS_full_working/TMS/agent/claim_context.py):
  - Local state holder for currently active claim ID, claim type, target minutes/seconds, and worked claim history.
- [agent/tray.py](file:///b:/Projects/TMS_full_working/TMS/agent/tray.py):
  - Windows System Tray icon with dynamic tooltip showing active claim and associate ID.

## 2. Backend Service (`backend/`)
- [backend/main.py](file:///b:/Projects/TMS_full_working/TMS/backend/main.py):
  - FastAPI application exposing REST endpoints:
    - `POST /api/events` (Telemetry ingestion with batching)
    - `POST /api/sessions/start` & `POST /api/sessions/end`
    - `GET /api/associate/{id}/today` (KPI calculation, AHT, claim cards)
    - `POST /api/associate/{id}/active-claim` (Sync active claim across dashboard & agent)
    - `POST /api/associate/{id}/claims/{claim_id}/complete` (Mark claim completed and export to Excel)
    - `POST /api/associate/{id}/claims/{claim_id}/status` (Reconcile platform status changes)
    - `GET /api/claims/{claim_id}/timeline` (Chronological event timeline for Claim Deep Dive)
- [backend/database.py](file:///b:/Projects/TMS_full_working/TMS/backend/database.py):
  - Async SQLAlchemy engine configured for **Aiven Cloud PostgreSQL 18.6** with SSL verification (`ssl.CERT_NONE`, `statement_cache_size=0`).
  - Declarative models: `Associate`, `Session`, `Event`, `EmployeeClaim`, `ClaimTimeline`, `DailySummary`, `ClaimBenchmark`.
- [backend/app-config.json](file:///b:/Projects/TMS_full_working/TMS/backend/app-config.json):
  - Catalyst AppSail deployment manifest specifying Python 3.11 runtime, 512MB RAM, port 9000, and Aiven PostgreSQL database connection.

## 3. Web Dashboard (`dashboard/`)
- [dashboard/src/App.tsx](file:///b:/Projects/TMS_full_working/TMS/dashboard/src/App.tsx):
  - Main single-page application orchestrating KPI view, live active claim stopwatch, claim list, and deep dive tabs.
- [dashboard/src/components/ClaimDeepDive.tsx](file:///b:/Projects/TMS_full_working/TMS/dashboard/src/components/ClaimDeepDive.tsx):
  - Detailed chronological timeline visualizing second-by-second application switches, page headers, URLs, and dwell times.
