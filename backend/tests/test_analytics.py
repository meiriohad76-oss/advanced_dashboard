import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.analytics_service import _pearson_corr, get_correlation_matrix, get_benchmark_comparison


client = TestClient(app)


def test_pearson_correlation():
    x = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    y = [2.0, 4.0, 6.0, 8.0, 10.0, 12.0]
    corr = _pearson_corr(x, y)
    assert corr == 1.0

    y_inv = [12.0, 10.0, 8.0, 6.0, 4.0, 2.0]
    corr_inv = _pearson_corr(x, y_inv)
    assert corr_inv == -1.0


def test_correlation_matrix_calculation():
    import asyncio
    holdings = [
        {"symbol": "ANET", "weight": 15.0, "price": 280.0},
        {"symbol": "CRDO", "weight": 12.0, "price": 45.0},
        {"symbol": "VRT", "weight": 10.0, "price": 95.0},
        {"symbol": "CASH", "weight": 5.0, "price": 1.0},
    ]
    res = asyncio.run(get_correlation_matrix(holdings, max_symbols=3))
    assert "symbols" in res
    assert len(res["symbols"]) == 3
    assert res["symbols"] == ["ANET", "CRDO", "VRT"]
    assert len(res["matrix"]) == 3
    assert res["matrix"][0][0] == 1.0
    assert res["matrix"][1][1] == 1.0


def test_benchmark_comparison_calculation():
    import asyncio
    holdings = [
        {"symbol": "ANET", "weight": 50.0, "price": 280.0},
        {"symbol": "CRDO", "weight": 50.0, "price": 45.0},
    ]
    res = asyncio.run(get_benchmark_comparison(holdings, range_str="1y"))
    assert "series" in res
    assert "metrics" in res
    assert "portfolio_return" in res["metrics"]
    assert "spy_return" in res["metrics"]
    assert "alpha" in res["metrics"]
    assert "beta" in res["metrics"]
    assert "sharpe" in res["metrics"]
    assert "max_drawdown" in res["metrics"]


def test_analytics_endpoints():
    r_corr = client.get("/api/v1/analytics/correlation")
    assert r_corr.status_code == 200
    data_corr = r_corr.json()["data"]
    assert "symbols" in data_corr
    assert "matrix" in data_corr

    r_bench = client.get("/api/v1/analytics/benchmark-comparison?range=6mo")
    assert r_bench.status_code == 200
    data_bench = r_bench.json()["data"]
    assert "series" in data_bench
    assert "metrics" in data_bench
