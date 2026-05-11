@echo off
setlocal
title AI Pixel Art

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required to run AI Pixel Art.
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

if not exist "node_modules\electron" (
  echo Installing desktop shell...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo Desktop shell installation failed.
    pause
    exit /b 1
  )
)

if not exist ".next\BUILD_ID" (
  echo Preparing optimized app. This can take a minute the first time only...
  call npm run build
  if errorlevel 1 (
    echo App build failed.
    pause
    exit /b 1
  )
)

echo Starting AI Pixel Art desktop app...

call npm run desktop
pause
