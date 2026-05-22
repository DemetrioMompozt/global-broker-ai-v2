# Global Broker AI v2 - despliegue 24/7

## Recomendacion principal

Para usar VT Markets MT5 demo 24/7, usa un VPS Windows. MT5 y el paquete Python `MetaTrader5` funcionan mejor en Windows con la terminal MT5 abierta en la misma maquina.

Si quieres usar Render, revisa `RENDER_DEPLOY.md`: Render es viable para UI/API, Binance y GPT-5.5 research, pero no para correr MT5 directamente.

La app sigue siendo:

- DEMO / PAPER / READ ONLY
- `REAL_TRADING_ALLOWED=false`
- `BROKER_EXECUTION_ENABLED=false`
- `VT_MARKETS_ALLOW_ORDER_SEND=false`
- sin endpoint `order_send`

## Requisitos del VPS

- Windows Server 2019/2022 o Windows 10/11 Pro.
- 2 vCPU minimo, 4 GB RAM minimo.
- Node.js LTS.
- Python 3.10+.
- MetaTrader 5 instalado.
- Cuenta demo VT Markets iniciada en MT5.
- Puerto externo para la app, por ejemplo `5185`, o reverse proxy HTTPS.

## Configuracion

1. Copia el proyecto al VPS.
   - Tambien puedes subir `global-broker-ai-v2-deploy.zip` y descomprimirlo en el VPS.
   - El paquete no incluye `.env`, `mt5-bridge/.env`, `node_modules`, logs ni credenciales.
2. Copia `.env.production.example` a `.env`.
3. Configura:

```ini
HOST=0.0.0.0
PORT=5185
APP_BASIC_AUTH_USER=admin
APP_BASIC_AUTH_PASSWORD=un_password_largo
OPENAI_API_KEY=tu_api_key_openai
CFD_RESEARCH_ENABLED=true
CFD_RESEARCH_MODEL=gpt-5.5
CFD_RESEARCH_WEB_SEARCH_ENABLED=true
CFD_RESEARCH_INTERVAL_MINUTES=30

VT_MARKETS_ENABLED=true
VT_MARKETS_MODE=DEMO
VT_MARKETS_READ_ONLY=true
VT_MARKETS_ALLOW_ORDER_SEND=false
VT_MARKETS_REAL_TRADING_ALLOWED=false
VT_MARKETS_LOGIN=tu_login_demo
VT_MARKETS_PASSWORD=tu_password_demo
VT_MARKETS_SERVER=VTMarkets-Demo
```

4. Configura tambien `mt5-bridge/.env` con la misma cuenta demo.
5. Abre MT5 e inicia sesion en la cuenta demo.

## Arranque simple

Ejecuta:

```bat
GlobalBrokerAI-Production.bat
```

Esto instala dependencias, construye la UI, abre el bridge MT5 y levanta la API/UI en el puerto configurado.

## Arranque 24/7 con PM2

Ejecuta:

```bat
GlobalBrokerAI-PM2-Install.bat
```

Comandos utiles:

```bat
pm2 status
pm2 logs global-broker-ai-v2
pm2 restart global-broker-ai-v2
pm2 stop global-broker-ai-v2
```

Importante: PM2 mantiene la app Node viva. El MT5 bridge tambien debe quedar corriendo en la sesion Windows donde MT5 esta abierto. Si el VPS reinicia, vuelve a abrir MT5, inicia sesion demo y ejecuta `GlobalBrokerAI-Connector.bat`.

## URLs

Si el VPS tiene IP `X.X.X.X`:

```text
http://X.X.X.X:5185/
http://X.X.X.X:5185/api/health
http://X.X.X.X:5185/api/cfd-paper/status
```

Si configuraste `APP_BASIC_AUTH_USER/PASSWORD`, el navegador pedira usuario y password.

## Seguridad minima

- No abras el puerto sin password.
- Usa firewall para permitir solo tu IP si es posible.
- No uses credenciales reales.
- No cambies `VT_MARKETS_ALLOW_ORDER_SEND=false`.
- No cambies `BROKER_EXECUTION_ENABLED=false`.
- No cambies `REAL_TRADING_ALLOWED=false`.

## Verificacion

Antes de dejarlo 24/7:

```bat
npm run deploy:check
```

Luego abre la app y confirma:

- `paperOnly=true`
- `realTradingAllowed=false`
- `brokerExecution=false`
- VT Markets: `CONNECTED_DEMO_READ_ONLY`
- Binance: `CONNECTED`
- GPT-5.5 CFD Research Learning Agent: `READY` o `NOT_CONFIGURED` si falta `OPENAI_API_KEY`
- Agent Learning Loop visible
- Recovery Probe o modo paper activo

## GPT-5.5 research learning

La app puede usar GPT-5.5 como capa de investigacion y aprendizaje. Esta capa:

- analiza journal, velas, costos, spreads, leverage y motivos de cierre;
- puede usar web search si `CFD_RESEARCH_WEB_SEARCH_ENABLED=true`;
- propone hipotesis y reglas de prueba;
- no abre trades;
- no cierra trades;
- no envia ordenes;
- no cambia `REAL_TRADING_ALLOWED=false` ni `BROKER_EXECUTION_ENABLED=false`.

Si no configuras `OPENAI_API_KEY`, la app sigue funcionando con aprendizaje local.
