@echo off
setlocal EnableDelayedExpansion
title TMS Desktop Agent

:: 1. Automatically unblock downloaded files to bypass Windows SmartScreen and Smart App Control
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: 2. Terminate any orphaned old agent instances to free up ports and prevent duplicate dialogs
taskkill /F /IM TMS-Agent.exe >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process python, pythonw -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*TMS Desktop Agent*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1

echo ========================================================
echo     Starting TMS Desktop Agent v1.0.1 (Live Cloud Sync)
echo ========================================================
echo Pointing to: https://tms-backend-50047231328.development.catalystappsail.in
set BACKEND_BASE_URL=https://tms-backend-50047231328.development.catalystappsail.in
set BACKEND_URL=https://tms-backend-50047231328.development.catalystappsail.in/api/events
set SESSION_START_URL=https://tms-backend-50047231328.development.catalystappsail.in/api/sessions/start
set SESSION_END_URL=https://tms-backend-50047231328.development.catalystappsail.in/api/sessions/end

set "ASSOC_ID="
set /p ASSOC_ID="Enter Associate ID (Press Enter for default [EMP101], or type EMP102, etc.): "
if "!ASSOC_ID!"=="" set ASSOC_ID=EMP101
set TMS_ASSOCIATE_ID=!ASSOC_ID!

:: 3. Check for Python execution first (immune to Windows Smart App Control blocks)
set "PY_CMD="
where python >nul 2>&1
if !ERRORLEVEL! equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>&1
    if !ERRORLEVEL! equ 0 set "PY_CMD=py"
)

if defined PY_CMD (
    if exist "%~dp0agent\main.py" (
        echo Launching via Python engine - Smart App Control Bypassed...
        !PY_CMD! "%~dp0agent\main.py" --associate !ASSOC_ID!
        goto :done
    )
    if exist "agent\main.py" (
        echo Launching via Python engine - Smart App Control Bypassed...
        !PY_CMD! agent\main.py --associate !ASSOC_ID!
        goto :done
    )
)

:: 4. Fallback to standalone binary
if exist "%~dp0TMS-Agent.exe" (
    echo Launching standalone binary...
    "%~dp0TMS-Agent.exe" --associate !ASSOC_ID!
    goto :done
)
if exist "TMS-Agent.exe" (
    echo Launching standalone binary...
    TMS-Agent.exe --associate !ASSOC_ID!
    goto :done
)

echo [ERROR] Neither Python engine nor TMS-Agent.exe could be located in this directory.
pause
exit /b 1

:done
pause