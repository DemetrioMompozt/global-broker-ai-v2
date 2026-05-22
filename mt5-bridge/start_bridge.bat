@echo off
cd /d %~dp0
python -m pip install -r requirements.txt
python mt5_bridge.py
pause
