@echo off
setlocal

cd /d "%~dp0"

if not exist "scripts\start-hidden.vbs" (
  echo Missing scripts\start-hidden.vbs.
  pause
  exit /b 1
)

wscript.exe "%~dp0scripts\start-hidden.vbs"
