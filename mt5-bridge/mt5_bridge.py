from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request

try:
    import MetaTrader5 as mt5
except Exception as exc:  # pragma: no cover - depends on local MT5 install
    mt5 = None
    MT5_IMPORT_ERROR = str(exc)
else:
    MT5_IMPORT_ERROR = None


load_dotenv()

app = Flask(__name__)


def bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() == "true"


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def mask_login(login: Any) -> str:
    text = str(login or "")
    if not text:
        return ""
    if len(text) <= 3:
        return "***"
    return f"{text[:2]}***{text[-2:]}"


def safety_block_reason() -> str | None:
    if os.getenv("MT5_MODE", "DEMO").upper() != "DEMO":
        return "MT5_MODE must be DEMO"
    if not bool_env("MT5_READ_ONLY", True):
        return "MT5_READ_ONLY must be true"
    if bool_env("MT5_ALLOW_ORDER_SEND", False):
        return "MT5_ALLOW_ORDER_SEND must be false"
    if bool_env("MT5_REAL_TRADING_ALLOWED", False):
        return "MT5_REAL_TRADING_ALLOWED must be false"
    return None


def blocked(reason: str):
    return jsonify({
        "ok": False,
        "status": "BLOCKED_BY_SAFETY",
        "reason": reason,
        "readOnly": True,
        "orderSendAllowed": False,
        "realTradingAllowed": False,
        "timestamp": iso_now(),
    }), 403


def ensure_safe():
    reason = safety_block_reason()
    if reason:
        return blocked("Real trading or order sending is not allowed in this phase: " + reason)
    if MT5_IMPORT_ERROR:
        return jsonify({
            "ok": False,
            "connected": False,
            "status": "DISCONNECTED",
            "message": "MetaTrader5 Python package is not available",
            "error": MT5_IMPORT_ERROR,
            "timestamp": iso_now(),
        }), 503
    return None


def initialize_mt5():
    if mt5 is None:
        return False, "MetaTrader5 package not available"

    login = os.getenv("MT5_LOGIN")
    password = os.getenv("MT5_PASSWORD")
    server = os.getenv("MT5_SERVER")

    try:
        if login and password and server:
            ok = mt5.initialize(login=int(login), password=password, server=server)
        else:
            ok = mt5.initialize()
    except Exception as exc:
        return False, str(exc)

    if not ok:
        return False, str(mt5.last_error())
    return True, None


def account_type(account: Any) -> str:
    if account is None:
        return "UNKNOWN"
    # MetaTrader5 exposes trade_mode on account_info in most installations.
    trade_mode = getattr(account, "trade_mode", None)
    demo_constant = getattr(mt5, "ACCOUNT_TRADE_MODE_DEMO", None) if mt5 else None
    real_constant = getattr(mt5, "ACCOUNT_TRADE_MODE_REAL", None) if mt5 else None
    if demo_constant is not None and trade_mode == demo_constant:
        return "DEMO"
    if real_constant is not None and trade_mode == real_constant:
        return "REAL_BLOCKED"
    server = str(getattr(account, "server", "") or "").lower()
    if "demo" in server:
        return "DEMO"
    return "UNKNOWN"


def account_payload(account: Any):
    return {
        "login": mask_login(getattr(account, "login", "")),
        "server": getattr(account, "server", os.getenv("MT5_SERVER", "")),
        "currency": getattr(account, "currency", None),
        "balance": getattr(account, "balance", None),
        "equity": getattr(account, "equity", None),
        "margin": getattr(account, "margin", None),
        "usedMargin": getattr(account, "margin", None),
        "freeMargin": getattr(account, "margin_free", None),
        "marginLevel": getattr(account, "margin_level", None),
        "leverage": getattr(account, "leverage", None),
        "tradeAllowed": bool(getattr(account, "trade_allowed", False)),
        "accountType": account_type(account),
        "accountMode": "REAL" if account_type(account) == "REAL_BLOCKED" else account_type(account),
        "readOnly": True,
    }


def ensure_connected():
    safe = ensure_safe()
    if safe:
        return None, safe

    ok, message = initialize_mt5()
    if not ok:
        return None, (jsonify({
            "ok": False,
            "connected": False,
            "status": "DISCONNECTED",
            "message": "MT5 terminal not connected or credentials invalid",
            "error": message,
            "timestamp": iso_now(),
        }), 503)

    account = mt5.account_info()
    if account and account_type(account) == "REAL_BLOCKED":
        return None, blocked("Real account detected. Demo only bridge blocked.")
    return account, None


@app.get("/mt5/status")
def status():
    safe = ensure_safe()
    if safe:
        return safe

    ok, message = initialize_mt5()
    if not ok:
        return jsonify({
            "ok": False,
            "connected": False,
            "status": "DISCONNECTED",
            "message": "MT5 terminal not connected or credentials invalid",
            "error": message,
            "timestamp": iso_now(),
        }), 503

    account = mt5.account_info()
    detected_type = account_type(account)
    if detected_type == "REAL_BLOCKED":
        return blocked("Real account detected. Demo only bridge blocked.")

    return jsonify({
        "ok": True,
        "connected": True,
        "mode": "DEMO",
        "readOnly": True,
        "orderSendAllowed": False,
        "realTradingAllowed": False,
        "terminalInfo": mt5.terminal_info()._asdict() if mt5.terminal_info() else {},
        "accountDetected": account is not None,
        "accountType": detected_type,
        "server": getattr(account, "server", os.getenv("MT5_SERVER", "")) if account else os.getenv("MT5_SERVER", ""),
        "timestamp": iso_now(),
    })


@app.get("/mt5/account")
def account():
    account_info, error = ensure_connected()
    if error:
        return error
    return jsonify(account_payload(account_info))


@app.get("/mt5/symbols")
def symbols():
    _account, error = ensure_connected()
    if error:
        return error
    query = str(request.args.get("query", "")).upper()
    raw_symbols = mt5.symbols_get()
    result = []
    for symbol in raw_symbols or []:
        name = symbol.name
        if query and query not in name.upper() and query not in str(symbol.description or "").upper():
            continue
        result.append({
            "name": name,
            "description": symbol.description,
            "path": symbol.path,
            "visible": symbol.visible,
            "tradeMode": str(symbol.trade_mode),
            "digits": symbol.digits,
            "point": symbol.point,
            "contractSize": symbol.trade_contract_size,
            "volumeMin": symbol.volume_min,
            "volumeMax": symbol.volume_max,
            "volumeStep": symbol.volume_step,
            "spread": symbol.spread,
        })
    return jsonify({"symbols": result, "readOnly": True})


@app.get("/mt5/tick")
def tick():
    _account, error = ensure_connected()
    if error:
        return error
    symbol = str(request.args.get("symbol", "")).strip()
    if not symbol:
        return jsonify({"error": "SYMBOL_REQUIRED"}), 400
    if not mt5.symbol_select(symbol, True):
        return jsonify({"error": "SYMBOL_NOT_FOUND", "symbol": symbol}), 404
    raw_tick = mt5.symbol_info_tick(symbol)
    if raw_tick is None:
        return jsonify({"error": "TICK_NOT_AVAILABLE", "symbol": symbol}), 404
    bid = float(raw_tick.bid)
    ask = float(raw_tick.ask)
    last = float(raw_tick.last or 0)
    mid = (bid + ask) / 2 if bid > 0 and ask > 0 else last
    spread = ask - bid if ask >= bid else 0
    return jsonify({
        "symbol": symbol,
        "bid": bid,
        "ask": ask,
        "last": last,
        "mid": mid,
        "spread": spread,
        "spreadBps": (spread / mid * 10000) if mid else 0,
        "time": datetime.fromtimestamp(raw_tick.time, timezone.utc).isoformat() if raw_tick.time else iso_now(),
        "timeMsc": int(getattr(raw_tick, "time_msc", 0) or 0),
        "provider": "MT5 Demo",
        "feedType": "BROKER_DEMO_REALTIME",
        "pricingQuality": "LIVE_BID_ASK",
        "readOnly": True,
    })


@app.get("/mt5/positions")
def positions():
    _account, error = ensure_connected()
    if error:
        return error
    raw_positions = mt5.positions_get()
    result = []
    for position in raw_positions or []:
        result.append({
            "ticket": position.ticket,
            "symbol": position.symbol,
            "type": "BUY" if position.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": position.volume,
            "priceOpen": position.price_open,
            "priceCurrent": position.price_current,
            "sl": position.sl,
            "tp": position.tp,
            "profit": position.profit,
            "swap": position.swap,
            "time": datetime.fromtimestamp(position.time, timezone.utc).isoformat() if position.time else None,
        })
    return jsonify({"positions": result, "readOnly": True})


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "NOT_FOUND", "message": "This read-only bridge does not expose order_send endpoints."}), 404


if __name__ == "__main__":
    host = os.getenv("MT5_HOST", "127.0.0.1")
    port = int(os.getenv("MT5_PORT", "5190"))
    reason = safety_block_reason()
    if reason:
        print(f"MT5 Bridge blocked by safety: {reason}")
    app.run(host=host, port=port)
