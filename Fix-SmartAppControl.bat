@echo off
setlocal EnableDelayedExpansion
title Smart App Control Fix & Diagnostics - TMS Desktop Agent

echo ========================================================================
echo         NovaArc TMS Desktop Agent - Security & Launch Troubleshooter
echo ========================================================================
echo.
echo [Step 1/3] Unblocking all application files in this folder...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1
echo   - Done: Mark-of-the-Web (Zone.Identifier) removed from all files.
echo.

echo [Step 2/3] Checking Windows 11 Smart App Control (SAC) state...
set "SAC_STATE=0x0"
for /f "tokens=3" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy" /v VerifiedAndReputablePolicyState 2^>nul') do (
    set "SAC_STATE=%%A"
)

if "%SAC_STATE%"=="0x1" (
    echo   - Smart App Control: [ACTIVE / ENFORCING]
    echo.
    echo   WHAT HAPPENED:
    echo   Windows 11 Smart App Control actively blocks proprietary internal apps
    echo   because they are not published on the Microsoft Store.
    echo.
    echo   HOW TO SOLVE IN 20 SECONDS:
    echo   1. Press [Y] below to open Windows Security directly.
    echo   2. In Windows Security, click "Smart App Control settings".
    echo   3. Change the switch from "On" to "Off".
    echo   4. Once switched Off, double-clicking TMS-Agent.exe will immediately work!
    echo.
    set /p OPEN_SEC="Open Windows Security Settings now? [Y/N, default Y]: "
    if /i "!OPEN_SEC!"=="" set OPEN_SEC=Y
    if /i "!OPEN_SEC!"=="Y" (
        start windowsdefender://appbrowser
        echo Opening Windows Security App & Browser Control...
    )
) else if "%SAC_STATE%"=="0x2" (
    echo   - Smart App Control: [EVALUATION MODE]
    echo   - SAC is monitoring but not actively blocking signed/unblocked binaries.
) else (
    echo   - Smart App Control: [OFF / INACTIVE]
    echo   - No Smart App Control policy block detected.
)

echo.
echo [Step 3/3] Verifying Authenticode Digital Signature...
powershell -NoProfile -ExecutionPolicy Bypass -Command @"
`$sig = Get-AuthenticodeSignature '%~dp0TMS-Agent.exe' -ErrorAction SilentlyContinue
if (`$sig.SignerCertificate) {
    Write-Host '  - TMS-Agent.exe is digitally signed by:' `$sig.SignerCertificate.Subject
} else {
    Write-Host '  - TMS-Agent.exe is not signed.'
}
"@

echo.
echo ========================================================================
echo Troubleshooter complete!
echo Launch the agent using:
echo   1. Start-Agent.bat (Recommended - with live logs)
echo   2. Start-Agent-Silent.vbs (Silent background tracking)
echo   3. TMS-Agent.exe (Direct binary launch)
echo ========================================================================
echo.
pause
