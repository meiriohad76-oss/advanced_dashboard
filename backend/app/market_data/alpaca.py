"""Alpaca Markets Data Provider (§13 & §14 of specification)."""
from __future__ import annotations

import os
from datetime import datetime, timezone
import httpx

from .base import MarketDataProvider, Quote


class AlpacaMarketDataProvider(MarketDataProvider):
    """Fetches real-time equity quotes from Alpaca Market Data v2 API."""

    def __init__(self, api_key: str | None = None, secret_key: str | None = None, base_url: str = "https://data.alpaca.markets/v2"):
        self.api_key = api_key if api_key is not None else (os.getenv("ALPACA_API_KEY") or os.getenv("APCA_API_KEY_ID") or "")
        self.secret_key = secret_key if secret_key is not None else (os.getenv("ALPACA_SECRET_KEY") or os.getenv("APCA_API_SECRET_KEY") or "")
        self.base_url = base_url.rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.secret_key)

    def _headers(self) -> dict[str, str]:
        return {
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.secret_key,
        }

    async def healthcheck(self) -> bool:
        if not self.is_configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
                res = await client.get(f"{self.base_url}/stocks/bars/latest?symbols=SPY", headers=self._headers())
                return res.status_code == 200
        except Exception:
            return False

    async def get_quote(self, symbol: str) -> Quote | None:
        quotes = await self.get_quotes([symbol])
        return quotes.get(symbol.upper())

    async def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        if not symbols or not self.is_configured:
            return {}

        clean_symbols = [s.strip().upper() for s in symbols if s.strip() and s.strip().upper() != "CASH"]
        if not clean_symbols:
            return {}

        sym_str = ",".join(clean_symbols)
        results: dict[str, Quote] = {}

        try:
            async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
                now_iso = datetime.now(timezone.utc).isoformat()

                # Try snapshots endpoint first (returns dailyBar, prevDailyBar, latestQuote, latestTrade)
                snap_res = await client.get(f"{self.base_url}/stocks/snapshots?symbols={sym_str}", headers=self._headers())
                if snap_res.status_code == 200:
                    snap_data = snap_res.json()
                    for sym in clean_symbols:
                        item = snap_data.get(sym)
                        if not item:
                            continue
                        daily = item.get("dailyBar") or {}
                        prev_daily = item.get("prevDailyBar") or {}
                        quote_item = item.get("latestQuote") or {}
                        trade_item = item.get("latestTrade") or {}

                        price = float(trade_item.get("p") or daily.get("c") or quote_item.get("ap") or quote_item.get("bp") or 0.0)
                        if price <= 0:
                            continue
                        prev_close = float(prev_daily.get("c")) if prev_daily.get("c") else None
                        day_change_pct = None
                        if prev_close and prev_close > 0:
                            day_change_pct = round(((price - prev_close) / prev_close) * 100.0, 2)

                        bid = float(quote_item.get("bp")) if quote_item.get("bp") else None
                        ask = float(quote_item.get("ap")) if quote_item.get("ap") else None
                        vol = int(daily.get("v")) if daily.get("v") is not None else None

                        results[sym] = Quote(
                            symbol=sym,
                            price=round(price, 2),
                            prevClose=round(prev_close, 2) if prev_close else None,
                            dayChangePct=day_change_pct,
                            bid=round(bid, 2) if bid is not None else None,
                            ask=round(ask, 2) if ask is not None else None,
                            volume=vol,
                            timestamp=now_iso,
                            provider="Alpaca Markets"
                        )
                    if len(results) == len(clean_symbols):
                        return results

                # Fallback to bars/latest + quotes/latest for any missing symbols
                missing = [s for s in clean_symbols if s not in results]
                if missing:
                    miss_str = ",".join(missing)
                    bars_res = await client.get(f"{self.base_url}/stocks/bars/latest?symbols={miss_str}", headers=self._headers())
                    bars_data = bars_res.json().get("bars", {}) if bars_res.status_code == 200 else {}
                    quotes_res = await client.get(f"{self.base_url}/stocks/quotes/latest?symbols={miss_str}", headers=self._headers())
                    quotes_data = quotes_res.json().get("quotes", {}) if quotes_res.status_code == 200 else {}

                    for sym in missing:
                        bar = bars_data.get(sym)
                        quote_item = quotes_data.get(sym)
                        if not bar and not quote_item:
                            continue
                        price = float(bar.get("c", 0.0)) if bar else float(quote_item.get("ap", 0.0) or quote_item.get("bp", 0.0))
                        bid = float(quote_item.get("bp", 0.0)) if quote_item and quote_item.get("bp") else None
                        ask = float(quote_item.get("ap", 0.0)) if quote_item and quote_item.get("ap") else None
                        vol = int(bar.get("v", 0)) if bar and bar.get("v") is not None else None

                        results[sym] = Quote(
                            symbol=sym,
                            price=round(price, 2),
                            bid=round(bid, 2) if bid is not None else None,
                            ask=round(ask, 2) if ask is not None else None,
                            volume=vol,
                            timestamp=now_iso,
                            provider="Alpaca Markets"
                        )
        except Exception:
            pass

        return results
