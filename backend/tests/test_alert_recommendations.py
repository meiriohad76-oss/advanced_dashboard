import pytest
from app.alert_recommendations import generate_all_recommendations, generate_ticker_recommendations
from app.models import Holding
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_generate_ticker_recommendations_owned():
    recs = generate_ticker_recommendations(
        symbol="NVDA",
        name="NVIDIA Corporation",
        price=120.0,
        avg_cost=100.0,
        rsi=45.0,
        above_sma50=True,
        above_sma200=True,
        relative_volume=1.5,
        target_price=150.0,
        is_owned=True,
    )

    assert len(recs) >= 3
    categories = [r.category for r in recs]
    assert "PROFIT_TARGET" in categories
    assert "DIP_BUY" in categories
    assert "STOP_LOSS" in categories

    # Verify profit target
    pt = next(r for r in recs if r.category == "PROFIT_TARGET")
    assert pt.target_value == 150.0
    assert pt.potential_delta_pct == 25.0
    assert pt.condition == "ABOVE"
    assert pt.status == "PENDING"

    # Verify stop loss
    sl = next(r for r in recs if r.category == "STOP_LOSS")
    assert sl.condition == "BELOW"
    assert sl.severity == "critical"
    assert sl.target_value < 120.0
    assert sl.target_value == round(120.0 * 0.94, 2)
    assert sl.potential_delta_pct == -6.0


def test_generate_ticker_recommendations_owned_in_drawdown():
    # Verify holding in drawdown (cost > price) sets stop BELOW current market price, never above
    recs = generate_ticker_recommendations(
        symbol="PLTR",
        name="Palantir Technologies",
        price=15.37,
        avg_cost=28.35,
        rsi=40.0,
        above_sma50=False,
        above_sma200=True,
        relative_volume=1.2,
        is_owned=True,
    )
    sl = next(r for r in recs if r.category == "STOP_LOSS")
    assert sl.target_value < 15.37
    assert sl.target_value == round(15.37 * 0.94, 2)
    assert sl.potential_delta_pct == -6.0
    assert "below current price $15.37" in sl.rationale


def test_generate_ticker_recommendations_watchlist_candidate():
    recs = generate_ticker_recommendations(
        symbol="ARM",
        name="Arm Holdings",
        price=140.0,
        avg_cost=None,
        rsi=69.0,
        above_sma50=True,
        above_sma200=True,
        relative_volume=2.0,
        target_price=160.0,
        is_owned=False,
    )

    categories = [r.category for r in recs]
    assert "PROFIT_TARGET" in categories
    assert "BREAKOUT" in categories
    assert "RSI_REVERSAL" in categories  # Since RSI is 69


def test_recommendations_api_endpoints():
    res = client.get("/api/v1/alerts/recommendations")
    assert res.status_code == 200
    data = res.json()["data"]
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "id" in first
        assert "symbol" in first
        assert "category" in first
        assert "status" in first
        rec_id = first["id"]

        # Test Acknowledge action
        act_res = client.post(
            f"/api/v1/alerts/recommendations/{rec_id}/action",
            json={
                "action": "acknowledge",
                "symbol": first["symbol"],
                "category": first["category"],
                "custom_alert": {
                    "id": f"usr-test-{rec_id}",
                    "symbol": first["symbol"],
                    "metric": first["metric"],
                    "condition": first["condition"],
                    "targetValue": first["target_value"],
                    "severity": first["severity"],
                    "status": "ARMED",
                }
            }
        )
        assert act_res.status_code == 200
        assert act_res.json()["data"]["status"] == "ACKNOWLEDGED"

        # Verify user alert was created
        user_res = client.get("/api/v1/alerts/user-alerts")
        assert user_res.status_code == 200
        user_alerts = user_res.json()["data"]
        assert any(a["id"] == f"usr-test-{rec_id}" for a in user_alerts)

        # Test Decline action
        dec_res = client.post(
            f"/api/v1/alerts/recommendations/{rec_id}/action",
            json={
                "action": "decline",
                "symbol": first["symbol"],
                "category": first["category"],
            }
        )
        assert dec_res.status_code == 200
        assert dec_res.json()["data"]["status"] == "DECLINED"

        # Clean up created alert
        del_res = client.delete(f"/api/v1/alerts/user-alerts/usr-test-{rec_id}")
        assert del_res.status_code == 200
