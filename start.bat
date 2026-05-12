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

echo Starting AI Pixel Art in your browser...

call npm run browser
if errorlevel 1 (
  pause
)
