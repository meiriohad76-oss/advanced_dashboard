from fastapi.testclient import TestClient
from app.main import app
from app.bars_service import get_symbol_bars, _generate_synthetic_bars

client = TestClient(app)


def test_synthetic_bars_generation():
    bars = _generate_synthetic_bars("TEST", base_price=150.0, num_bars=30)
    assert len(bars) == 30
    assert "time" in bars[0]
    assert "open" in bars[0]
    assert "high" in bars[0]
    assert "low" in bars[0]
    assert "close" in bars[0]
    assert "volume" in bars[0]
    assert bars[0]["high"] >= bars[0]["low"]


def test_market_bars_api_endpoint():
    res = client.get("/api/v1/market/bars/CRDO?range=1mo")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    body = data["data"]
    assert body["symbol"] == "CRDO"
    assert "bars" in body
    assert len(body["bars"]) > 0
    bar = body["bars"][-1]
    assert "open" in bar
    assert "close" in bar
    assert "high" in bar
    assert "low" in bar
