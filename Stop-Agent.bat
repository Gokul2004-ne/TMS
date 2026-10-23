@echo off
title Stop TMS Desktop Agent
echo Stopping TMS Desktop Agent daemon...
taskkill /F /IM TMS-Agent.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :59876') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo TMS Desktop Agent stopped.
timeout /t 2 >nul
