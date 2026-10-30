@echo off
setlocal EnableDelayedExpansion
title TMS Desktop Agent - Update & Status Check

echo ========================================================
echo       TMS Desktop Agent - Update & Status Check
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command "
$runtime = $null
if (Test-Path '%~dp0.agent_runtime.json') {
    try { $runtime = Get-Content '%~dp0.agent_runtime.json' | ConvertFrom-Json } catch {}
}
if ($runtime -and $runtime.pid) {
    $proc = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host '[STATUS] TMS Desktop Agent is ACTIVE (PID: ' $runtime.pid ', Version: v' $runtime.version ')' -ForegroundColor Green
        Write-Host '[STATUS] You already have the latest version downloaded and running.' -ForegroundColor Cyan
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show('TMS Desktop Agent is already downloaded and running the latest version (v' + $runtime.version + ').`n`nThe background agent is active and monitoring.', 'TMS Desktop Agent - Up to Date', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
        exit 10
    }
}
exit 0
"

if %ERRORLEVEL% equ 10 (
    goto :done
)

echo No active agent detected. Launching latest TMS Desktop Agent...
call "%~dp0Start-Agent.bat"

:done
exit /b 0
