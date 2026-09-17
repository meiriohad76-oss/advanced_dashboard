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


def test_live_alerts_skips_uncategorized_and_resolves_sector():
    from app.live_enricher import generate_live_alerts
    from app.models import Holding

    # Test holdings with Uncategorized sector: should resolve to Aerospace & Defense for LMT / KTOS
    h1 = Holding(symbol="LMT", name="Lockheed Martin", sector="Uncategorized", quantity=10, price=450.0, avgCost=400.0, dayChange=0.5, weight=20.0, rsi=50.0, macdBullish=True, aboveSma50=True, aboveSma200=True, relativeVolume=1.0, breakout20d=False, trendSlopePositive=True, returnsHistory=[0.01, -0.01])
    h2 = Holding(symbol="KTOS", name="Kratos Defense", sector="Uncategorized", quantity=100, price=25.0, avgCost=20.0, dayChange=0.2, weight=15.0, rsi=50.0, macdBullish=True, aboveSma50=True, aboveSma200=True, relativeVolume=1.0, breakout20d=False, trendSlopePositive=True, returnsHistory=[0.01, -0.01])
    h3 = Holding(symbol="XYZ_UNKNOWN", name="Mystery Corp", sector="Uncategorized", quantity=50, price=10.0, avgCost=10.0, dayChange=0.0, weight=65.0, rsi=50.0, macdBullish=True, aboveSma50=True, aboveSma200=True, relativeVolume=1.0, breakout20d=False, trendSlopePositive=True, returnsHistory=[0.0, 0.0])

    alerts = generate_live_alerts([h1, h2, h3])
    # The concentration alert should NOT say Uncategorized
    for a in alerts:
        if a.title == "Sector concentration":
            assert "Uncategorized" not in a.message
            assert "Aerospace & Defense" in a.message
            assert "35.0%" in a.message


