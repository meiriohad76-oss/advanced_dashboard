"""Market Data Provider Routing (§14 of specification)."""
from __future__ import annotations

import logging
import time
from typing import Any
from .base import MarketDataProvider, Quote
from .alpaca import AlpacaMarketDataProvider
from .yahoo import YahooMarketDataProvider

logger = logging.getLogger(__name__)


class MarketDataRouter:
    """Manages fallback chain: Alpaca -> Yahoo Finance (§14), with TTL in-memory caching."""

    def __init__(self, alpaca_provider: AlpacaMarketDataProvider | None = None, yahoo_provider: YahooMarketDataProvider | None = None, cache_ttl: float = 30.0):
        self.alpaca = alpaca_provider or AlpacaMarketDataProvider()
        self.yahoo = yahoo_provider or YahooMarketDataProvider()
        self.cache_ttl = cache_ttl
        self._cache: dict[str, tuple[float, Quote]] = {}

    def get_cached_quote(self, symbol: str) -> Quote | None:
        item = self._cache.get(symbol.upper())
        if item:
            ts, quote = item
            if time.time() - ts < self.cache_ttl:
                return quote
        return None

    def get_cached_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        now = time.time()
        res = {}
        for s in symbols:
            item = self._cache.get(s.upper())
            if item and (now - item[0] < self.cache_ttl):
                res[s.upper()] = item[1]
        return res

    def store_cached_quotes(self, quotes: dict[str, Quote]) -> None:
        now = time.time()
        for k, v in quotes.items():
            self._cache[k.upper()] = (now, v)

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

    async def get_quote(self, symbol: str, force_refresh: bool = False) -> Quote | None:
        """Fetch quote using primary provider (Alpaca) if available, falling back to Yahoo."""
        sym_clean = symbol.strip().upper()
        if not force_refresh:
            cached = self.get_cached_quote(sym_clean)
            if cached:
                return cached

        quotes = await self.get_quotes([sym_clean], force_refresh=force_refresh)
        return quotes.get(sym_clean)

    async def get_quotes(self, symbols: list[str], force_refresh: bool = False) -> dict[str, Quote]:
        """Fetch quotes for a list of symbols with provider fallback for any missing symbols."""
        if not symbols:
            return {}

        clean_symbols = list(dict.fromkeys(s.strip().upper() for s in symbols if s.strip() and s.strip().upper() != "CASH"))
        if not clean_symbols:
            return {}

        results: dict[str, Quote] = {}
        missing_symbols: list[str] = []

        now = time.time()
        if not force_refresh:
            for s in clean_symbols:
                cached = self._cache.get(s)
                if cached and (now - cached[0] < self.cache_ttl):
                    results[s] = cached[1]
                else:
                    missing_symbols.append(s)
        else:
            missing_symbols = list(clean_symbols)

        if not missing_symbols:
            return results

        fetched: dict[str, Quote] = {}
        if self.alpaca.is_configured:
            try:
                alpaca_results = await self.alpaca.get_quotes(missing_symbols)
                fetched.update(alpaca_results)
                missing_symbols = [s for s in missing_symbols if s not in fetched]
            except Exception as e:
                logger.warning(f"Alpaca get_quotes failed: {e}. Falling back to Yahoo.")

        if missing_symbols:
            try:
                yahoo_results = await self.yahoo.get_quotes(missing_symbols)
                fetched.update(yahoo_results)
            except Exception as e:
                logger.error(f"Yahoo get_quotes failed: {e}")

        self.store_cached_quotes(fetched)
        results.update(fetched)
        return results


# Global singleton router
market_router = MarketDataRouter()
