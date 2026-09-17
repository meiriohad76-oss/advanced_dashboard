import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.catalysts_service import get_earnings_calendar, get_dividend_projections
from app.data import BASE_HOLDINGS


client = TestClient(app)


def test_get_earnings_calendar():
    import asyncio
    res = asyncio.run(get_earnings_calendar(BASE_HOLDINGS))
    assert "events" in res
    assert "summary" in res
    assert res["summary"]["total_upcoming"] > 0
    assert len(res["events"]) > 0

    first = res["events"][0]
    assert "symbol" in first
    assert "earnings_date" in first
    assert "days_until" in first
    assert "timing" in first
    assert first["timing"] in ("BMO", "AMC")
    assert "eps_estimate" in first
    assert "is_high_risk" in first


def test_get_dividend_projections():
    res = get_dividend_projections(BASE_HOLDINGS)
    assert "summary" in res
    assert "monthly_cashflow" in res
    assert "holdings" in res
    assert "upcoming_ex_dates" in res

    summary = res["summary"]
    assert summary["total_annual_income"] >= 0
    assert summary["portfolio_yield_pct"] >= 0
    assert len(res["monthly_cashflow"]) == 12


def test_catalysts_api_endpoints():
    r_earn = client.get("/api/v1/catalysts/earnings")
    assert r_earn.status_code == 200
    data_earn = r_earn.json()["data"]
    assert "events" in data_earn
    assert "summary" in data_earn

    r_div = client.get("/api/v1/catalysts/dividends")
    assert r_div.status_code == 200
    data_div = r_div.json()["data"]
    assert "summary" in data_div
    assert "monthly_cashflow" in data_div
