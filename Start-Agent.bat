@echo off
title TMS Desktop Agent
echo ========================================================
echo       Starting TMS Desktop Agent (Live Render Sync)
echo ========================================================
echo Pointing to: https://tms-backend-6l5j.onrender.com
echo.
set /p ASSOC_ID="Enter Associate ID (Press Enter for default, or type EMP101, EMP102, etc.): "
if exist "TMS-Agent.exe" (
    if "%ASSOC_ID%"=="" (
        TMS-Agent.exe
    ) else (
        TMS-Agent.exe --associate %ASSOC_ID%
    )
) else (
    if "%ASSOC_ID%"=="" (
        python agent\main.py
    ) else (
        python agent\main.py --associate %ASSOC_ID%
    )
)
pause
