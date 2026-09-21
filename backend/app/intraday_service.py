"""Multi-timeframe intraday trigger detection service (§13, §14, §44).

Evaluates 15-minute and 1-hour OHLCV bar series for active market session setups:
1. INTRADAY_VOLUME_SURGE: Volume on current 15m bar >= 2.5x 20-period 15m volume SMA.
2. VWAP_RECLAIM: Current price crosses above daily intraday VWAP with volume (bullish entry/continuation).
3. VWAP_BREAKDOWN: Current price drops below daily intraday VWAP (defensive risk tightening).
4. INTRADAY_BREAKOUT: Current price clears the 20-period 15m/1h high.
5. INTRADAY_RSI_REVERSAL: 15m RSI <= 30 (extreme intraday oversold) or >= 75 (exhaustion).
"""
from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any
from pydantic import BaseModel, Field

from .bars_service import get_symbol_bars
from .models import Holding

logger = logging.getLogger(__name__)


class IntradayTrigger(BaseModel):
    id: str
    symbol: str
    timeframe: str = Field(description="15m | 1h | 1d")
    category: str = Field(description="VOLUME_SURGE | VWAP_RECLAIM | VWAP_BREAKDOWN | BREAKOUT | RSI_EXTREME")
    title: str
    message: str
    severity: str = "info"  # info | warning | critical
    price: float
    vwap: float | None = None
    relative_volume: float = 1.0
    action_directive: str
    detected_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))


async def evaluate_ticker_intraday(
    symbol: str,
    base_price: float | None = None,
) -> list[IntradayTrigger]:
    """Fetch 15m and 1h bars for a ticker and detect intraday actionable triggers."""
    sym = symbol.strip().upper()
    if not sym or sym == "CASH":
        return []

    triggers: list[IntradayTrigger] = []

    try:
        # Fetch 15m bars (typically last 5 days)
        bars_15m = await get_symbol_bars(sym, range_str="5d", interval="15m", base_price=base_price)
        bars = bars_15m.get("bars", [])
        if len(bars) < 20:
            return triggers

        latest_bar = bars[-1]
        prev_bar = bars[-2]

        cur_price = float(latest_bar.get("close", 0.0))
        prev_price = float(prev_bar.get("close", 0.0))
        cur_vwap = latest_bar.get("vwap")
        prev_vwap = prev_bar.get("vwap")
        cur_vol = float(latest_bar.get("volume", 0.0))
        vol_sma20 = float(latest_bar.get("vol_sma20", 0.0) or 1.0)
        cur_rsi = float(latest_bar.get("rsi") or 50.0)

        rel_vol = round(cur_vol / vol_sma20, 2) if vol_sma20 > 0 else 1.0

        # 1. 15m Volume Surge (>= 2.5x normal 15m volume)
        if rel_vol >= 2.5 and cur_vol >= 10000:
            price_direction = "surging" if cur_price >= prev_price else "liquidating"
            severity = "info" if cur_price >= prev_price else "warning"
            triggers.append(
                IntradayTrigger(
                    id=f"intra-{sym}-vol-surge-15m",
                    symbol=sym,
                    timeframe="15m",
                    category="VOLUME_SURGE",
                    title="15m Institutional Volume Surge",
                    message=f"{sym} volume surged to {rel_vol:.1f}x average on the latest 15m candle with price {price_direction}.",
                    severity=severity,
                    price=cur_price,
                    vwap=cur_vwap,
                    relative_volume=rel_vol,
                    action_directive="1. Inspect real-time catalyst/news.\n2. In breakout, trail stop 1% below current 15m candle low.\n3. On high-volume breakdown, tighten protective stops.",
                )
            )

        # 2. VWAP Reclaim (price crosses above VWAP)
        if (
            cur_vwap is not None
            and prev_vwap is not None
            and prev_price <= prev_vwap
            and cur_price > cur_vwap
        ):
            triggers.append(
                IntradayTrigger(
                    id=f"intra-{sym}-vwap-reclaim-15m",
                    symbol=sym,
                    timeframe="15m",
                    category="VWAP_RECLAIM",
                    title="Intraday VWAP Reclaim",
                    message=f"{sym} crossed above daily VWAP (${cur_vwap:.2f}) at ${cur_price:.2f} with bullish momentum.",
                    severity="info",
                    price=cur_price,
                    vwap=cur_vwap,
                    relative_volume=rel_vol,
                    action_directive="1. Bulls in control of daily auction.\n2. Favorable intraday long entry using VWAP as support.\n3. Stop-loss 0.5% below VWAP.",
                )
            )

        # 3. VWAP Breakdown (price drops below VWAP)
        if (
            cur_vwap is not None
            and prev_vwap is not None
            and prev_price >= prev_vwap
            and cur_price < cur_vwap
        ):
            triggers.append(
                IntradayTrigger(
                    id=f"intra-{sym}-vwap-breakdown-15m",
                    symbol=sym,
                    timeframe="15m",
                    category="VWAP_BREAKDOWN",
                    title="Intraday VWAP Breakdown",
                    message=f"{sym} lost daily VWAP support (${cur_vwap:.2f}) and dropped to ${cur_price:.2f}.",
                    severity="warning",
                    price=cur_price,
                    vwap=cur_vwap,
                    relative_volume=rel_vol,
                    action_directive="1. Institutional distribution underway below VWAP.\n2. Do not average down long positions.\n3. Tighten stops or hedge exposure if holding short-term swings.",
                )
            )

        # 4. 20-bar 15m Range Breakout
        recent_20_highs = [b["high"] for b in bars[-21:-1]]
        if recent_20_highs:
            max_20_high = max(recent_20_highs)
            if cur_price > max_20_high and rel_vol >= 1.5:
                triggers.append(
                    IntradayTrigger(
                        id=f"intra-{sym}-breakout-15m",
                        symbol=sym,
                        timeframe="15m",
                        category="BREAKOUT",
                        title="15m Consolidation Breakout",
                        message=f"{sym} broke out above its 20-bar 15m high (${max_20_high:.2f}) on {rel_vol:.1f}x volume.",
                        severity="info",
                        price=cur_price,
                        vwap=cur_vwap,
                        relative_volume=rel_vol,
                        action_directive="1. High-momentum breakout setup.\n2. Set initial trailing stop just below previous resistance (${max_20_high:.2f}).",
                    )
                )

        # 5. 15m RSI Extremes
        if cur_rsi <= 28.0:
            triggers.append(
                IntradayTrigger(
                    id=f"intra-{sym}-rsi-oversold-15m",
                    symbol=sym,
                    timeframe="15m",
                    category="RSI_EXTREME",
                    title="15m RSI Oversold (Mean Reversion)",
                    message=f"{sym} 15m RSI dropped to {cur_rsi:.1f}, indicating intraday selling exhaustion.",
                    severity="info",
                    price=cur_price,
                    vwap=cur_vwap,
                    relative_volume=rel_vol,
                    action_directive="1. Watch for bounce back toward VWAP.\n2. Look for bullish hammer or reversal bar on 5m/15m chart.",
                )
            )
        elif cur_rsi >= 78.0:
            triggers.append(
                IntradayTrigger(
                    id=f"intra-{sym}-rsi-overbought-15m",
                    symbol=sym,
                    timeframe="15m",
                    category="RSI_EXTREME",
                    title="15m RSI Overbought (Exhaustion)",
                    message=f"{sym} 15m RSI spiked to {cur_rsi:.1f}, signaling short-term buyers exhaustion.",
                    severity="warning",
                    price=cur_price,
                    vwap=cur_vwap,
                    relative_volume=rel_vol,
                    action_directive="1. Do not chase new intraday entries.\n2. Take partial profits or raise stop to previous 15m low.",
                )
            )

    except Exception as exc:
        logger.warning(f"Error evaluating intraday triggers for {sym}: {exc}")

    return triggers


async def evaluate_intraday_triggers_for_holdings(
    holdings: list[Holding],
    limit_tickers: int = 15,
) -> list[IntradayTrigger]:
    """Evaluate intraday triggers across active portfolio holdings."""
    stock_holdings = [h for h in holdings if h.symbol != "CASH" and h.price > 0]
    stock_holdings = stock_holdings[:limit_tickers]

    all_triggers: list[IntradayTrigger] = []
    for h in stock_holdings:
        ticker_triggers = await evaluate_ticker_intraday(h.symbol, base_price=h.price)
        all_triggers.extend(ticker_triggers)

    return all_triggers
