@echo off
echo ========================================================
echo Starting HBB Vault Quantum Secret Sharing Demo
echo Host: http://127.0.0.1:8000
echo ========================================================

start "" http://127.0.0.1:8000
python -m uvicorn hbb_vault.backend.main:app --host 127.0.0.1 --port 8000
pause
