"""Unit tests for Alpaca Market Data Provider and Broker Synchronization (§13, §14, §97)."""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.market_data.base import Quote
from app.market_data.alpaca import AlpacaMarketDataProvider
from app.market_data.yahoo import YahooMarketDataProvider
from app.market_data.router import MarketDataRouter
from app.broker.alpaca_broker import AlpacaBrokerSync


client = TestClient(app)


def test_quote_dto_structure():
    q = Quote(
        symbol="SPY",
        price=756.80,
        prevClose=750.00,
        dayChangePct=0.91,
        bid=756.70,
        ask=756.90,
        volume=1234567,
        provider="Alpaca Markets"
    )
    data = q.model_dump(by_alias=True)
    assert data["symbol"] == "SPY"
    assert data["price"] == 756.80
    assert data["prevClose"] == 750.00
    assert data["dayChangePct"] == 0.91
    assert data["provider"] == "Alpaca Markets"


@pytest.mark.anyio
async def test_alpaca_provider_not_configured():
    provider = AlpacaMarketDataProvider(api_key="", secret_key="")
    assert not provider.is_configured
    assert await provider.healthcheck() is False
    quotes = await provider.get_quotes(["SPY"])
    assert quotes == {}


@pytest.mark.anyio
async def test_alpaca_provider_mock_fetch():
    provider = AlpacaMarketDataProvider(api_key="test_key", secret_key="test_secret")
    assert provider.is_configured

    mock_snap_response = MagicMock()
    mock_snap_response.status_code = 200
    mock_snap_response.json.return_value = {
        "SPY": {
            "dailyBar": {"c": 756.50, "v": 100000},
            "prevDailyBar": {"c": 750.00},
            "latestQuote": {"bp": 756.40, "ap": 756.60},
            "latestTrade": {"p": 756.50}
        }
    }

    with patch("httpx.AsyncClient.get", return_value=mock_snap_response):
        quotes = await provider.get_quotes(["SPY"])
        assert "SPY" in quotes
        assert quotes["SPY"].price == 756.50
        assert quotes["SPY"].prev_close == 750.00
        assert quotes["SPY"].day_change_pct == 0.87
        assert quotes["SPY"].bid == 756.40
        assert quotes["SPY"].ask == 756.60
        assert quotes["SPY"].volume == 100000
        assert quotes["SPY"].provider == "Alpaca Markets"


@pytest.mark.anyio
async def test_yahoo_provider_fallback():
    provider = YahooMarketDataProvider()

    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {
        "chart": {
            "result": [{
                "meta": {
                    "regularMarketPrice": 210.50,
                    "previousClose": 200.00,
                    "regularMarketVolume": 50000
                }
            }]
        }
    }

    with patch("httpx.AsyncClient.get", return_value=mock_res):
        quote = await provider.get_quote("NVDA")
        assert quote is not None
        assert quote.symbol == "NVDA"
        assert quote.price == 210.50
        assert quote.day_change_pct == 5.25
        assert quote.provider == "Yahoo Finance"


@pytest.mark.anyio
async def test_market_router_fallback():
    alpaca_mock = MagicMock(spec=AlpacaMarketDataProvider)
    alpaca_mock.is_configured = True
    alpaca_mock.get_quote = AsyncMock(return_value=None)
    alpaca_mock.get_quotes = AsyncMock(return_value={})

    yahoo_mock = MagicMock(spec=YahooMarketDataProvider)
    yahoo_quote = Quote(symbol="AAPL", price=150.0, provider="Yahoo Finance")
    yahoo_mock.get_quote = AsyncMock(return_value=yahoo_quote)
    yahoo_mock.get_quotes = AsyncMock(return_value={"AAPL": yahoo_quote})

    router = MarketDataRouter(alpaca_provider=alpaca_mock, yahoo_provider=yahoo_mock)
    quote = await router.get_quote("AAPL")
    assert quote is not None
    assert quote.symbol == "AAPL"
    assert quote.provider == "Yahoo Finance"


@pytest.mark.anyio
async def test_alpaca_broker_sync(tmp_path):
    orig_db = os.environ.get("ATLAS_DB")
    test_db = str(tmp_path / "test_atlas.db")
    os.environ["ATLAS_DB"] = test_db

    try:
        broker = AlpacaBrokerSync(api_key="test_key", secret_key="test_secret")

        mock_acct_res = MagicMock()
        mock_acct_res.status_code = 200
        mock_acct_res.json.return_value = {
            "status": "ACTIVE",
            "portfolio_value": "100000.00",
            "cash": "20000.00",
            "buying_power": "40000.00",
            "currency": "USD"
        }

        mock_pos_res = MagicMock()
        mock_pos_res.status_code = 200
        mock_pos_res.json.return_value = [
            {
                "symbol": "SPY",
                "qty": "100",
                "current_price": "750.00",
                "avg_entry_price": "740.00",
                "market_value": "75000.00",
                "change_today": "0.015"
            },
            {
                "symbol": "QQQ",
                "qty": "50",
                "current_price": "500.00",
                "avg_entry_price": "490.00",
                "market_value": "25000.00",
                "change_today": "-0.005"
            }
        ]

        with patch("httpx.AsyncClient.get", side_effect=[mock_acct_res, mock_pos_res]):
            result = await broker.sync_positions()
            assert result["success"] is True
            assert result["count"] == 2
            assert result["portfolio_value"] == 100000.00
            assert result["cash"] == 20000.00
            assert len(result["holdings"]) == 2
            assert result["holdings"][0]["symbol"] == "SPY"
            assert result["holdings"][0]["weight"] == 75.0
            assert result["holdings"][1]["symbol"] == "QQQ"
            assert result["holdings"][1]["weight"] == 25.0
    finally:
        if orig_db is not None:
            os.environ["ATLAS_DB"] = orig_db
        else:
            os.environ.pop("ATLAS_DB", None)


def test_api_market_status():
    res = client.get("/api/v1/market/status")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "active_provider" in data
    assert "alpaca" in data
    assert "yahoo" in data


def test_api_broker_alpaca_status():
    res = client.get("/api/v1/broker/alpaca/status")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "configured" in data
    assert "account_status" in data


def test_api_market_quotes_endpoint():
    mock_quote = Quote(symbol="SPY", price=756.0, provider="Alpaca Markets")
    with patch("app.main.market_router.get_quotes", new=AsyncMock(return_value={"SPY": mock_quote})):
        res = client.post("/api/v1/market/quotes", json={"symbols": ["SPY"]})
        assert res.status_code == 200
        data = res.json()["data"]
        assert "SPY" in data
        assert data["SPY"]["price"] == 756.0
        assert data["SPY"]["provider"] == "Alpaca Markets"
