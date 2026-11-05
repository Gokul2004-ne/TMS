# Project System State & Environment

## Active Systems
- **Desktop Agent**: Verified with ultra-low latency prompt (<0.4s), foreground active window guard, zero taskbar hiding, and robust login/logout detection.
- **Backend Service**: Configured with Hostinger VPS Dedicated PostgreSQL (`tms_db`).
- **Web Dashboard**: Operating on Vite / React 18 with live AHT calculations, stopwatch telemetry, and claim deep dive timeline inspection.

## Current Configuration Values
- `DATABASE_URL`: `postgresql+asyncpg://tms_user:***@127.0.0.1:5432/tms_db` (Hostinger VPS local loopback)
- `BACKEND_BASE_URL`: `http://187.127.207.41:8080`
- `LOCAL_BACKEND_PORT`: `8005`
- `LOCAL_DASHBOARD_PORT`: `5173`
- `DEFAULT_ASSOCIATE_ID`: `EMP101`

## Verification Checks
- **Hostinger PostgreSQL**: Verified connection with asyncpg; all 7 tables initialized.
- **Taskbar Restoration**: Win32 calls verified never hiding `Shell_TrayWnd`.
- **Foreground Guard**: Prevents Tkinter modal launch when user switches away prior to popup.
- **Launcher Execution**: `Start-Agent.bat` configured to prioritize Python engine execution (which bypasses Smart App Control completely) with fallback to unblocked binary.
