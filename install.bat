@echo off
setlocal
title AI Pixel Painter Installer

cd /d "%~dp0"

echo.
echo =====================================
echo   AI Pixel Painter - One Click Setup
echo =====================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo This installer can install Node.js LTS with winget.
    choice /C YN /M "Install Node.js LTS now"
    if errorlevel 2 goto node_manual
    winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
      echo Node.js installation failed.
      goto node_manual
    )
    echo.
    echo Node.js was installed. Close this window, then double-click install.bat again.
    pause
    exit /b 0
  )

  :node_manual
  echo Please install Node.js LTS from:
  echo https://nodejs.org/
  echo.
  echo After installing Node.js, double-click install.bat again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

if not exist ".env.local" (
  if exist ".env.example" (
    copy ".env.example" ".env.local" >nul
    echo Created .env.local from .env.example.
  )
)

if exist "package-lock.json" (
  echo Installing dependencies with npm ci...
  call npm ci
) else (
  echo Installing dependencies with npm install...
  call npm install
)

if errorlevel 1 (
  echo.
  echo Dependency installation failed.
  pause
  exit /b 1
)

echo Creating desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $shortcut = Join-Path $desktop 'AI Pixel Painter.lnk'; $shell = New-Object -ComObject WScript.Shell; $link = $shell.CreateShortcut($shortcut); $link.TargetPath = Join-Path (Get-Location) 'start.bat'; $link.WorkingDirectory = (Get-Location).Path; $link.IconLocation = 'shell32.dll,220'; $link.Save()" >nul 2>nul

echo.
echo Setup complete.
echo You can now start AI Pixel Painter with:
echo - the desktop shortcut: AI Pixel Painter
echo - or this folder's start.bat
echo.

choice /C YN /M "Start AI Pixel Painter now"
if errorlevel 2 (
  echo Done.
  pause
  exit /b 0
)

call start.bat
