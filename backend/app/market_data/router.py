"""Market Data Provider Routing (§14 of specification)."""
from __future__ import annotations

import logging
from typing import Any
from .base import MarketDataProvider, Quote
from .alpaca import AlpacaMarketDataProvider
from .yahoo import YahooMarketDataProvider

logger = logging.getLogger(__name__)


class MarketDataRouter:
    """Manages fallback chain: Alpaca -> Yahoo Finance (§14)."""

    def __init__(self, alpaca_provider: AlpacaMarketDataProvider | None = None, yahoo_provider: YahooMarketDataProvider | None = None):
        self.alpaca = alpaca_provider or AlpacaMarketDataProvider()
        self.yahoo = yahoo_provider or YahooMarketDataProvider()

    async def get_active_provider_info(self) -> dict[str, Any]:
        """Return connectivity status and active primary provider."""
        alpaca_ok = await self.alpaca.healthcheck() if self.alpaca.is_configured else False
        yahoo_ok = await self.yahoo.healthcheck()

        active = "alpaca" if (self.alpaca.is_configured and alpaca_ok) else ("yahoo" if yahoo_ok else "none")

        return {
            "active_provider": active,
            "alpaca": {
                "configured": self.alpaca.is_configured,
                "healthy": alpaca_ok,
                "provider_name": "Alpaca Markets (v2)",
            },
            "yahoo": {
                "configured": True,
                "healthy": yahoo_ok,
                "provider_name": "Yahoo Finance (Fallback)",
            }
        }

    async def get_quote(self, symbol: str) -> Quote | None:
        """Fetch quote using primary provider (Alpaca) if available, falling back to Yahoo."""
        if self.alpaca.is_configured:
            try:
                quote = await self.alpaca.get_quote(symbol)
                if quote is not None:
                    return quote
            except Exception as e:
                logger.warning(f"Alpaca quote failed for {symbol}: {e}. Falling back to Yahoo.")

        try:
            return await self.yahoo.get_quote(symbol)
        except Exception as e:
            logger.error(f"Yahoo quote failed for {symbol}: {e}")
            return None

    async def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        """Fetch quotes for a list of symbols with provider fallback for any missing symbols."""
        if not symbols:
            return {}

        results: dict[str, Quote] = {}
        missing_symbols = list(symbols)

        if self.alpaca.is_configured:
            try:
                alpaca_results = await self.alpaca.get_quotes(missing_symbols)
                results.update(alpaca_results)
                missing_symbols = [s for s in missing_symbols if s.upper() not in results]
            except Exception as e:
                logger.warning(f"Alpaca get_quotes failed: {e}. Falling back to Yahoo.")

        if missing_symbols:
            try:
                yahoo_results = await self.yahoo.get_quotes(missing_symbols)
                results.update(yahoo_results)
            except Exception as e:
                logger.error(f"Yahoo get_quotes failed: {e}")

        return results


# Global singleton router
market_router = MarketDataRouter()
