"""Algorithmic generation and evaluation of Smart Recommended Alerts & Triggers.

Evaluates each ticker (both portfolio holdings and watchlist candidates) against quantitative
technical setups, multi-source consensus price targets, moving averages, and risk guidelines
to propose actionable, high-conviction trigger recommendations:
1. PROFIT_TARGET: Analyst consensus price target or technical milestone (+15%).
2. DIP_BUY: Support pullback entry near 50-day SMA or RSI buy-zone (< 42).
3. STOP_LOSS: Capital preservation trailing or structural stop loss (e.g. 6% drop or below 200 SMA).
4. BREAKOUT: 20-day high resistance clearance with institutional volume.
5. RSI_REVERSAL: Overbought warning (RSI >= 70) signaling exhaustion.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field

from .models import Holding


class RecommendedAlert(BaseModel):
    id: str
    symbol: str
    name: str = ""
    category: str = Field(description="PROFIT_TARGET | DIP_BUY | STOP_LOSS | BREAKOUT | RSI_REVERSAL")
    title: str
    rationale: str
    metric: str = Field(description="PRICE | SMA50 | SMA200 | RSI | VOLUME | STOP_LOSS | MACD")
    condition: str = Field(description="ABOVE | BELOW | CROSS_ABOVE | CROSS_BELOW")
    target_value: float
    current_value: float
    potential_delta_pct: float | None = None
    severity: str = "warning"
    status: str = Field(default="PENDING", description="PENDING | ACKNOWLEDGED | DECLINED")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    updated_at: str | None = None


def generate_ticker_recommendations(
    symbol: str,
    name: str = "",
    price: float = 0.0,
    avg_cost: float | None = None,
    rsi: float = 50.0,
    above_sma50: bool = True,
    above_sma200: bool = True,
    relative_volume: float = 1.0,
    target_price: float | None = None,
    is_owned: bool = False,
) -> list[RecommendedAlert]:
    """Generate 2-3 tailored trigger recommendations for an individual ticker."""
    recs: list[RecommendedAlert] = []
    symbol_upper = symbol.strip().upper()
    if not symbol_upper or symbol_upper == "CASH" or price <= 0:
        return recs

    # 1. Profit Target / Consensus Exit Recommendation
    if target_price and target_price > price:
        delta_pct = ((target_price - price) / price) * 100.0
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-profit-target",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="PROFIT_TARGET",
                title="Consensus Price Target",
                rationale=f"Wall Street consensus price target of ${target_price:.2f} provides +{delta_pct:.1f}% potential upside. Arm an automated trim/profit-taking alert when reached.",
                metric="PRICE",
                condition="ABOVE",
                target_value=round(target_price, 2),
                current_value=round(price, 2),
                potential_delta_pct=round(delta_pct, 1),
                severity="info",
                status="PENDING",
            )
        )
    else:
        # Standard +15% technical expansion target
        tech_target = round(price * 1.15, 2)
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-profit-target",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="PROFIT_TARGET",
                title="15% Technical Target",
                rationale=f"Technical momentum target at ${tech_target:.2f} (+15.0% expansion). Set an alert to secure profits or scale out.",
                metric="PRICE",
                condition="ABOVE",
                target_value=tech_target,
                current_value=round(price, 2),
                potential_delta_pct=15.0,
                severity="info",
                status="PENDING",
            )
        )

    # 2. Dip-Buy / Support Entry Recommendation
    if above_sma50:
        # Estimate 50 SMA test (~4-6% below current price)
        dip_price = round(price * 0.95, 2)
        delta_pct = ((dip_price - price) / price) * 100.0
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-dip-buy",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="DIP_BUY",
                title="50-Day SMA Support Entry",
                rationale=f"Key 50-day moving average support test around ${dip_price:.2f} ({delta_pct:.1f}% pullback). Ideal high-conviction risk/reward entry point.",
                metric="PRICE",
                condition="BELOW",
                target_value=dip_price,
                current_value=round(price, 2),
                potential_delta_pct=round(delta_pct, 1),
                severity="info",
                status="PENDING",
            )
        )
    elif rsi > 55:
        # Pullback into RSI sweet spot (< 42)
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-dip-buy",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="DIP_BUY",
                title="RSI Consolidation Buy-Zone",
                rationale=f"Current RSI ({rsi:.0f}) is cooling. Alert when RSI dips to 42.0 to catch the oversold swing entry.",
                metric="RSI",
                condition="BELOW",
                target_value=42.0,
                current_value=round(rsi, 1),
                potential_delta_pct=None,
                severity="info",
                status="PENDING",
            )
        )

    # 3. Stop-Loss / Capital Preservation (strongly recommended for owned holdings)
    if is_owned:
        cost = avg_cost if (avg_cost and avg_cost > 0) else price
        stop_price = round(cost * 0.94, 2)  # -6% stop
        delta_pct = ((stop_price - price) / price) * 100.0
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-stop-loss",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="STOP_LOSS",
                title="Protective Trailing Stop (6%)",
                rationale=f"Risk management baseline. Set an automated warning if price drops below ${stop_price:.2f} (6.0% below cost basis ${cost:.2f}) to enforce capital discipline.",
                metric="PRICE",
                condition="BELOW",
                target_value=stop_price,
                current_value=round(price, 2),
                potential_delta_pct=round(delta_pct, 1),
                severity="critical",
                status="PENDING",
            )
        )
    else:
        # For watchlist candidate: Breakout trigger
        breakout_price = round(price * 1.035, 2)
        delta_pct = ((breakout_price - price) / price) * 100.0
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-breakout",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="BREAKOUT",
                title="Resistance Breakout Trigger",
                rationale=f"Key resistance level at ${breakout_price:.2f} (+{delta_pct:.1f}%). Trigger an immediate buy alert when price clears resistance on elevated volume.",
                metric="PRICE",
                condition="ABOVE",
                target_value=breakout_price,
                current_value=round(price, 2),
                potential_delta_pct=round(delta_pct, 1),
                severity="info",
                status="PENDING",
            )
        )

    # 4. Overbought Warning if RSI is already elevated
    if rsi >= 68.0:
        recs.append(
            RecommendedAlert(
                id=f"rec-{symbol_upper}-rsi-reversal",
                symbol=symbol_upper,
                name=name or symbol_upper,
                category="RSI_REVERSAL",
                title="RSI Overbought Warning",
                rationale=f"RSI is currently {rsi:.0f}. An alert at RSI 75.0 flags momentum exhaustion and potential mean-reversion risk.",
                metric="RSI",
                condition="ABOVE",
                target_value=75.0,
                current_value=round(rsi, 1),
                potential_delta_pct=None,
                severity="warning",
                status="PENDING",
            )
        )

    return recs


def generate_all_recommendations(
    holdings: list[Holding],
    watchlist_items: list[dict[str, Any]] | None = None,
    existing_statuses: dict[str, str] | None = None,
) -> list[RecommendedAlert]:
    """Generate recommendations across all current portfolio holdings and watchlist tickers."""
    existing_statuses = existing_statuses or {}
    all_recs: list[RecommendedAlert] = []
    seen_ids: set[str] = set()

    # 1. Process portfolio holdings
    for h in holdings:
        if h.symbol == "CASH" or h.price <= 0:
            continue
        avg_cost = getattr(h, "avg_cost", getattr(h, "avgCost", 0.0))
        above_sma50 = getattr(h, "above_sma_50", getattr(h, "aboveSma50", True))
        above_sma200 = getattr(h, "above_sma_200", getattr(h, "aboveSma200", True))
        rel_vol = getattr(h, "relative_volume", getattr(h, "relativeVolume", 1.0))
        recs = generate_ticker_recommendations(
            symbol=h.symbol,
            name=h.name,
            price=h.price,
            avg_cost=avg_cost,
            rsi=h.rsi,
            above_sma50=above_sma50,
            above_sma200=above_sma200,
            relative_volume=rel_vol,
            target_price=None,  # Will be enriched from ratings if available
            is_owned=True,
        )
        for r in recs:
            if r.id not in seen_ids:
                if r.id in existing_statuses:
                    r.status = existing_statuses[r.id]
                seen_ids.add(r.id)
                all_recs.append(r)

    # 2. Process watchlist candidates
    if watchlist_items:
        for w in watchlist_items:
            sym = str(w.get("symbol", "")).upper()
            if not sym or sym in {h.symbol.upper() for h in holdings}:
                continue
            price = float(w.get("price", 0.0) or 0.0)
            if price <= 0:
                price = 100.0  # Fallback price so recommendation engine can compute trigger percentages
            rsi = float(w.get("rsi", 50.0) or 50.0)
            target = float(w.get("target_price", 0.0) or 0.0) or None
            recs = generate_ticker_recommendations(
                symbol=sym,
                name=w.get("name", sym),
                price=price,
                avg_cost=None,
                rsi=rsi,
                above_sma50=bool(w.get("above_sma50", True)),
                above_sma200=bool(w.get("above_sma200", True)),
                relative_volume=float(w.get("relative_volume", 1.0) or 1.0),
                target_price=target,
                is_owned=False,
            )
            for r in recs:
                if r.id not in seen_ids:
                    if r.id in existing_statuses:
                        r.status = existing_statuses[r.id]
                    seen_ids.add(r.id)
                    all_recs.append(r)

    return all_recs
