@echo off
title Global Broker AI v2 - Production
cd /d %~dp0
echo ==========================================
echo Global Broker AI v2 - Production
echo DEMO / PAPER / READ ONLY
echo No se enviaran ordenes reales
echo ==========================================
echo.
if not exist .env (
  echo No existe .env. Copia .env.production.example a .env y configura usuario/password y VT demo.
  pause
  exit /b 1
)
echo Instalando dependencias...
call npm install
echo.
echo Construyendo app...
call npm run build
echo.
echo Iniciando MT5 bridge en otra ventana...
start "Global Broker AI MT5 Bridge" GlobalBrokerAI-Connector.bat
echo.
echo Iniciando servidor web/API...
call npm run start:prod
pause
