@echo off
setlocal EnableDelayedExpansion
title Stop TMS Desktop Agent

echo ========================================================
echo       Stopping TMS Desktop Agent Daemon
echo ========================================================

:: 1. Terminate compiled standalone binary
taskkill /F /IM TMS-Agent.exe >nul 2>&1

:: 2. Terminate background Python agent daemon
taskkill /F /IM pythonw.exe >nul 2>&1

:: 3. Clean runtime status lock
if exist "%~dp0.agent_runtime.json" del /f /q "%~dp0.agent_runtime.json" >nul 2>&1

echo ========================================================
echo TMS Desktop Agent successfully stopped.
echo ========================================================
exit /b 0
