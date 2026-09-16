import pytest

from app.alerts import dispatch_alert, format_alert_payload
from app.data import BASE_ALERTS
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_format_alert_payload():
    alert = BASE_ALERTS[0]
    payload = format_alert_payload(alert)
    assert payload["event_id"] == alert.id
    assert payload["symbol"] == alert.symbol
    assert payload["title"] == alert.title
    assert payload["source"] == "Atlas Portfolio Intelligence"
    assert "triggered_at" in payload


def test_dispatch_alert_skipped_when_no_webhook():
    alert = BASE_ALERTS[1]
    res = dispatch_alert(alert, webhook_url=None)
    assert res["status"] == "skipped"
    assert res["reason"] == "No webhook URL configured"


def test_alerts_endpoints():
    res = client.post("/api/v1/alerts/test")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "skipped"

    res_dispatch = client.post("/api/v1/alerts/dispatch")
    assert res_dispatch.status_code == 200
    assert "triggered_count" in res_dispatch.json()["data"]


def test_dispatch_alert_to_live_server():
    import os
    import sys
    import threading
    import time
    from http.server import HTTPServer

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if root not in sys.path:
        sys.path.insert(0, root)

    from scripts.mock_webhook_server import WebhookHandler

    # Start mock server on port 8999 in daemon thread
    server = HTTPServer(("127.0.0.1", 8999), WebhookHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    time.sleep(0.1)

    try:
        res = client.post("/api/v1/alerts/test?webhook_url=http://127.0.0.1:8999/webhook")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "sent"
        assert data["http_code"] == 200
    finally:
        server.shutdown()

