@echo off
title Global Broker AI
cd /d %~dp0
echo ==========================================
echo Global Broker AI
echo Modo seguro: DEMO / PAPER / SOLO LECTURA
echo No se enviaran ordenes
echo ==========================================
echo.
start "Global Broker AI App" cmd /k npm run dev:all
start "Global Broker AI Connector" GlobalBrokerAI-Connector.bat
