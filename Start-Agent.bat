@echo off
title TMS Desktop Agent
echo ========================================================
echo       Starting TMS Desktop Agent (Live Render Sync)
echo ========================================================
echo Pointing to: https://tms-backend-6l5j.onrender.com
set BACKEND_BASE_URL=https://tms-backend-6l5j.onrender.com
set BACKEND_URL=https://tms-backend-6l5j.onrender.com/api/events
set SESSION_START_URL=https://tms-backend-6l5j.onrender.com/api/sessions/start
set SESSION_END_URL=https://tms-backend-6l5j.onrender.com/api/sessions/end

set /p ASSOC_ID="Enter Associate ID (Press Enter for default [EMP101], or type EMP102, etc.): "
if "%ASSOC_ID%"=="" set ASSOC_ID=EMP101
set TMS_ASSOCIATE_ID=%ASSOC_ID%

if exist "TMS-Agent.exe" (
    TMS-Agent.exe --associate %ASSOC_ID%
) else (
    python agent\main.py --associate %ASSOC_ID%
)
pause
