' Runs the TMS desktop agent completely invisibly in background with no command prompt window
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "python agent\main.py", 0, False
