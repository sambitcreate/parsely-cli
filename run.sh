#!/usr/bin/env bash
set -e

# Navigate to the script's directory to ensure paths are correct
cd "$(dirname "$0")"

# Ensure Node.js is available
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found. Install it from https://nodejs.org"
  exit 1
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Ensure color support for the TUI
export COLORTERM=truecolor

# Launch the Ink-based TUI
npx tsx src/cli.tsx "$@"
