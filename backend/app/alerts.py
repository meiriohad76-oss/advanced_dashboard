"""Real-time alert dispatching and webhook integration (spec section 44).

Formats alert events (entry thresholds crossed, concentration limits breached, breakout
events) into standard JSON payloads and dispatches them via HTTP POST to configured
webhook endpoints (e.g. Slack/Telegram/custom webhooks).
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from typing import Any

from .models import Alert


def format_alert_payload(alert: Alert) -> dict[str, Any]:
    """Format an Alert object into a standard webhook JSON payload."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "event_id": alert.id,
        "symbol": alert.symbol,
        "title": alert.title,
        "message": alert.message,
        "status": alert.status,
        "severity": alert.severity,
        "triggered_at": now,
        "source": "Atlas Portfolio Intelligence",
    }


def dispatch_alert(alert: Alert, webhook_url: str | None = None, timeout: float = 5.0) -> dict[str, Any]:
    """Dispatch an alert payload to a webhook URL.

    Uses ATLAS_WEBHOOK_URL from environment if webhook_url is not explicitly passed.
    Returns status dict indicating success or error.
    """
    url = webhook_url or os.environ.get("ATLAS_WEBHOOK_URL")
    payload = format_alert_payload(alert)

    if not url:
        return {"status": "skipped", "reason": "No webhook URL configured", "payload": payload}

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Atlas-Dashboard-Alerts/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = resp.getcode()
            return {"status": "sent", "http_code": code, "payload": payload}
    except Exception as exc:
        return {"status": "failed", "error": str(exc), "payload": payload}
