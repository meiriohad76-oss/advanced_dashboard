import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.backtest_service import run_backtest
from app.data import BASE_HOLDINGS


client = TestClient(app)


def test_run_backtest_simulation():
    res = run_backtest(
        holdings=BASE_HOLDINGS,
        entry_score=75,
        exit_score=50,
        lookback="1y",
        initial_capital=100000.0,
    )
    assert "parameters" in res
    assert "metrics" in res
    assert "trades" in res
    assert "equity_curve" in res

    metrics = res["metrics"]
    assert "total_return_pct" in metrics
    assert "benchmark_return_pct" in metrics
    assert "alpha_pct" in metrics
    assert "cagr_pct" in metrics
    assert "sharpe_ratio" in metrics
    assert "max_drawdown_pct" in metrics
    assert "win_rate_pct" in metrics
    assert len(res["equity_curve"]) == 252


def test_backtest_api_endpoint():
    r = client.post("/api/v1/analytics/backtest", json={
        "entry_score": 70,
        "exit_score": 45,
        "lookback": "6mo",
        "initial_capital": 50000.0,
    })
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["parameters"]["lookback"] == "6mo"
    assert len(data["equity_curve"]) == 126
    assert data["parameters"]["initial_capital"] == 50000.0
