# Deploy en Render

## Resumen honesto

Render puede correr:

- UI + API de Global Broker AI v2.
- Binance WebSocket para cripto CFD paper.
- GPT-5.5 CFD Research Learning Agent.
- Paper engine, journal y paneles.

Render no es el lugar correcto para correr MetaTrader 5:

- MT5 requiere terminal de escritorio Windows.
- El paquete Python `MetaTrader5` necesita conectarse a una terminal MT5 local.
- Render corre servicios web/containers, no una sesion Windows con MT5 abierto.

Por eso, en Render el modo recomendado es:

```text
Render
  UI/API + Binance + GPT-5.5 + paper engine

Windows VPS separado
  MT5 + VT Markets demo + MT5 bridge read-only
```

En esta fase el `render.yaml` deja `VT_MARKETS_ENABLED=false` para evitar prometer VT si el bridge MT5 no existe dentro de Render.

## Crear servicio en Render

1. Sube este proyecto a GitHub.
2. En Render, crea un Blueprint desde el repo usando `render.yaml`.
3. Configura las variables secretas:

```ini
APP_BASIC_AUTH_PASSWORD=un_password_largo
OPENAI_API_KEY=tu_api_key_openai
```

4. Deploy.
5. Abre:

```text
https://tu-servicio.onrender.com/
https://tu-servicio.onrender.com/api/health
```

## 24/7

No uses Free para el agente 24/7. Las instancias gratis no son recomendadas para produccion y pueden tener limitaciones. Usa una instancia pagada/always-on.

## Seguridad

Mantener siempre:

```ini
REAL_TRADING_ALLOWED=false
BROKER_EXECUTION_ENABLED=false
LIVE_TRADING_ENABLED=false
MT5_REAL_EXECUTION=false
VT_MARKETS_ALLOW_ORDER_SEND=false
VT_MARKETS_REAL_TRADING_ALLOWED=false
VT_MARKETS_READ_ONLY=true
```

## VT Markets desde Render

Para usar VT como feed principal desde Render necesitas una de estas dos rutas:

1. Windows VPS principal: correr todo ahi, recomendado si VT/MT5 es obligatorio.
2. Arquitectura hibrida: Render para UI/API y Windows VPS para `mt5-bridge`, expuesto por una conexion segura.

No expongas el bridge MT5 publico sin autenticacion, firewall o tunel seguro.
