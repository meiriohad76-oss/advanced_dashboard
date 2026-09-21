"""Unit and integration tests for Features 2, 4, and 5:
- Persistent Alert History & Playbook Alpha Audit Log
- Daily Telegram Pre-Market Briefing
- Strategy Backtester for Alert Playbooks
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import store, notifications, backtest_service
from app.models import Holding

client = TestClient(app)


def test_alert_history_store_and_endpoints(tmp_path):
    test_db = str(tmp_path / "test_atlas.db")

    # 1. Save entry to store
    entry = {
        "id": "hist_test_1",
        "symbol": "NVDA",
        "title": "NVDA Trailing Stop Loss Breached",
        "category": "STOP_LOSS",
        "metric": "PRICE",
        "condition": "BELOW",
        "target_value": 112.50,
        "triggered_price": 111.80,
        "triggered_at": "2026-09-21T08:30:00Z",
        "playbook_directive": "Execute immediate exit to cash to protect capital.",
        "action_taken": "UNACKNOWLEDGED",
    }
    saved = store.save_alert_history_entry(entry, path=test_db)
    assert saved["id"] == "hist_test_1"
    assert saved["action_taken"] == "UNACKNOWLEDGED"

    # 2. Retrieve history
    history = store.get_alert_history(path=test_db)
    assert len(history) == 1
    assert history[0]["symbol"] == "NVDA"
    assert history[0]["triggered_price"] == 111.80

    # 3. Update action taken (e.g. TRIMMED or STOPPED_OUT_CASH)
    updated = store.update_alert_history_action(
        entry_id="hist_test_1",
        action_taken="STOPPED_OUT_CASH",
        notes="Sold 50 shares at market",
        alpha_saved_or_locked=850.0,
        path=test_db,
    )
    assert updated is not None
    assert updated["action_taken"] == "STOPPED_OUT_CASH"
    assert updated["alpha_saved_or_locked"] == 850.0

    # 4. Verify in history query
    history2 = store.get_alert_history(path=test_db)
    assert history2[0]["action_taken"] == "STOPPED_OUT_CASH"
    assert history2[0]["notes"] == "Sold 50 shares at market"

    # 5. Delete entry
    deleted = store.delete_alert_history_entry("hist_test_1", path=test_db)
    assert deleted is True
    assert len(store.get_alert_history(path=test_db)) == 0


def test_alert_history_api_routes():
    # Test through REST API
    post_res = client.post(
        "/api/v1/alerts/history",
        json={
            "id": "hist_api_1",
            "symbol": "PLTR",
            "title": "PLTR Take Profit Target Hit",
            "category": "PROFIT_TARGET",
            "target_value": 36.00,
            "triggered_price": 36.25,
            "playbook_directive": "Trim 33% of position to lock in profit.",
        },
    )
    assert post_res.status_code == 200
    data = post_res.json()["data"]
    assert data["symbol"] == "PLTR"

    # Fetch list
    get_res = client.get("/api/v1/alerts/history")
    assert get_res.status_code == 200
    history_list = get_res.json()["data"]
    assert any(h["id"] == "hist_api_1" for h in history_list)

    # Act on entry
    act_res = client.post(
        "/api/v1/alerts/history/hist_api_1/action",
        json={"action": "TRIMMED", "notes": "Trimmed 33% at 36.25", "alpha_saved_or_locked": 1200.0},
    )
    assert act_res.status_code == 200
    assert act_res.json()["data"]["action_taken"] == "TRIMMED"

    # Delete
    del_res = client.delete("/api/v1/alerts/history/hist_api_1")
    assert del_res.status_code == 200
    assert del_res.json()["data"]["deleted"] is True


def test_premarket_briefing_formatter():
    mock_holdings = [
        Holding(
            symbol="NVDA",
            name="NVIDIA Corp",
            quantity=100.0,
            price=120.0,
            avgCost=100.0,
            weight=0.5,
            dayChange=2.5,
        ),
        Holding(
            symbol="PLTR",
            name="Palantir Technologies",
            quantity=200.0,
            price=35.50,
            avgCost=25.0,
            weight=0.3,
            dayChange=-1.2,
        ),
        Holding(
            symbol="CASH",
            name="USD Cash",
            quantity=5000.0,
            price=1.0,
            avgCost=1.0,
            weight=0.2,
            dayChange=0.0,
        ),
    ]

    mock_recs = [
        {
            "symbol": "PLTR",
            "category": "PROFIT_TARGET",
            "targetValue": 36.00,  # ~1.4% away from 35.50 -> Should be flagged as nearing trigger!
            "status": "ACKNOWLEDGED",
        }
    ]

    mock_shifts = [
        {"ticker": "NVDA", "provider": "Seeking Alpha", "current": "Strong Buy", "direction": "UPGRADE"}
    ]

    briefing = notifications.format_premarket_briefing(
        holdings=mock_holdings,
        recommendations=mock_recs,
        rating_shifts=mock_shifts,
    )

    assert "ATLAS PRE-MARKET BRIEFING" in briefing
    assert "Portfolio Pulse" in briefing
    assert "$24,100.00" in briefing  # Total value
    assert "PLTR" in briefing
    assert "PROFIT TARGET" in briefing
    assert "Seeking Alpha" in briefing


def test_premarket_briefing_test_endpoint():
    res = client.post("/api/v1/notifications/briefing/test")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "briefing" in data
    assert "ATLAS PRE-MARKET BRIEFING" in data["briefing"]


def test_playbook_defense_backtester():
    # 1. Direct function call
    res = backtest_service.run_backtest(
        symbol="NVDA",
        strategy_mode="playbook_defense",
        lookback="1y",
        stop_loss_pct=6.0,
        take_profit_pct=15.0,
    )

    params = res["parameters"]
    assert params["strategy_mode"] == "playbook_defense"
    assert params["stop_loss_pct"] == 6.0
    assert params["take_profit_pct"] == 15.0

    metrics = res["metrics"]
    assert "drawdown_avoided_pct" in metrics
    assert "capital_preserved" in metrics
    assert "benchmark_max_drawdown_pct" in metrics
    assert "max_drawdown_pct" in metrics
    assert metrics["final_equity"] > 0
    assert len(res["equity_curve"]) > 50

    # 2. REST API call with strategy_mode
    api_res = client.post(
        "/api/v1/analytics/backtest",
        json={
            "symbol": "PLTR",
            "strategy_mode": "playbook_defense",
            "lookback": "6mo",
            "stop_loss_pct": 6.0,
            "take_profit_pct": 15.0,
        },
    )
    assert api_res.status_code == 200
    api_data = api_res.json()["data"]
    assert api_data["parameters"]["strategy_mode"] == "playbook_defense"
    assert "drawdown_avoided_pct" in api_data["metrics"]
