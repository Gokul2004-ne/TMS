@echo off
setlocal EnableDelayedExpansion
title Create TMS Desktop Shortcut

echo Creating Desktop shortcut for TMS Desktop Agent...
powershell -NoProfile -ExecutionPolicy Bypass -Command @"
`$desktop = [Environment]::GetFolderPath('Desktop')
`$wsh = New-Object -ComObject WScript.Shell
`$lnkPath = Join-Path `$desktop 'TMS Desktop Agent.lnk'
`$lnk = `$wsh.CreateShortcut(`$lnkPath)
if (Test-Path (Join-Path '%~dp0' 'TMS-Agent.exe')) {
    `$lnk.TargetPath = Join-Path '%~dp0' 'TMS-Agent.exe'
    `$lnk.IconLocation = (Join-Path '%~dp0' 'TMS-Agent.exe') + ',0'
} else {
    `$lnk.TargetPath = 'wscript.exe'
    `$lnk.Arguments = '\"' + (Join-Path '%~dp0' 'Start-Agent-Silent.vbs') + '\"'
}
`$lnk.WorkingDirectory = '%~dp0'
`$lnk.Description = 'NovaArc TMS Desktop Agent - Transaction Intelligence'
`$lnk.Save()
Write-Host 'Shortcut successfully created on your Desktop:' `$lnkPath
"@

echo.
pause

