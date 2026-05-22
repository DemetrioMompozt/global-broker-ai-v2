$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "mt5-bridge")
Write-Host "=========================================="
Write-Host "Global Broker AI Connector"
Write-Host "Modo seguro: DEMO / SOLO LECTURA"
Write-Host "No se enviaran ordenes"
Write-Host "=========================================="
Write-Host ""
Write-Host "Verificando Python..."
python --version
Write-Host ""
Write-Host "Instalando dependencias..."
python -m pip install -r requirements.txt
Write-Host ""
Write-Host "Iniciando conector local..."
python mt5_bridge.py
