from fastapi.testclient import TestClient
from app.main import app
from app.broker.alpaca_broker import calculate_portfolio_rebalance
from app.models import Holding

client = TestClient(app)


def test_order_placement_and_history():
    # Place a paper order
    res = client.post("/api/v1/broker/alpaca/order", json={
        "symbol": "AAPL",
        "quantity": 10,
        "side": "buy",
        "type": "market",
    })
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["symbol"] == "AAPL"
    assert data["side"] == "buy"
    assert data["qty"] == 10
    assert "status" in data


def test_portfolio_rebalance_calculation():
    res = client.get("/api/v1/portfolio/rebalance?max_position=12&max_sector=30")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "orders" in data
    assert "total_rebalance_amount" in data
    assert "portfolio_value" in data
    if data["orders_count"] > 0:
        first = data["orders"][0]
        assert "symbol" in first
        assert "side" in first
        assert first["side"] in ("buy", "sell")
        assert first["quantity"] > 0


def test_portfolio_rebalance_execution():
    orders = [
        {"symbol": "CRDO", "quantity": 5, "side": "buy"},
        {"symbol": "NVDA", "quantity": 2, "side": "sell"},
    ]
    res = client.post("/api/v1/portfolio/rebalance/execute", json={"orders": orders})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["executed_count"] == 2
    assert data["failed_count"] == 0
