#!/usr/bin/env bash
set -e

# Navigate to the script's directory to ensure paths are correct
cd "$(dirname "$0")"

echo "Setting up virtual environment..."
# Recreate venv to avoid stale absolute paths after directory moves
if [ -d "venv" ]; then
  echo "Removing existing virtual environment..."
  rm -rf venv
fi
python3 -m venv venv
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

# Explicitly set COLORTERM to ensure rich renders colors
export COLORTERM=truecolor

python -m src.parsely_cli "$@"
