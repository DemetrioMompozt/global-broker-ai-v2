# MT5 Bridge Read-Only para VT Markets Demo

Este bridge conecta `global-broker-ai-v2` con MetaTrader 5 en modo **DEMO / solo lectura**.

No envia ordenes. No expone `order_send`. No activa cuenta real.

## Pasos

1. Instala MetaTrader 5.
2. Abre una cuenta demo de VT Markets.
3. Inicia sesion en MT5 con la cuenta demo.
4. Instala dependencias:

```bash
python -m pip install -r requirements.txt
```

5. Copia `.env.example` a `.env` y completa:

```env
MT5_MODE=DEMO
MT5_SERVER=tu-servidor-demo
MT5_LOGIN=tu-login-demo
MT5_PASSWORD=tu-password-demo
MT5_READ_ONLY=true
MT5_ALLOW_ORDER_SEND=false
MT5_REAL_TRADING_ALLOWED=false
MT5_HOST=127.0.0.1
MT5_PORT=5190
# Optional on servers with a specific MT5 terminal install path:
MT5_TERMINAL_PATH=
```

6. Ejecuta:

```bash
python mt5_bridge.py
```

7. Prueba:

[http://127.0.0.1:5190/mt5/status](http://127.0.0.1:5190/mt5/status)

8. Abre `global-broker-ai-v2` y revisa la card `VT Markets Readiness`.

## Ya tengo MT5 instalado, que hago?

1. Abre MetaTrader 5.
2. Ve a `File > Login to Trade Account`.
3. Inicia sesion con una cuenta **DEMO** de VT Markets.
4. Selecciona el servidor demo correcto de VT Markets.
5. En la app, abre `VT Markets Readiness` y usa `Configurar cuenta demo MT5` para crear el archivo `.env` sin hacerlo manualmente. La app no muestra ni devuelve el password.
6. Si necesitas revisar el archivo, debe quedar con esta configuracion segura:

```env
MT5_MODE=DEMO
MT5_SERVER=TU_SERVIDOR_DE_VT_MARKETS
MT5_LOGIN=TU_LOGIN_DEMO
MT5_PASSWORD=TU_PASSWORD_DEMO
MT5_READ_ONLY=true
MT5_ALLOW_ORDER_SEND=false
MT5_REAL_TRADING_ALLOWED=false
MT5_HOST=127.0.0.1
MT5_PORT=5190
# Optional on servers with a specific MT5 terminal install path:
MT5_TERMINAL_PATH=
```

7. Ejecuta:

```bash
cd global-broker-ai-v2/mt5-bridge
python -m pip install -r requirements.txt
python mt5_bridge.py
```

Tambien puedes usar `start_bridge.bat` en Windows o `start_bridge.command` en macOS/Linux. Esos scripts solo arrancan el bridge local read-only.

8. Abre:

[http://127.0.0.1:5190/mt5/status](http://127.0.0.1:5190/mt5/status)

9. Abre la app:

[http://127.0.0.1:5184/](http://127.0.0.1:5184/)

10. Revisa `VT Markets Readiness` y usa `Verificar MT5 Bridge`.

## Endpoints

- `GET /mt5/status`
- `GET /mt5/account`
- `GET /mt5/symbols`
- `GET /mt5/symbols?query=NAS`
- `GET /mt5/tick?symbol=NAS100`
- `GET /mt5/positions`

## Seguridad

El bridge se bloquea si:

- `MT5_MODE` no es `DEMO`
- `MT5_READ_ONLY` no es `true`
- `MT5_ALLOW_ORDER_SEND` es `true`
- `MT5_REAL_TRADING_ALLOWED` es `true`
- Detecta cuenta real

No hay endpoint de envio de ordenes en esta fase.
