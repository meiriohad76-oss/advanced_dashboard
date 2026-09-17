import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.notifications import handle_telegram_update
from app.broker.alpaca_broker import alpaca_broker

client = TestClient(app)


def test_bracket_order_placement():
    res = asyncio.run(
        alpaca_broker.place_order(
            symbol="ANET",
            qty=10,
            side="buy",
            order_class="bracket",
            take_profit_price=320.0,
            stop_loss_price=265.0,
            simulate=True,
        )
    )
    assert res["status"] in ("filled", "accepted")
    assert res["symbol"] == "ANET"
    assert res["order_class"] == "bracket"


def test_telegram_webhook_trade_callback():
    update = {
        "update_id": 9999,
        "callback_query": {
            "id": "cb-12345",
            "data": "trade:buy:CRDO:25:52.0:41.0",
            "message": {
                "message_id": 888,
                "chat": {"id": 123456789},
            },
        },
    }
    res = asyncio.run(handle_telegram_update(update))
    assert res["processed"] is True
    assert res["action"] == "executed"
    assert res["order"]["symbol"] == "CRDO"
    assert res["order"]["qty"] == 25


def test_telegram_webhook_dismiss_callback():
    update = {
        "update_id": 10000,
        "callback_query": {
            "id": "cb-12346",
            "data": "trade:dismiss",
            "message": {"message_id": 889, "chat": {"id": 123456789}},
        },
    }
    res = asyncio.run(handle_telegram_update(update))
    assert res["processed"] is True
    assert res["action"] == "dismissed"


def test_telegram_webhook_endpoint():
    payload = {
        "update_id": 10001,
        "callback_query": {
            "id": "cb-12347",
            "data": "trade:dismiss",
            "message": {"message_id": 890, "chat": {"id": 123456789}},
        },
    }
    r = client.post("/api/v1/notifications/telegram/webhook", json=payload)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["processed"] is True
