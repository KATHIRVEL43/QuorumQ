#!/usr/bin/env bash
echo "========================================================"
echo "Starting HBB Vault Quantum Secret Sharing Demo"
echo "Host: http://127.0.0.1:8000"
echo "========================================================"

# Attempt to open browser across platforms
if which xdg-open > /dev/null; then
  xdg-open http://127.0.0.1:8000 &
elif which open > /dev/null; then
  open http://127.0.0.1:8000 &
fi

python -m uvicorn hbb_vault.backend.main:app --host 127.0.0.1 --port 8000
