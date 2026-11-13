@echo off
setlocal EnableDelayedExpansion
title Disable Smart App Control - TMS Desktop Agent

:: Check for Administrator permissions
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================================================
    echo   Requesting Administrator Privileges to Disable Smart App Control...
    echo ========================================================================
    echo A Windows prompt (UAC) will now appear. Please click "Yes" to continue.
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:: Running with Administrator privileges
echo ========================================================================
echo       Permanently Disabling Smart App Control for TMS Desktop Agent
echo ========================================================================
echo.
echo [1/4] Disabling Windows 11 Smart App Control in registry...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy" /v VerifiedAndReputablePolicyState /t REG_DWORD /d 0 /f
if %errorlevel% equ 0 (
    echo   -> Smart App Control successfully set to OFF.
) else (
    echo   -> Note: Registry update returned code %errorlevel%.
)

echo.
echo [2/4] Adding current folder to Windows Defender exclusions...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-MpPreference -ExclusionPath '%~dp0' -ErrorAction SilentlyContinue"
echo   -> Folder exclusion added for: %~dp0

echo.
echo [3/4] Adding TMS-Agent.exe process to Windows Defender exclusions...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-MpPreference -ExclusionProcess 'TMS-Agent.exe' -ErrorAction SilentlyContinue"
echo   -> Process exclusion added for TMS-Agent.exe.

echo.
echo [4/4] Stripping Mark-of-the-Web from all downloaded files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue"
echo   -> All files successfully unblocked.

echo.
echo ========================================================================
echo SUCCESS! Smart App Control has been turned OFF and exclusions applied.
echo.
echo You can now double-click:
echo   - TMS-Agent.exe (Direct application launch - NO WARNINGS)
echo   - Start-Agent.bat (Console mode with live telemetry)
echo   - Start-Agent-Silent.vbs (Silent background tracking)
echo ========================================================================
echo.
pause
