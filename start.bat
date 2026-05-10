@echo off
setlocal
title AI Pixel Painter

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required to run AI Pixel Painter.
  echo Install Node.js from https://nodejs.org/ and run this script again.
  pause
  exit /b 1
)

if not exist ".env.local" (
  if exist ".env.example" (
    copy ".env.example" ".env.local" >nul
    echo Created .env.local from .env.example.
  )
)

if not exist "node_modules" (
  echo Installing dependencies...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { Start-Process 'http://127.0.0.1:3000'; exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo AI Pixel Painter is already running at http://127.0.0.1:3000
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3"
  exit /b 0
)

echo Starting AI Pixel Painter...
echo The browser will open at http://127.0.0.1:3000
start "" cmd /c "powershell -NoProfile -ExecutionPolicy Bypass -Command Start-Sleep -Seconds 4 && start http://127.0.0.1:3000"

call npm run dev -- --hostname 127.0.0.1 --port 3000
pause
