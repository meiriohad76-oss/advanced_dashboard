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
    }


def save_settings(new_settings: dict[str, Any]) -> dict[str, Any]:
    """Save updated notification configuration to SQLite."""
    path = store._db_path()
    conn = store._connect(path)
    _ensure_settings_table(conn)
    now = datetime.now(timezone.utc).isoformat()
    try:
        for k in ("telegram_token", "telegram_chat_id", "webhook_url", "min_severity"):
            if k in new_settings:
                conn.execute(
                    "INSERT OR REPLACE INTO notification_settings (key, value, updated_at) VALUES (?, ?, ?)",
                    (k, str(new_settings[k]), now),
                )
        for k in ("telegram_enabled", "webhook_enabled"):
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


async def dispatch_alert(alert_data: dict[str, Any]) -> dict[str, Any]:
    """Dispatch an alert to all enabled channels."""
    settings = get_settings()
    results = {}

    title = alert_data.get("title", "Atlas Alert")
    msg = alert_data.get("message", "")
    symbol = alert_data.get("symbol", "PORTFOLIO")
    severity = alert_data.get("severity", "info").upper()

    sev_icon = "🚨" if severity == "CRITICAL" else ("⚠️" if severity == "WARNING" else "ℹ️")
    tg_text = (
        f"{sev_icon} *ATLAS ALERT [{severity}]*\n"
        f"*{symbol}*: {title}\n\n"
        f"{msg}\n\n"
        f"⏰ _{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_"
    )

    if settings.get("telegram_enabled") and settings.get("telegram_token") and settings.get("telegram_chat_id"):
        results["telegram"] = await send_telegram_message(
            settings["telegram_token"], settings["telegram_chat_id"], tg_text
        )

    if settings.get("webhook_enabled") and settings.get("webhook_url"):
        results["webhook"] = await send_webhook_notification(settings["webhook_url"], alert_data)

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
