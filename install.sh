#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo
echo "====================================="
echo "  AI Pixel Art - One Click Setup"
echo "====================================="
echo

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required."
  echo
  echo "Install Node.js LTS from:"
  echo "https://nodejs.org/"
  echo
  echo "macOS with Homebrew:"
  echo "  brew install node"
  echo
  echo "Ubuntu/Debian example:"
  echo "  sudo apt update && sudo apt install -y nodejs npm"
  exit 1
fi

if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env.local"
  echo "Created .env.local from .env.example."
fi

if [ -f "package-lock.json" ]; then
  echo "Installing dependencies with npm ci..."
  npm ci
else
  echo "Installing dependencies with npm install..."
  npm install
fi

chmod +x ./start.sh

echo
echo "Setup complete. Starting AI Pixel Art..."
echo

./start.sh
