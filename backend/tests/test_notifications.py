import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import notifications

client = TestClient(app)


def test_notification_settings_flow():
    # 1. Get initial settings
    res = client.get("/api/v1/notifications/settings")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "telegram_enabled" in data
    assert "webhook_enabled" in data

    # 2. Update settings
    update_payload = {
        "telegram_token": "mock_token_123",
        "telegram_chat_id": "-10012345678",
        "telegram_enabled": True,
        "webhook_url": "https://example.com/webhook",
        "webhook_enabled": True,
        "min_severity": "critical",
    }
    save_res = client.post("/api/v1/notifications/settings", json=update_payload)
    assert save_res.status_code == 200
    saved = save_res.json()["data"]
    assert saved["telegram_token"] == "mock_token_123"
    assert saved["telegram_chat_id"] == "-10012345678"
    assert saved["telegram_enabled"] is True
    assert saved["webhook_url"] == "https://example.com/webhook"
    assert saved["webhook_enabled"] is True
    assert saved["min_severity"] == "critical"


def test_notification_test_endpoint():
    res = client.post("/api/v1/notifications/test")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "tested"
    assert "results" in data
