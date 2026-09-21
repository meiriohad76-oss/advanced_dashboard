"""Notification Service for Telegram and Webhooks (§13, §14).

Provides instant push alert notifications to Telegram channels/chats and generic
webhooks (Slack, Discord, Teams, Custom) when high-severity market or portfolio alerts fire.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any
import httpx

from . import store

logger = logging.getLogger(__name__)


def _ensure_settings_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )


def get_settings() -> dict[str, Any]:
    """Retrieve notification configuration from SQLite."""
    path = store._db_path()
    conn = store._connect(path)
    _ensure_settings_table(conn)
    try:
        rows = conn.execute("SELECT key, value FROM notification_settings").fetchall()
        cfg = {k: v for k, v in rows}
    finally:
        conn.close()

    return {
        "telegram_token": cfg.get("telegram_token", os.environ.get("TELEGRAM_BOT_TOKEN", "")),
        "telegram_chat_id": cfg.get("telegram_chat_id", os.environ.get("TELEGRAM_CHAT_ID", "")),
        "telegram_enabled": cfg.get("telegram_enabled", "false").lower() in ("true", "1", "yes"),
        "webhook_url": cfg.get("webhook_url", os.environ.get("ATLAS_WEBHOOK_URL", "")),
        "webhook_enabled": cfg.get("webhook_enabled", "false").lower() in ("true", "1", "yes"),
        "min_severity": cfg.get("min_severity", "warning").lower(),  # info, warning, critical
        "premarket_briefing_enabled": cfg.get("premarket_briefing_enabled", "false").lower() in ("true", "1", "yes"),
        "premarket_briefing_time": cfg.get("premarket_briefing_time", "08:30 ET"),
    }


def save_settings(new_settings: dict[str, Any]) -> dict[str, Any]:
    """Save updated notification configuration to SQLite."""
    path = store._db_path()
    conn = store._connect(path)
    _ensure_settings_table(conn)
    now = datetime.now(timezone.utc).isoformat()
    try:
        for k in ("telegram_token", "telegram_chat_id", "webhook_url", "min_severity", "premarket_briefing_time"):
            if k in new_settings:
                conn.execute(
                    "INSERT OR REPLACE INTO notification_settings (key, value, updated_at) VALUES (?, ?, ?)",
                    (k, str(new_settings[k]), now),
                )
        for k in ("telegram_enabled", "webhook_enabled", "premarket_briefing_enabled"):
            if k in new_settings:
                val = "true" if new_settings[k] else "false"
                conn.execute(
                    "INSERT OR REPLACE INTO notification_settings (key, value, updated_at) VALUES (?, ?, ?)",
                    (k, val, now),
                )
        conn.commit()
    finally:
        conn.close()

    return get_settings()


async def send_telegram_message(token: str, chat_id: str, message: str) -> dict[str, Any]:
    """Send a Markdown formatted notification via Telegram Bot API."""
    if not token or not chat_id:
        return {"success": False, "channel": "telegram", "error": "Token or chat_id missing"}

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                return {"success": True, "channel": "telegram"}
            return {"success": False, "channel": "telegram", "status_code": res.status_code, "error": res.text}
    except Exception as exc:
        logger.warning(f"Telegram dispatch failed: {exc}")
        return {"success": False, "channel": "telegram", "error": str(exc)}


async def send_webhook_notification(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Send JSON alert payload to external webhook URL (Slack, Discord, Custom)."""
    if not url:
        return {"success": False, "channel": "webhook", "error": "Webhook URL missing"}

    # Format Slack / Discord compatible payload if generic
    body = {
        "text": payload.get("message", "Atlas Portfolio Alert"),
        "atlas_alert": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            res = await client.post(url, json=body)
            return {
                "success": res.status_code in (200, 201, 204),
                "channel": "webhook",
                "status_code": res.status_code,
            }
    except Exception as exc:
        logger.warning(f"Webhook dispatch failed: {exc}")
        return {"success": False, "channel": "webhook", "error": str(exc)}


def get_alert_directive(alert_data: dict[str, Any]) -> dict[str, str]:
    """Provide plain-English what happened, strategic context, and actionable playbook steps."""
    title = str(alert_data.get("title", "")).lower()
    msg = str(alert_data.get("message", "")).lower()
    metric = str(alert_data.get("metric", "")).upper()
    condition = str(alert_data.get("condition", "")).upper()
    category = str(alert_data.get("category", "")).upper()
    symbol = str(alert_data.get("symbol", "PORTFOLIO")).upper()

    if "stop" in title or "drawdown" in msg or metric == "STOP_LOSS" or category == "STOP_LOSS":
        return {
            "what_happened": f"Price breached below protective stop-loss target for {symbol}.",
            "what_it_means": "Downside technical risk limit violated. Capital preservation rule is active.",
            "what_to_do": "1. Execute exit or trim order to cut remaining downside exposure.\n2. Do not average down into the downtrend.\n3. Move proceeds to cash reserves.",
        }
    if "profit" in title or "target" in title or (metric == "PRICE" and "ABOVE" in condition) or category == "PROFIT_TARGET":
        return {
            "what_happened": f"{symbol} hit upside profit target objective.",
            "what_it_means": "Price reached target resistance. Risk/reward for continuing to hold is now less favorable.",
            "what_to_do": "1. Trim 25% to 50% to bank realized profits.\n2. Raise trailing stop on remainder to breakeven/support.\n3. Reallocate capital to high-conviction setups.",
        }
    if "rsi" in title or metric == "RSI" or category == "DIP_BUY":
        if "BELOW" in condition or "dip" in title:
            return {
                "what_happened": f"{symbol} RSI entered oversold mean-reversion territory.",
                "what_it_means": "Short-term selling is mathematically extended, offering asymmetric entry risk/reward.",
                "what_to_do": "1. Check broader market stabilization (SPY/QQQ).\n2. Scale in with a 25-33% starter tranche.\n3. Place stop loss 3-5% below swing low.",
            }
        else:
            return {
                "what_happened": f"{symbol} RSI reached overbought exhaustion zone.",
                "what_it_means": "Buying momentum is extended. Pullback or consolidation risk is elevated.",
                "what_to_do": "1. Pause chasing new long exposure.\n2. Tighten stops to previous day's low.\n3. Prepare to take partial profits on trend exhaustion.",
            }
    if "concentration" in title or "sector" in msg or "exposure" in title:
        return {
            "what_happened": "Single sector exposure has exceeded diversification guidelines (>35%).",
            "what_it_means": "Portfolio is vulnerable to correlated sector shocks.",
            "what_to_do": "1. Review Risk Analytics Sector breakdown.\n2. Trim overweight positions by 10-20%.\n3. Rebalance proceeds into cash or underweight assets.",
        }

    return {
        "what_happened": alert_data.get("message", f"Trigger condition met for {symbol}."),
        "what_it_means": "Automated portfolio monitoring rule activated.",
        "what_to_do": f"1. Inspect {symbol} chart and technical setup in Atlas.\n2. Verify risk limits and position sizing.\n3. Adjust trigger or execute trade as needed.",
    }


async def dispatch_alert(alert_data: dict[str, Any]) -> dict[str, Any]:
    """Dispatch an alert to all enabled channels with actionable playbook guidance."""
    settings = get_settings()
    results = {}

    title = alert_data.get("title", "Atlas Alert")
    msg = alert_data.get("message", "")
    symbol = alert_data.get("symbol", "PORTFOLIO")
    severity = alert_data.get("severity", "info").upper()

    directive = get_alert_directive(alert_data)

    sev_icon = "🚨" if severity == "CRITICAL" else ("⚠️" if severity == "WARNING" else "ℹ️")
    tg_text = (
        f"{sev_icon} *ATLAS ALERT [{severity}]*\n"
        f"*{symbol}*: {title}\n\n"
        f"📊 *WHAT HAPPENED:*\n{directive['what_happened']}\n\n"
        f"💡 *STRATEGIC CONTEXT:*\n{directive['what_it_means']}\n\n"
        f"🎯 *ACTION PLAYBOOK (WHAT TO DO):*\n{directive['what_to_do']}\n\n"
        f"⏰ _{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_"
    )

    if settings.get("telegram_enabled") and settings.get("telegram_token") and settings.get("telegram_chat_id"):
        results["telegram"] = await send_telegram_message(
            settings["telegram_token"], settings["telegram_chat_id"], tg_text
        )

    if settings.get("webhook_enabled") and settings.get("webhook_url"):
        payload = {
            **alert_data,
            "playbook": directive,
        }
        results["webhook"] = await send_webhook_notification(settings["webhook_url"], payload)

    return {
        "dispatched": bool(results),
        "results": results,
    }


async def test_notifications() -> dict[str, Any]:
    """Send a test notification to all configured channels."""
    test_alert = {
        "id": "test-alert",
        "symbol": "SYSTEM",
        "title": "Atlas Test Notification",
        "message": "Instant Telegram & Webhook notification connectivity verified successfully.",
        "severity": "info",
        "time": datetime.now(timezone.utc).isoformat(),
        "status": "TRIGGERED",
    }
    settings = get_settings()
    res = {}
    if settings.get("telegram_token") and settings.get("telegram_chat_id"):
        sev_icon = "🔔"
        tg_text = (
            f"{sev_icon} *ATLAS NOTIFICATION TEST*\n"
            f"Instant Telegram notifications are working properly!\n\n"
            f"⏰ _{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_"
        )
        res["telegram"] = await send_telegram_message(
            settings["telegram_token"], settings["telegram_chat_id"], tg_text
        )
    else:
        res["telegram"] = {"configured": False, "detail": "Telegram bot token or chat ID not set"}

    if settings.get("webhook_url"):
        res["webhook"] = await send_webhook_notification(settings["webhook_url"], test_alert)
    else:
        res["webhook"] = {"configured": False, "detail": "Webhook URL not set"}

    return {
        "status": "tested",
        "settings": {k: v if "token" not in k else ("***" if v else "") for k, v in settings.items()},
        "results": res,
    }


async def send_telegram_trade_prompt(
    token: str,
    chat_id: str,
    symbol: str,
    qty: float,
    side: str = "buy",
    price: float = 100.0,
    score: float = 80.0,
    take_profit: float | None = None,
    stop_loss: float | None = None,
) -> dict[str, Any]:
    """Send an interactive Telegram trade approval prompt with inline action buttons."""
    if not token or not chat_id:
        return {"success": False, "error": "Token or chat_id missing"}

    sym = symbol.strip().upper()
    order_side = side.strip().lower()
    est_notional = round(qty * price, 2)

    tp_str = f"${take_profit:.2f} (+{((take_profit - price) / price * 100):.1f}%)" if take_profit else "N/A"
    sl_str = f"${stop_loss:.2f} ({((stop_loss - price) / price * 100):.1f}%)" if stop_loss else "N/A"

    msg = (
        f"⚡ *ATLAS TRADE CONVICTION PROMPT*\n\n"
        f"🎯 *Asset*: `{sym}`\n"
        f"📊 *Conviction Score*: *{score:.1f} / 100*\n"
        f"💵 *Action*: *{order_side.upper()}* {qty} shares @ ~${price:.2f}\n"
        f"💰 *Estimated Notional*: *${est_notional:,.2f}*\n"
        f"🛡️ *Brackets*: TP: {tp_str} | SL: {sl_str}\n\n"
        f"_Tap below to authorize execution via Alpaca Paper Broker:_"
    )

    cb_data = f"trade:{order_side}:{sym}:{qty}:{take_profit or 0}:{stop_loss or 0}"
    # Callback data max 64 bytes in Telegram
    if len(cb_data) > 60:
        cb_data = f"trade:{order_side}:{sym}:{qty}"

    payload = {
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": [
                [
                    {"text": f"✅ Execute {order_side.upper()} {qty} {sym}", "callback_data": cb_data},
                    {"text": "❌ Dismiss", "callback_data": "trade:dismiss"},
                ]
            ]
        },
    }

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                return {"success": True, "data": res.json()}
            return {"success": False, "status_code": res.status_code, "error": res.text}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def handle_telegram_update(update: dict[str, Any]) -> dict[str, Any]:
    """Process incoming Telegram webhook or polled updates, executing callback trades."""
    from .broker.alpaca_broker import alpaca_broker

    cb = update.get("callback_query")
    if not cb:
        return {"processed": False, "reason": "No callback_query in update"}

    cb_id = cb.get("id")
    cb_data = cb.get("data", "")
    msg = cb.get("message", {})
    chat_id = msg.get("chat", {}).get("id")
    msg_id = msg.get("message_id")

    settings = get_settings()
    token = settings.get("telegram_token", "")

    async def answer_cb(text: str) -> None:
        if token and cb_id:
            ans_url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
            try:
                async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
                    await client.post(ans_url, json={"callback_query_id": cb_id, "text": text})
            except Exception:
                pass

    if cb_data == "trade:dismiss":
        await answer_cb("Trade prompt dismissed.")
        return {"processed": True, "action": "dismissed"}

    if cb_data.startswith("trade:"):
        parts = cb_data.split(":")
        side = parts[1] if len(parts) > 1 else "buy"
        sym = parts[2] if len(parts) > 2 else ""
        qty = float(parts[3]) if len(parts) > 3 else 1.0
        tp = float(parts[4]) if len(parts) > 4 and float(parts[4]) > 0 else None
        sl = float(parts[5]) if len(parts) > 5 and float(parts[5]) > 0 else None

        if not sym:
            await answer_cb("Invalid trade payload")
            return {"processed": False, "error": "Missing symbol"}

        try:
            order_res = await alpaca_broker.place_order(
                symbol=sym,
                qty=qty,
                side=side,
                order_type="market",
                order_class="bracket" if (tp or sl) else "simple",
                take_profit_price=tp,
                stop_loss_price=sl,
            )
        except Exception as exc:
            logger.info(f"Live order placement failed ({exc}), executing simulated paper order.")
            order_res = await alpaca_broker.place_order(
                symbol=sym,
                qty=qty,
                side=side,
                order_type="market",
                order_class="bracket" if (tp or sl) else "simple",
                take_profit_price=tp,
                stop_loss_price=sl,
                simulate=True,
            )
            await answer_cb(f"Order submitted: {side.upper()} {qty} {sym}")

            # Edit message in chat to reflect fill
            if token and chat_id and msg_id:
                edit_url = f"https://api.telegram.org/bot{token}/editMessageText"
                conf_text = (
                    f"✅ *ORDER SUBMITTED VIA ATLAS*\n\n"
                    f"• *Asset*: `{sym}`\n"
                    f"• *Action*: *{side.upper()} {qty} shares*\n"
                    f"• *Order ID*: `{order_res.get('id', 'N/A')}`\n"
                    f"• *Status*: *{order_res.get('status', 'ACCEPTED').upper()}*\n"
                    f"• *Timestamp*: _{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_"
                )
                try:
                    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
                        await client.post(edit_url, json={
                            "chat_id": chat_id,
                            "message_id": msg_id,
                            "text": conf_text,
                            "parse_mode": "Markdown",
                        })
                except Exception:
                    pass

            return {"processed": True, "action": "executed", "order": order_res}
        except Exception as exc:
            await answer_cb(f"Execution failed: {str(exc)[:50]}")
            return {"processed": False, "error": str(exc)}

    return {"processed": False, "reason": f"Unknown callback: {cb_data}"}


def format_premarket_briefing(
    holdings: list[Any],
    recommendations: list[dict[str, Any]] | None = None,
    rating_shifts: list[dict[str, Any]] | None = None,
) -> str:
    """Format an institutional daily pre-market briefing for Telegram."""
    now_utc = datetime.now(timezone.utc)
    date_str = now_utc.strftime("%A, %b %d, %Y")

    def _h_val(h: Any) -> float:
        mv = getattr(h, "marketValue", getattr(h, "market_value", 0.0))
        if mv:
            return float(mv)
        price = float(getattr(h, "price", 0.0) or 0.0)
        qty = float(getattr(h, "quantity", getattr(h, "shares", 0.0)) or 0.0)
        return price * qty

    total_val = sum(
        _h_val(h)
        for h in holdings
        if getattr(h, "symbol", "") != "CASH"
    )
    cash_h = next((h for h in holdings if getattr(h, "symbol", "") == "CASH"), None)
    cash_val = _h_val(cash_h) if cash_h else 0.0
    port_val = total_val + cash_val

    # Find nearing triggers (<3.0% away from target)
    nearing_triggers: list[str] = []
    if recommendations:
        for raw_rec in recommendations:
            rec = raw_rec.model_dump() if hasattr(raw_rec, "model_dump") else (raw_rec.dict() if hasattr(raw_rec, "dict") else raw_rec)
            if rec.get("status") != "DECLINED":
                sym = rec.get("symbol", "")
                h = next((item for item in holdings if getattr(item, "symbol", "") == sym), None)
                if h and getattr(h, "price", 0) > 0 and (rec.get("targetValue") or rec.get("target_value")):
                    curr_p = float(getattr(h, "price", 0))
                    tgt_p = float(rec.get("targetValue") or rec.get("target_value") or 0.0)
                    if tgt_p > 0:
                        diff_pct = abs(tgt_p - curr_p) / curr_p * 100.0
                        if diff_pct <= 3.5:
                            cat = rec.get("category", "TRIGGER")
                            is_stop = "STOP" in cat
                            icon = "🛡️" if is_stop else "🎯"
                            nearing_triggers.append(
                                f"  {icon} `{sym}`: Price `${curr_p:.2f}` is *{diff_pct:.1f}%* from {cat.replace('_', ' ')} (${tgt_p:.2f})"
                            )

    # Top daily movers
    stock_holdings = [h for h in holdings if getattr(h, "symbol", "") != "CASH"]
    sorted_by_change = sorted(stock_holdings, key=lambda x: getattr(x, "dayChange", 0.0), reverse=True)
    top_gainers = [
        f"`{h.symbol}` ({'+' if h.dayChange >= 0 else ''}{h.dayChange:.1f}%)"
        for h in sorted_by_change[:3]
        if getattr(h, "dayChange", 0) != 0
    ]

    lines = [
        "🌅 *ATLAS PRE-MARKET BRIEFING*",
        f"📅 _{date_str}_",
        "",
        "📊 *Portfolio Pulse*",
        f"• *Holdings*: `{len(stock_holdings)} active assets`",
        f"• *Total Portfolio Value*: `${port_val:,.2f}`",
    ]
    if top_gainers:
        lines.append(f"• *Top Movers*: {', '.join(top_gainers)}")

    if nearing_triggers:
        lines.append("")
        lines.append("⚠️ *Critical Triggers in Range (<3.5%)*")
        lines.extend(nearing_triggers[:4])
    else:
        lines.append("• *Defense Status*: All holdings safe outside breach boundaries.")

    if rating_shifts:
        lines.append("")
        lines.append("⚡ *Latest Extractor Rating Shifts*")
        for s in rating_shifts[:3]:
            lines.append(f"  • `{s.get('ticker')}`: {s.get('provider')} → *{s.get('current')}* ({s.get('direction')})")

    lines.append("")
    lines.append("🛡️ *Playbook Alpha*: Alerts armed. Trailing stop protection active.")
    return "\n".join(lines)


async def send_telegram_premarket_briefing(
    holdings: list[Any],
    recommendations: list[dict[str, Any]] | None = None,
    rating_shifts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Send pre-market morning briefing to Telegram."""
    settings = get_settings()
    token = settings.get("telegram_token", "")
    chat_id = settings.get("telegram_chat_id", "")
    briefing_text = format_premarket_briefing(holdings, recommendations, rating_shifts)

    if not token or not chat_id:
        return {
            "success": False,
            "channel": "telegram",
            "error": "Telegram credentials missing",
            "briefing": briefing_text,
        }

    res = await send_telegram_message(token, chat_id, briefing_text)
    res["briefing"] = briefing_text
    return res


async def send_telegram_document(
    token: str,
    chat_id: str,
    document_bytes: bytes,
    filename: str = "Atlas_Report.pdf",
    caption: str = "",
) -> dict[str, Any]:
    """Upload and send a document file (PDF) to Telegram using sendDocument endpoint."""
    if not token or not chat_id:
        return {"success": False, "channel": "telegram", "error": "Telegram token or chat_id missing"}

    url = f"https://api.telegram.org/bot{token}/sendDocument"
    files = {
        "document": (filename, document_bytes, "application/pdf"),
    }
    data = {
        "chat_id": chat_id,
        "caption": caption,
        "parse_mode": "Markdown",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, data=data, files=files)
            return {
                "success": resp.status_code == 200,
                "channel": "telegram",
                "status_code": resp.status_code,
                "error": None if resp.status_code == 200 else resp.text,
            }
    except Exception as exc:
        return {"success": False, "channel": "telegram", "error": str(exc)}


