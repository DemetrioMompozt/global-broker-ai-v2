@echo off
title Global Broker AI v2 - Windows VPS Install
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GlobalBrokerAI-WindowsVPS-Install.ps1"
pause
