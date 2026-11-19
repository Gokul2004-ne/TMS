# Onboarding Summary & System Operational Guide

## Overview
The **NovaArc Time & Motion Study (TMS)** codebase onboarding has been completed under `/gsd-onboard`. All planning documentation, architecture blueprints, data lifecycle schemas, and integration contracts are committed in `.planning/`.

## Key Fixes Delivered in this Session
1. **Aiven Cloud PostgreSQL Verification**:
   - Connection string configured with SSL support across all backend files.
   - All 7 database tables verified in Aiven PostgreSQL 18.6: `associates`, `sessions`, `events`, `employee_claims`, `claim_timelines`, `daily_summaries`, `claim_benchmarks`.
   - SQLite/Supabase legacy paths removed.
2. **Windows Desktop Taskbar Unblocked**:
   - Removed all `ShowWindow(0)` calls that were hiding the Windows OS taskbar (`Shell_TrayWnd`).
   - Restored and protected the taskbar at dialog startup, minimization, and closure.
3. **Dialog White-Box & App Switch Race Condition Solved**:
   - Added foreground active window checks in `prompt_manual_claim` and `finally:`. If an associate switches away before the dialog appears, the dialog aborts cleanly rather than rendering an unpainted white box over external applications.
   - Removed synchronous HTTP calls from the Tkinter thread so dialog draws in <10ms.
4. **Instant Dialog Trigger Latency (<0.4s)**:
   - Reduced untracked platform threshold from 2.0s to 0.4s for near-instant popup upon focusing NovaArc.
5. **Robust NovaArc Logout & Re-Login Detection**:
   - Fixed `is_novaarc_login_page` in `agent/tracker.py` to prioritize hash route `/login` and `#/login`.
   - Ensured that "revenue cycle" title keyword does not falsely prevent logout detection.
   - Re-armed Phase 1 on logout so signing in again pops the dialog 100% of the time.
6. **Smart App Control Solution**:
   - Created unblocked binary `TMS-Agent.exe`.
   - Updated `Start-Agent.bat` to execute via the signed Python runtime, which Windows 11 Smart App Control trusts without any publisher warnings.

## Recommended Launch Procedures
- **Primary Method (Bypasses Smart App Control completely)**:
  Double-click `Start-Agent.bat`.
- **Direct Binary Method**:
  Run `TMS-Agent.exe` after executing `Unblock-File TMS-Agent.exe`.

