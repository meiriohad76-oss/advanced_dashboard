"""Yahoo Finance Market Data Provider (§13 zero-key fallback)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import httpx

from .base import MarketDataProvider, Quote


class YahooMarketDataProvider(MarketDataProvider):
    """Fetches quotes from Yahoo Finance (zero API key required)."""

    def __init__(self, timeout: float = 6.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, verify=False) as client:
                res = await client.get("https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d")
                return res.status_code == 200
        except Exception:
            return False

    async def get_quote(self, symbol: str) -> Quote | None:
        quotes = await self.get_quotes([symbol])
        return quotes.get(symbol.upper())

    async def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        if not symbols:
            return {}

        clean_symbols = list(dict.fromkeys(s.strip().upper() for s in symbols if s.strip() and s.strip().upper() != "CASH"))
        if not clean_symbols:
            return {}

        results: dict[str, Quote] = {}
        now_iso = datetime.now(timezone.utc).isoformat()
        sem = asyncio.Semaphore(15)

        async def _fetch_one(client: httpx.AsyncClient, sym: str) -> None:
            async with sem:
                try:
                    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d"
                    res = await client.get(url)
                    if res.status_code != 200:
                        return
                    data = res.json()
                    meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                    price = meta.get("regularMarketPrice")
                    if price is None:
                        return

                    prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")
                    day_change_pct = None
                    if prev_close and prev_close > 0:
                        day_change_pct = round(((price - prev_close) / prev_close) * 100.0, 2)

                    volume = meta.get("regularMarketVolume")

                    results[sym] = Quote(
                        symbol=sym,
                        price=round(float(price), 2),
                        prevClose=round(float(prev_close), 2) if prev_close else None,
                        dayChangePct=day_change_pct,
                        volume=int(volume) if volume else None,
                        timestamp=now_iso,
                        provider="Yahoo Finance"
                    )
                except Exception:
                    pass

        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, verify=False) as client:
            tasks = [_fetch_one(client, sym) for sym in clean_symbols]
            await asyncio.gather(*tasks)

        return results
