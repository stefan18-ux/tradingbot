#!/usr/bin/env bash
set -euo pipefail

# Creates a local virtualenv at backend/.venv and installs requirements
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

echo
echo "Done. Activate with: source $(pwd)/.venv/bin/activate"
