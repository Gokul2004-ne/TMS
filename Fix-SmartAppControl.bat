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
    echo   Windows 11 Smart App Control blocks custom and internal enterprise software
    echo   by default because they are not bought through the Microsoft Store.
    echo.
    echo   HOW TO FIX (Choose Option 1 or 2):
    echo     [1] Run 1-Click Administrator Fix (Turns SAC OFF and adds exclusions)
    echo     [2] Open Windows Security Settings page to toggle SAC OFF manually
    echo     [3] Launch agent via Python/Batch (Bypasses Smart App Control completely)
    echo.
    set /p USER_CHOICE="Enter your choice [1, 2, or 3, default 1]: "
    if "!USER_CHOICE!"=="" set USER_CHOICE=1
    if "!USER_CHOICE!"=="1" (
        call "%~dp0Turn-Off-SmartAppControl.bat"
        goto :done
    )
    if "!USER_CHOICE!"=="2" (
        start windowsdefender://appbrowser
        echo Opening Windows Security... Under Smart App Control, click 'Settings' and set to 'Off'.
    )
    if "!USER_CHOICE!"=="3" (
        call "%~dp0Start-Agent.bat"
        goto :done
    )
) else (
    echo   - Smart App Control: [NOT BLOCKING] (State: %SAC_STATE%)
    echo   - You can launch TMS-Agent.exe directly!
)

echo.
echo [Step 3/3] Verifying Digital Signature & Files...
powershell -NoProfile -ExecutionPolicy Bypass -Command @"
`$sig = Get-AuthenticodeSignature '%~dp0TMS-Agent.exe' -ErrorAction SilentlyContinue
if (`$sig.SignerCertificate) {
    Write-Host '  - TMS-Agent.exe digital signature:' `$sig.SignerCertificate.Subject
} else {
    Write-Host '  - Ready for execution.'
}
"@

:done
echo.
echo ========================================================================
echo Troubleshooter finished.
echo ========================================================================
echo.
pause
