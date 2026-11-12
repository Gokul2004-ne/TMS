' ========================================================
'  TMS Desktop Agent - Silent One-Click Launcher
'  Bypasses Windows Smart App Control with zero terminal window
' ========================================================
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
currentDir = FSO.GetParentFolderName(WScript.ScriptFullName)

batPath = currentDir & "\Start-Agent.bat"
If FSO.FileExists(batPath) Then
    ' Run completely silently (window style 0, non-blocking)
    WshShell.Run """" & batPath & """ /silent", 0, False
Else
    ' Fallback to direct Python / EXE launch
    exePath = currentDir & "\dist\TMS-Agent.exe"
    If Not FSO.FileExists(exePath) Then
        exePath = currentDir & "\TMS-Agent.exe"
    End If
    If FSO.FileExists(exePath) Then
        WshShell.Run """" & exePath & """", 0, False
    Else
        MsgBox "Could not locate TMS Agent in: " & currentDir, 16, "TMS Desktop Agent"
    End If
End If

Set WshShell = Nothing
Set FSO = Nothing

