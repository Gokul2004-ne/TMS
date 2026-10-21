' Runs the TMS desktop agent completely invisibly in background with no command prompt window
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

If FSO.FileExists(scriptDir & "\TMS-Agent.exe") Then
    WshShell.Run "TMS-Agent.exe", 0, False
Else
    WshShell.Run "python agent\main.py", 0, False
End If
