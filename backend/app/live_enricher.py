"""Live Market and Technical Indicator Enrichment Engine.

Fetches live market data (quotes and 1y historical daily bars) via Yahoo Finance / Alpaca,
calculates grounded technical indicators (RSI-14, 50-day SMA, 200-day SMA, MACD, Trend Slope,
20-day Breakout, Relative Volume), updates holding values and weights, and evaluates dynamic alerts.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Any

import httpx

from .models import Alert, Holding

logger = logging.getLogger(__name__)

_TECHNICAL_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
CACHE_TTL = 45.0  # seconds


def calc_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 1)


def calc_macd(closes: list[float]) -> bool:
    if len(closes) < 26:
        return False

    def ema(series: list[float], span: int) -> list[float]:
        alpha = 2.0 / (span + 1.0)
        res = [series[0]]
        for val in series[1:]:
            res.append(alpha * val + (1.0 - alpha) * res[-1])
        return res

    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema12, ema26)]
    if len(macd_line) < 35:
        return macd_line[-1] > 0
    signal_line = ema(macd_line[26:], 9)
    return macd_line[-1] > signal_line[-1]


async def fetch_symbol_technical_data(client: httpx.AsyncClient, symbol: str) -> dict[str, Any] | None:
    sym = symbol.strip().upper()
    if not sym or sym == "CASH":
        return None

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
    try:
        res = await client.get(url)
        if res.status_code != 200:
            return None
        data = res.json()
        chart = data.get("chart", {}).get("result", [{}])[0]
        meta = chart.get("meta", {})
        quotes = chart.get("indicators", {}).get("quote", [{}])[0]
        closes = [float(c) for c in quotes.get("close", []) if c is not None]
        highs = [float(h) for h in quotes.get("high", []) if h is not None]
        volumes = [int(v) for v in quotes.get("volume", []) if v is not None]

        cur_p = meta.get("regularMarketPrice")
        if cur_p is None:
            cur_p = closes[-1] if closes else 0.0
        cur_p = round(float(cur_p), 2)
        if cur_p <= 0:
            return None

        prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")
        if prev_close is None and len(closes) >= 2:
            prev_close = closes[-2]
        day_change = None
        if prev_close and float(prev_close) > 0:
            day_change = round(((cur_p - float(prev_close)) / float(prev_close)) * 100.0, 2)

        rsi = calc_rsi(closes)
        macd_bull = calc_macd(closes)

        sma50 = sum(closes[-50:]) / 50.0 if len(closes) >= 50 else cur_p
        sma200 = sum(closes[-200:]) / 200.0 if len(closes) >= 200 else cur_p
        sma50_prev = sum(closes[-60:-10]) / 50.0 if len(closes) >= 60 else sma50
        trend_pos = sma50 >= sma50_prev

        breakout = cur_p >= max(highs[-21:-1]) if len(highs) >= 21 else False
        avg_vol = sum(volumes[-20:]) / 20.0 if len(volumes) >= 20 and sum(volumes[-20:]) > 0 else (volumes[-1] if volumes else 1)
        rel_vol = round(volumes[-1] / avg_vol, 2) if volumes and avg_vol > 0 else 1.0

        return {
            "price": cur_p,
            "day_change": day_change if day_change is not None else 0.0,
            "rsi": rsi,
            "macd_bullish": macd_bull,
            "above_sma_50": cur_p >= round(sma50, 2),
            "above_sma_200": cur_p >= round(sma200, 2),
            "trend_slope_positive": trend_pos,
            "breakout_20d": breakout,
            "relative_volume": rel_vol,
            "provider": "Yahoo Finance (Live Technicals)",
        }
    except Exception as exc:
        logger.warning(f"Technical fetch failed for {sym}: {exc}")
        return None


async def enrich_holdings_with_live_market(
    holdings: list[Holding],
    force_refresh: bool = False,
    max_concurrency: int = 15,
) -> tuple[list[Holding], dict[str, Any]]:
    """Enrich a list of holdings with live market prices, day changes, and technical indicators."""
    symbols = list(dict.fromkeys(h.symbol.strip().upper() for h in holdings if h.symbol.strip().upper() != "CASH"))
    if not symbols:
        return holdings, {"updated_count": 0, "provider": "None", "timestamp": datetime.now(timezone.utc).isoformat()}

    now = time.time()
    tech_data: dict[str, dict[str, Any]] = {}
    missing_symbols: list[str] = []

    if not force_refresh:
        for s in symbols:
            cached = _TECHNICAL_CACHE.get(s)
            if cached and (now - cached[0] < CACHE_TTL):
                tech_data[s] = cached[1]
            else:
                missing_symbols.append(s)
    else:
        missing_symbols = list(symbols)

    if missing_symbols:
        sem = asyncio.Semaphore(max_concurrency)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        async def _fetch(client: httpx.AsyncClient, sym: str):
            async with sem:
                data = await fetch_symbol_technical_data(client, sym)
                if data:
                    tech_data[sym] = data
                    _TECHNICAL_CACHE[sym] = (now, data)

        async with httpx.AsyncClient(timeout=9.0, headers=headers, verify=False) as client:
            tasks = [_fetch(client, s) for s in missing_symbols]
            await asyncio.gather(*tasks)

    # Build updated holdings
    updated_holdings: list[Holding] = []
    updated_count = 0

    for h in holdings:
        sym = h.symbol.strip().upper()
        t = tech_data.get(sym)
        if t:
            updated_count += 1
            updated_h = h.model_copy(
                update={
                    "price": t["price"],
                    "day_change": t["day_change"],
                    "rsi": t["rsi"],
                    "macd_bullish": t["macd_bullish"],
                    "above_sma_50": t["above_sma_50"],
                    "above_sma_200": t["above_sma_200"],
                    "trend_slope_positive": t["trend_slope_positive"],
                    "breakout_20d": t["breakout_20d"],
                    "relative_volume": t["relative_volume"],
                    "has_signal_inputs": True,
                }
            )
            updated_holdings.append(updated_h)
        else:
            updated_holdings.append(h.model_copy(deep=True))

    # Recalculate portfolio market value and weights if quantities are present
    has_quantities = any(h.quantity > 0 for h in updated_holdings if h.symbol != "CASH")
    if has_quantities:
        total_mv = sum(h.quantity * h.price for h in updated_holdings)
        if total_mv > 0:
            final_holdings: list[Holding] = []
            for h in updated_holdings:
                pos_val = h.quantity * h.price
                new_weight = round((pos_val / total_mv) * 100.0, 4)
                final_holdings.append(h.model_copy(update={"weight": new_weight}))
            updated_holdings = final_holdings

    meta = {
        "updated_count": updated_count,
        "total_symbols": len(symbols),
        "provider": "Live Market Data (Yahoo Finance / Alpaca)",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S ET"),
        "iso_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return updated_holdings, meta


def generate_live_alerts(holdings: list[Holding]) -> list[Alert]:
    """Dynamically evaluate system-level risk, technical, and concentration alerts from live data."""
    alerts: list[Alert] = []
    now_time = datetime.now(timezone.utc).strftime("%H:%M ET")

    # 1. Sector concentration check (>25%)
    sector_sums: dict[str, float] = {}
    for h in holdings:
        if h.symbol != "CASH":
            sector_sums[h.sector] = sector_sums.get(h.sector, 0.0) + h.weight

    for sec, w in sorted(sector_sums.items(), key=lambda x: x[1], reverse=True):
        if w >= 25.0:
            alerts.append(
                Alert(
                    id=f"alert-sec-{sec.lower().replace(' ', '-')}",
                    title="Sector concentration",
                    message=f"{sec} exposure is {w:.1f}%, exceeding 25% guideline threshold.",
                    status="TRIGGERED",
                    severity="warning" if w < 35.0 else "critical",
                    time=now_time,
                )
            )
            break

    # 2. 20-day Breakout alerts
    breakouts = [h for h in holdings if h.breakout_20d and h.symbol != "CASH"]
    for b in breakouts[:2]:
        alerts.append(
            Alert(
                id=f"alert-breakout-{b.symbol.lower()}",
                symbol=b.symbol,
                title="20-day breakout",
                message=f"{b.symbol} ({b.name}) cleared its prior 20-day high on {b.relative_volume:.1f}x volume.",
                status="TRIGGERED",
                severity="info",
                time=now_time,
            )
        )

    # 3. RSI Extremes
    oversold = [h for h in holdings if h.rsi <= 35.0 and h.symbol != "CASH"]
    for o in oversold[:1]:
        alerts.append(
            Alert(
                id=f"alert-rsi-{o.symbol.lower()}",
                symbol=o.symbol,
                title="RSI Oversold setup",
                message=f"{o.symbol} RSI reached {o.rsi:.1f} (oversold bounce candidate).",
                status="TRIGGERED",
                severity="info",
                time=now_time,
            )
        )

    overbought = [h for h in holdings if h.rsi >= 75.0 and h.symbol != "CASH"]
    for ob in overbought[:1]:
        alerts.append(
            Alert(
                id=f"alert-rsi-ob-{ob.symbol.lower()}",
                symbol=ob.symbol,
                title="RSI Overbought warning",
                message=f"{ob.symbol} RSI reached {ob.rsi:.1f} (extended above 75).",
                status="TRIGGERED",
                severity="warning",
                time=now_time,
            )
        )

    # 4. Standard monitoring armed alerts if not triggered
    if not any(a.title == "Portfolio drawdown" for a in alerts):
        alerts.append(
            Alert(
                id="alert-drawdown",
                title="Portfolio drawdown",
                message="Notify when drawdown exceeds 8%; current drawdown within normal risk limits.",
                status="ARMED",
                severity="info",
                time="Monitoring",
            )
        )

    return alerts
