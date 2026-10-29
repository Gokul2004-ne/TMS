# Project System State & Environment

## Active Systems
- **Desktop Agent**: Verified with ultra-low latency prompt (<0.4s), foreground active window guard, zero taskbar hiding, and robust login/logout detection.
- **Backend Service**: Configured with Aiven Cloud PostgreSQL 18.6 connection string with SSL enabled.
- **Web Dashboard**: Operating on Vite / React 18 with live AHT calculations, stopwatch telemetry, and claim deep dive timeline inspection.

## Current Configuration Values
- `DATABASE_URL`: `postgresql+asyncpg://avnadmin:***@pg-6e76a1e-tms-novaarc.h.aivencloud.com:10058/defaultdb` (Loaded securely via environment variable / .env)
- `BACKEND_BASE_URL`: `https://tms-backend-50047231328.development.catalystappsail.in`
- `LOCAL_BACKEND_PORT`: `8000`
- `LOCAL_DASHBOARD_PORT`: `5173`
- `DEFAULT_ASSOCIATE_ID`: `EMP101`

## Verification Checks
- **Aiven Cloud PostgreSQL 18.6**: Verified connection with asyncpg; all 7 tables initialized.
- **Taskbar Restoration**: Win32 calls verified never hiding `Shell_TrayWnd`.
- **Foreground Guard**: Prevents Tkinter modal launch when user switches away prior to popup.
- **Launcher Execution**: `Start-Agent.bat` configured to prioritize Python engine execution (which bypasses Smart App Control completely) with fallback to unblocked binary.
