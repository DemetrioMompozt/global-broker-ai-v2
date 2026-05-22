@echo off
title Global Broker AI Connector
cd /d %~dp0\mt5-bridge
echo ==========================================
echo Global Broker AI Connector
echo Modo seguro: DEMO / SOLO LECTURA
echo No se enviaran ordenes
echo ==========================================
echo.
echo Verificando Python...
python --version
echo.
echo Instalando dependencias...
python -m pip install -r requirements.txt
echo.
echo Iniciando conector local...
python mt5_bridge.py
pause
