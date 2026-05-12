Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
logPath = fso.BuildPath(projectRoot, "ai-pixel-art.log")

command = "cmd.exe /d /s /c ""cd /d """ & projectRoot & """ && npm run browser > """ & logPath & """ 2>&1"""
shell.Run command, 0, False
