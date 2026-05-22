@echo off
title Global Broker AI v2 - PM2 Install
cd /d %~dp0
echo ==========================================
echo Global Broker AI v2 - PM2 24/7
echo DEMO / PAPER / READ ONLY
echo ==========================================
echo.
if not exist .env (
  echo No existe .env. Copia .env.production.example a .env antes de instalar.
  pause
  exit /b 1
)
call npm install
call npm run build
call npm install -g pm2
call pm2 start ecosystem.config.cjs
call pm2 save
echo.
echo App instalada en PM2. Para ver estado: pm2 status
echo Para logs: pm2 logs global-broker-ai-v2
pause
