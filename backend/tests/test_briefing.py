import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.briefing_service import generate_daily_briefing
from app.data import BASE_HOLDINGS


client = TestClient(app)


def test_generate_daily_briefing():
    import asyncio
    res = asyncio.run(generate_daily_briefing(BASE_HOLDINGS))
    assert "date" in res
    assert "pulse" in res
    assert res["pulse"]["total_value"] > 0
    assert "top_setups" in res
    assert len(res["top_setups"]) <= 3
    assert "catalysts" in res
    assert "risk" in res
    assert "executive_stance" in res["risk"]
    assert "telegram_markdown" in res
    assert "☀️ *ATLAS PRE-MARKET EXECUTIVE BRIEFING*" in res["telegram_markdown"]


def test_briefing_api_endpoints():
    r_briefing = client.get("/api/v1/briefing/daily")
    assert r_briefing.status_code == 200
    data = r_briefing.json()["data"]
    assert "pulse" in data
    assert "top_setups" in data
    assert "telegram_markdown" in data
