# Project Roadmap & Milestones

## Completed Milestones
- [x] **Milestone 1: Desktop Agent Telemetry & 3-Pillar Page Identification**
  - High-performance Win32 event detection for active window, website name, page header, and operational task purpose.
  - Idle monitoring (30s threshold) with automatic idle transition events.
- [x] **Milestone 2: Aiven PostgreSQL Migration**
  - Complete removal of legacy Supabase connections.
  - Setup and table creation on Aiven Cloud PostgreSQL 18.6 with SSL encryption.
  - Connection pooling and auto-reconnect engine.
- [x] **Milestone 3: Dialog Modal Engine & Locking**
  - Keyboard and mouse hook constraints preventing application hopping while dialog is unassigned.
  - Minimized floating chip mode for checking claims without losing modal state.
- [x] **Milestone 4: Taskbar Preservation & Race Condition Elimination**
  - Elimination of OS taskbar hiding (`ShowWindow(0)` removed).
  - Removal of synchronous network requests from Tkinter setup.
  - Foreground active window verification preventing white box over external applications.
  - Robust logout and re-login detection via hash route parsing.

## Active & Upcoming Milestones
- [ ] **Milestone 5: Production Deployment & Verification**
  - Deploy updated backend to Catalyst AppSail pointing to Aiven PostgreSQL.
  - Deliver signed/unblocked binary and Python launcher (`Start-Agent.bat`).
  - Git branch merge: `gokul-AHT` merged into `main` and pushed to remote origin.
- [ ] **Milestone 6: Cross-Associate Fleet Analytics**
  - Supervisor views across multiple billing associates (`EMP101`, `EMP102`, etc.).
  - Automated weekly SLA and denial turnaround forecasting.
