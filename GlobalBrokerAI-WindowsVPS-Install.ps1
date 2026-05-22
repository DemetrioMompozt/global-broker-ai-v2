$ErrorActionPreference = "Stop"

Write-Host "=========================================="
Write-Host "Global Broker AI v2 - Windows VPS Install"
Write-Host "Modo seguro: DEMO / PAPER / READ ONLY"
Write-Host "No se enviaran ordenes reales"
Write-Host "=========================================="
Write-Host ""

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "Verificando Node.js..."
if (-not (Test-Command "node")) {
  Write-Host "Node.js no esta instalado. Instala Node.js LTS y vuelve a ejecutar este script."
  Write-Host "Descarga: https://nodejs.org/"
  exit 1
}
node --version

Write-Host ""
Write-Host "Verificando Python..."
if (-not (Test-Command "python")) {
  Write-Host "Python no esta instalado. Instala Python 3.10+ y vuelve a ejecutar este script."
  Write-Host "Descarga: https://www.python.org/downloads/windows/"
  exit 1
}
python --version

Write-Host ""
Write-Host "Instalando dependencias Node..."
npm install

Write-Host ""
Write-Host "Compilando app..."
npm run build

Write-Host ""
Write-Host "Instalando dependencias MT5 bridge..."
Push-Location (Join-Path $ProjectRoot "mt5-bridge")
python -m pip install -r requirements.txt
Pop-Location

Write-Host ""
Write-Host "Verificando .env principal..."
if (-not (Test-Path (Join-Path $ProjectRoot ".env"))) {
  Copy-Item (Join-Path $ProjectRoot ".env.production.example") (Join-Path $ProjectRoot ".env")
  Write-Host "Se creo .env desde .env.production.example. Editalo con tus datos DEMO antes de operar."
}

Write-Host ""
Write-Host "Verificando mt5-bridge/.env..."
$BridgeEnv = Join-Path $ProjectRoot "mt5-bridge\.env"
if (-not (Test-Path $BridgeEnv)) {
  Copy-Item (Join-Path $ProjectRoot "mt5-bridge\.env.example") $BridgeEnv
  Write-Host "Se creo mt5-bridge/.env desde .env.example. Editalo con login/server/password DEMO."
}

Write-Host ""
Write-Host "Instalando PM2 para mantener API viva..."
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save

Write-Host ""
Write-Host "Listo."
Write-Host "Siguiente:"
Write-Host "1. Abre MetaTrader 5 en este VPS."
Write-Host "2. Inicia sesion con cuenta DEMO VT Markets."
Write-Host "3. Edita mt5-bridge/.env con esa cuenta DEMO."
Write-Host "4. Ejecuta GlobalBrokerAI-Connector.bat y deja esa ventana abierta."
Write-Host "5. Abre http://IP_DEL_VPS:5185/"
Write-Host ""
Write-Host "Seguridad obligatoria:"
Write-Host "REAL_TRADING_ALLOWED=false"
Write-Host "BROKER_EXECUTION_ENABLED=false"
Write-Host "VT_MARKETS_ALLOW_ORDER_SEND=false"
Write-Host "VT_MARKETS_REAL_TRADING_ALLOWED=false"
