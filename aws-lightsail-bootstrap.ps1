$ErrorActionPreference = "Stop"

$Root = "C:\GlobalBrokerAI"
$Project = Join-Path $Root "global-broker-ai-v2"
$Log = Join-Path $Root "install.log"
$RepoZip = "https://github.com/DemetrioMompozt/global-broker-ai-v2/archive/refs/heads/main.zip"

New-Item -ItemType Directory -Force -Path $Root | Out-Null
Start-Transcript -Path $Log -Append

Write-Host "=========================================="
Write-Host "Global Broker AI v2 - AWS Lightsail Bootstrap"
Write-Host "Modo seguro: DEMO / PAPER / READ ONLY"
Write-Host "No se enviaran ordenes reales"
Write-Host "=========================================="

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Set-ExecutionPolicy Bypass -Scope Process -Force

Write-Host "Habilitando acceso de diagnostico seguro del servidor..."
try {
  Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
  Start-Service sshd
  Set-Service -Name sshd -StartupType Automatic
  New-NetFirewallRule -DisplayName "Global Broker AI SSH Diagnostic" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 22 -ErrorAction SilentlyContinue | Out-Null
} catch {
  Write-Host "OpenSSH no pudo habilitarse automaticamente: $($_.Exception.Message)"
}

try {
  Enable-PSRemoting -Force
  Set-Item WSMan:\localhost\Service\AllowUnencrypted -Value true -ErrorAction SilentlyContinue
  Set-Item WSMan:\localhost\Service\Auth\Basic -Value true -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "Global Broker AI WinRM Diagnostic" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5985 -ErrorAction SilentlyContinue | Out-Null
} catch {
  Write-Host "WinRM no pudo habilitarse automaticamente: $($_.Exception.Message)"
}

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "Instalando Chocolatey si hace falta..."
if (-not (Test-Command "choco")) {
  Set-ExecutionPolicy Bypass -Scope Process -Force
  Invoke-Expression ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))
  Refresh-Path
}

Write-Host "Instalando Node.js LTS, Python y Git..."
choco install nodejs-lts python git -y --no-progress
Refresh-Path

Write-Host "Versiones instaladas:"
node --version
npm --version
python --version

Write-Host "Descargando repo desde GitHub..."
$ZipPath = Join-Path $Root "global-broker-ai-v2.zip"
$ExtractPath = Join-Path $Root "repo-extract"
Remove-Item -LiteralPath $ZipPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $ExtractPath -Recurse -Force -ErrorAction SilentlyContinue
Invoke-WebRequest -Uri $RepoZip -OutFile $ZipPath
Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force

Remove-Item -LiteralPath $Project -Recurse -Force -ErrorAction SilentlyContinue
$Extracted = Get-ChildItem -Path $ExtractPath -Directory | Select-Object -First 1
Move-Item -LiteralPath $Extracted.FullName -Destination $Project

Set-Location $Project
New-Item -ItemType Directory -Force -Path (Join-Path $Project "logs") | Out-Null

Write-Host "Creando .env seguro de produccion..."
$MainEnv = @"
PORT=80
HOST=0.0.0.0
APP_BASIC_AUTH_USER=admin
APP_BASIC_AUTH_PASSWORD=GBaiDemoSafe2026!
CFD_PAPER_AGENT_AUTOSTART=true
OPENAI_API_KEY=
CFD_RESEARCH_ENABLED=true
CFD_RESEARCH_MODEL=gpt-5.5
CFD_RESEARCH_WEB_SEARCH_ENABLED=true
CFD_RESEARCH_INTERVAL_MINUTES=30
CFD_RESEARCH_TIMEOUT_MS=45000

REAL_TRADING_ALLOWED=false
BROKER_EXECUTION_ENABLED=false
LIVE_TRADING_ENABLED=false
MT5_REAL_EXECUTION=false

VT_MARKETS_ENABLED=true
VT_MARKETS_MODE=DEMO
VT_MARKETS_ACCOUNT_TYPE=MT5_DEMO
VT_MARKETS_ALLOW_ORDER_SEND=false
VT_MARKETS_REAL_TRADING_ALLOWED=false
VT_MARKETS_READ_ONLY=true
VT_MARKETS_SERVER=VTMarkets-Demo
VT_MARKETS_LOGIN=
VT_MARKETS_PASSWORD=
VT_MARKETS_INVESTOR_PASSWORD=
MT5_BRIDGE_URL=http://127.0.0.1:5190

MICRO_PROFIT_TARGET_NET_USD=2.00
MICRO_PROFIT_TARGET_OPTIONS_USD=1.00,2.00,3.00
MICRO_PROFIT_DEFAULT_TARGET_USD=2.00
MICRO_PROFIT_MAX_LOSS_PER_TRADE_USD=10.00
MICRO_PROFIT_DAILY_STOP_LOSS_USD=25.00
MICRO_PROFIT_DAILY_TARGET_USD=100.00
MICRO_PROFIT_MAX_CONSECUTIVE_LOSSES=3
MICRO_PROFIT_COOLDOWN_AFTER_LOSS_SECONDS=120
MICRO_PROFIT_COOLDOWN_AFTER_WIN_SECONDS=20
MICRO_PROFIT_MAX_HOLD_SECONDS=300
"@
Set-Content -Path (Join-Path $Project ".env") -Value $MainEnv -Encoding UTF8

Write-Host "Creando mt5-bridge/.env seguro..."
$BridgeEnv = @"
MT5_MODE=DEMO
MT5_SERVER=VTMarkets-Demo
MT5_LOGIN=
MT5_PASSWORD=
MT5_READ_ONLY=true
MT5_ALLOW_ORDER_SEND=false
MT5_REAL_TRADING_ALLOWED=false
MT5_HOST=127.0.0.1
MT5_PORT=5190
"@
Set-Content -Path (Join-Path $Project "mt5-bridge\.env") -Value $BridgeEnv -Encoding UTF8

Write-Host "Instalando dependencias Node..."
npm install

Write-Host "Compilando app..."
npm run build

Write-Host "Instalando dependencias MT5 bridge..."
Push-Location (Join-Path $Project "mt5-bridge")
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Pop-Location

Write-Host "Intentando instalar MetaTrader 5 generico..."
$Mt5Installer = Join-Path $Root "mt5setup.exe"
try {
  Invoke-WebRequest -Uri "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" -OutFile $Mt5Installer
  Start-Process -FilePath $Mt5Installer -ArgumentList "/auto" -Wait -ErrorAction SilentlyContinue
} catch {
  Write-Host "No se pudo instalar MT5 automaticamente. Se podra instalar manualmente luego."
}

Write-Host "Abriendo firewall local para la app..."
New-NetFirewallRule -DisplayName "Global Broker AI v2 Web" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -ErrorAction SilentlyContinue | Out-Null

Write-Host "Instalando PM2 y levantando procesos..."
npm install -g pm2
pm2 delete all 2>$null
pm2 start ecosystem.config.cjs
pm2 save

Write-Host "Creando archivo de acceso en escritorio..."
$Access = @"
Global Broker AI v2 esta instalado.

URL:
http://PUBLIC_IP/

Usuario:
admin

Password temporal:
GBaiDemoSafe2026!

Seguridad:
paperOnly=true
realTradingAllowed=false
brokerExecutionEnabled=false
VT_MARKETS_READ_ONLY=true
VT_MARKETS_ALLOW_ORDER_SEND=false
VT_MARKETS_REAL_TRADING_ALLOWED=false

Para VT Markets:
1. Abre MetaTrader 5.
2. Inicia sesion solo con cuenta DEMO.
3. En la app configura VT Markets Demo.
"@
Set-Content -Path "C:\Users\Administrator\Desktop\GlobalBrokerAI-ACCESS.txt" -Value $Access -Encoding UTF8

Write-Host "Instalacion finalizada."
Stop-Transcript
