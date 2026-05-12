#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required."
  echo "Install Node.js LTS from https://nodejs.org/ and run this script again."
  exit 1
fi

if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env.local"
  echo "Created .env.local from .env.example."
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi
fi

echo "Starting AI Pixel Art in your browser..."
npm run browser
