import pytest
from app import bars_service, intraday_service
from app.models import Holding


@pytest.mark.anyio
async def test_bars_service_intraday_and_vwap():
    # Test 15m bar generation & VWAP calculation
    data_15m = await bars_service.get_symbol_bars("AAPL", range_str="5d", interval="15m", base_price=150.0)
    assert data_15m["symbol"] == "AAPL"
    assert data_15m["interval"] == "15m"
    assert len(data_15m["bars"]) > 0
    assert "vwap" in data_15m
    assert data_15m["vwap"] is not None

    # Verify each bar has expected fields
    latest = data_15m["bars"][-1]
    assert "open" in latest
    assert "high" in latest
    assert "low" in latest
    assert "close" in latest
    assert "volume" in latest
    assert "vwap" in latest
    assert "rsi" in latest


@pytest.mark.anyio
async def test_intraday_ticker_evaluation():
    triggers = await intraday_service.evaluate_ticker_intraday("MSFT", base_price=420.0)
    assert isinstance(triggers, list)
    # Even if no specific trigger fires on synthetic neutral data, triggers should be a valid list
    for t in triggers:
        assert t.symbol == "MSFT"
        assert t.timeframe in ("15m", "1h")
        assert t.category in ("VOLUME_SURGE", "VWAP_RECLAIM", "VWAP_BREAKDOWN", "BREAKOUT", "RSI_EXTREME")
        assert len(t.action_directive) > 0


@pytest.mark.anyio
async def test_intraday_holdings_evaluation():
    holdings = [
        Holding(symbol="NVDA", name="NVIDIA Corp", quantity=100.0, price=120.0, avgCost=100.0),
        Holding(symbol="PLTR", name="Palantir", quantity=200.0, price=35.0, avgCost=25.0),
        Holding(symbol="CASH", name="Cash", quantity=1000.0, price=1.0, avgCost=1.0),
    ]
    results = await intraday_service.evaluate_intraday_triggers_for_holdings(holdings)
    assert isinstance(results, list)
