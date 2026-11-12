@echo off
setlocal EnableDelayedExpansion
title TMS Desktop Agent Launcher

:: 1. Automatically unblock downloaded files (Removes Mark-of-the-Web to bypass SmartScreen & SAC)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: 2. Terminate any orphaned old agent instances to free up ports and prevent duplicate dialogs
taskkill /F /IM TMS-Agent.exe >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process python, pythonw -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*TMS Desktop Agent*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1

if not "%1"=="/silent" (
    echo ========================================================
    echo     Starting TMS Desktop Agent v1.0.2 (Live Cloud Sync)
    echo ========================================================
    echo Pointing to: http://187.127.207.41:8080
)

set BACKEND_BASE_URL=http://187.127.207.41:8080
set BACKEND_URL=http://187.127.207.41:8080/api/events
set SESSION_START_URL=http://187.127.207.41:8080/api/sessions/start
set SESSION_END_URL=http://187.127.207.41:8080/api/sessions/end

:: 3. Windows 11 Smart App Control (SAC) Detection
set "SAC_STATE=0x0"
for /f "tokens=3" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy" /v VerifiedAndReputablePolicyState 2^>nul') do (
    set "SAC_STATE=%%A"
)

:: 4. Check for Python execution first (immune to Windows Smart App Control blocks)
set "PY_CMD="
where python >nul 2>&1
if !ERRORLEVEL! equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>&1
    if !ERRORLEVEL! equ 0 set "PY_CMD=py"
)

if "%1"=="/silent" (
    where pythonw >nul 2>&1
    if !ERRORLEVEL! equ 0 set "PY_CMD=pythonw"
)

if "%SAC_STATE%"=="0x1" (
    if not "%1"=="/silent" (
        if not defined PY_CMD (
            echo.
            echo [NOTICE] Windows 11 Smart App Control (SAC) is ACTIVE on this PC.
            echo Smart App Control blocks custom enterprise apps unless switched Off.
            echo.
            echo   [1] Open Windows Security to turn Smart App Control OFF (Recommended)
            echo   [2] Continue launch attempt
            echo.
            set "SAC_CHOICE="
            set /p SAC_CHOICE="Enter choice [1 or 2, default 2]: "
            if "!SAC_CHOICE!"=="1" (
                start windowsdefender://appbrowser
                echo Opening Windows Security... In settings, switch Smart App Control to 'Off'.
                pause
            )
        )
    )
)

:: 5. Associate ID Resolution
set "ASSOC_ID="
if exist "%~dp0associate_id.txt" (
    set /p ASSOC_ID=<"%~dp0associate_id.txt"
)
if "!ASSOC_ID!"=="" (
    if "%1"=="/silent" (
        set ASSOC_ID=AUTO
    ) else (
        set /p ASSOC_ID="Enter Associate ID (Press Enter for auto-detected PC identity, or type EMP101, etc.): "
        if "!ASSOC_ID!"=="" set ASSOC_ID=AUTO
    )
)
set TMS_ASSOCIATE_ID=!ASSOC_ID!
if not "!ASSOC_ID!"=="" echo !ASSOC_ID!>"%~dp0associate_id.txt" 2>nul

:: 6. Launch Execution Engine
if defined PY_CMD (
    if exist "%~dp0agent\main.py" (
        if not "%1"=="/silent" echo Launching via Python engine - Smart App Control Bypassed...
        !PY_CMD! "%~dp0agent\main.py" --associate !ASSOC_ID!
        goto :done
    )
    if exist "agent\main.py" (
        if not "%1"=="/silent" echo Launching via Python engine - Smart App Control Bypassed...
        !PY_CMD! agent\main.py --associate !ASSOC_ID!
        goto :done
    )
)

:: Standalone binary
if exist "%~dp0TMS-Agent.exe" (
    if not "%1"=="/silent" echo Launching standalone binary (TMS-Agent.exe)...
    "%~dp0TMS-Agent.exe" --associate !ASSOC_ID!
    goto :done
)
if exist "%~dp0dist\TMS-Agent.exe" (
    if not "%1"=="/silent" echo Launching standalone binary from dist...
    "%~dp0dist\TMS-Agent.exe" --associate !ASSOC_ID!
    goto :done
)
if exist "dist\TMS-Agent.exe" (
    if not "%1"=="/silent" echo Launching standalone binary from dist...
    dist\TMS-Agent.exe --associate !ASSOC_ID!
    goto :done
)
if exist "TMS-Agent.exe" (
    if not "%1"=="/silent" echo Launching standalone binary...
    TMS-Agent.exe --associate !ASSOC_ID!
    goto :done
)

if not "%1"=="/silent" (
    echo [ERROR] Neither Python engine nor TMS-Agent.exe could be located in this directory.
    pause
)
exit /b 1

:done
if not "%1"=="/silent" pause
