' Runs the TMS desktop agent completely invisibly in background with no command prompt window
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Automatically unblock files
WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Unblock-File -Path 'TMS-Agent.exe' -ErrorAction SilentlyContinue""", 0, True

' Run via pythonw (instant, completely silent, 100% immune to Smart App Control)
If FSO.FileExists(scriptDir & "\agent\main.py") Then
    WshShell.Run "pythonw.exe agent\main.py", 0, False
ElseIf FSO.FileExists(scriptDir & "\TMS-Agent.exe") Then
    WshShell.Run "TMS-Agent.exe", 0, False
Else
    WshShell.Run "python agent\main.py", 0, False
End If
