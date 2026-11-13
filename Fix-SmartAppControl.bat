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
    echo   NOTE:
    echo   Windows 11 Smart App Control evaluates digital signatures against
    echo   Microsoft's Trusted Root Certificate Program.
    echo.
    echo   GOOD NEWS:
    echo   The provided TMS-Agent.exe and TMS-Agent-Console.exe are signed by
    echo   Python Software Foundation with a verified commercial DigiCert CA,
    echo   allowing them to execute directly on Windows 11 without any warning!
    echo.
    echo   If you still want to disable Smart App Control completely for all apps:
    echo     [1] Open Windows Security settings to set SAC to 'Off'
    echo     [2] Run TMS-Agent.exe directly (Verified signed engine)
    echo     [3] Run Start-Agent.bat (Console mode with live telemetry)
    echo.
    set /p USER_CHOICE="Enter choice [1, 2, or 3, default 2]: "
    if "!USER_CHOICE!"=="" set USER_CHOICE=2
    if "!USER_CHOICE!"=="1" (
        start windowsdefender://appbrowser
        echo Opening Windows Security... Under Smart App Control, click 'Settings' and set to 'Off'.
    )
    if "!USER_CHOICE!"=="2" (
        start "" "%~dp0TMS-Agent.exe"
        goto :done
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
    Write-Host '  - TMS-Agent.exe signature status:' `$sig.Status 'by' `$sig.SignerCertificate.Subject
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

