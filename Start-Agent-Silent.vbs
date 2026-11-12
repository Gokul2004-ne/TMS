' ========================================================================
' NovaArc TMS Desktop Agent - Silent Background Launcher (No CMD Window)
' ========================================================================
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
currentDir = FSO.GetParentFolderName(WScript.ScriptFullName)

batPath = currentDir & "\Start-Agent.bat"
If FSO.FileExists(batPath) Then
    WshShell.Run """" & batPath & """ /silent", 0, False
Else
    exePath = currentDir & "\TMS-Agent.exe"
    If FSO.FileExists(exePath) Then
        WshShell.Run """" & exePath & """", 0, False
    End If
End If

Set WshShell = Nothing
Set FSO = Nothing
