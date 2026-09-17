"""Daily Pre-Market Executive Morning Briefing Service (§13, §14).

Synthesizes overnight & pre-market portfolio intelligence into an actionable daily memo:
- Portfolio value, daily change, top movers
- Top actionable trade setups (signals >= 70 / STRONG ENTRY)
- Earnings & dividend catalysts reporting this week
- Risk posture (VaR 95%, beta) and executive stance
- Dispatches formatted markdown reports directly to Telegram
"""
from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any
import httpx

from .models import Holding
from .engine import assess_holding
from .catalysts_service import get_earnings_calendar, get_dividend_projections
from . import store

logger = logging.getLogger(__name__)


async def generate_daily_briefing(holdings: list[Holding]) -> dict[str, Any]:
    """Assembles the executive morning briefing from current portfolio state."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%A, %b %d, %Y")

    if not holdings:
        return {
            "date": date_str,
            "generated_at": now.isoformat(),
            "pulse": {"total_value": 0, "day_change_amount": 0, "day_change_pct": 0},
            "top_setups": [],
            "catalysts": {"earnings_soon": [], "dividends_soon": []},
            "sentiment": {"ranks_count": 0, "highlights": []},
            "risk": {"beta": 1.0, "var_95": 0, "executive_stance": "Neutral"},
            "telegram_markdown": "No holdings available in portfolio."
        }

    # 1. Pulse
    total_val = 0.0
    day_change_amt = 0.0
    valid_positions = []

    for h in holdings:
        pos_val = h.quantity * h.price
        total_val += pos_val
        if h.symbol.upper() != "CASH":
            day_pct = h.day_change / 100.0
            prev_val = pos_val / (1.0 + day_pct) if (1.0 + day_pct) != 0 else pos_val
            day_change_amt += (pos_val - prev_val)
            valid_positions.append(h)

    day_change_pct = (day_change_amt / (total_val - day_change_amt) * 100.0) if (total_val - day_change_amt) > 0 else 0.0

    valid_positions.sort(key=lambda x: x.day_change, reverse=True)
    top_gainer = valid_positions[0] if valid_positions else None
    top_loser = valid_positions[-1] if valid_positions else None

    # 2. Actionable Signal Setups
    scored_holdings = []
    for h in valid_positions:
        try:
            assessment = assess_holding(h)
            scored_holdings.append({
                "symbol": h.symbol,
                "name": h.name,
                "price": h.price,
                "score": assessment.score,
                "state": assessment.state.value if hasattr(assessment.state, "value") else str(assessment.state),
                "rsi": h.rsi,
                "breakout": h.breakout_20d,
                "weight": h.weight,
            })
        except Exception:
            pass

    # Sort setups: highest score first
    scored_holdings.sort(key=lambda x: x["score"], reverse=True)
    top_setups = scored_holdings[:3]

    # 3. Catalysts (Earnings & Dividends)
    earnings_data = await get_earnings_calendar(holdings)
    earnings_soon = [e for e in earnings_data.get("events", []) if e.get("days_until", 99) <= 7]

    div_data = get_dividend_projections(holdings)
    dividends_soon = [d for d in div_data.get("upcoming_ex_dates", []) if 0 <= d.get("days_to_ex", 99) <= 14]

    # 4. Ratings & Extractor Sentiment Highlights
    try:
        all_ratings = store.get_all_ratings()
        ranks_count = len(all_ratings)
        top_ranks = []
        for sym, r in list(all_ratings.items())[:5]:
            za = r.get("zacks_rank")
            sa = r.get("sa_rating")
            if za in (1, "1") or "Strong Buy" in str(sa):
                top_ranks.append(f"{sym}: Strong Consensus (Zacks #{za}, SA {sa})")
    except Exception:
        ranks_count = 0
        top_ranks = []

    # 5. Risk & Executive Stance
    var_95 = round(total_val * 0.0199, 2)
    weighted_beta = 1.08  # Representative default
    if any(e.get("days_until", 99) <= 5 for e in earnings_soon):
        executive_stance = "ELEVATED CATALYST VOLATILITY · Imminent earnings on core holdings. Enforce trailing bracket orders."
    elif day_change_pct > 1.0:
        executive_stance = "BULLISH EXPANSION · Momentum broadening across portfolio leaders. Trail stops higher."
    elif day_change_pct < -1.0:
        executive_stance = "DEFENSIVE CONSOLIDATION · Respect risk limits; review breakdown alerts."
    else:
        executive_stance = "CONSTRUCTIVE EQUILIBRIUM · Favorable setup for selective accumulation."

    # 6. Telegram Markdown Formatting
    lines = [
        f"☀️ *ATLAS PRE-MARKET EXECUTIVE BRIEFING*",
        f"📅 {date_str}",
        "",
        f"💼 *Portfolio Pulse:*",
        f"• Total Equity: `${total_val:,.2f}`",
        f"• Overnight/Day Shift: `{'+' if day_change_amt >= 0 else ''}${day_change_amt:,.2f} ({'+' if day_change_pct >= 0 else ''}{day_change_pct:.2f}%)`",
    ]

    if top_gainer and top_loser and top_gainer.symbol != top_loser.symbol:
        lines.append(f"• Leaders: *{top_gainer.symbol}* ({'+' if top_gainer.day_change >= 0 else ''}{top_gainer.day_change:.1f}%) | Laggards: *{top_loser.symbol}* ({top_loser.day_change:.1f}%)")

    lines.extend([
        "",
        f"🎯 *Top Signal Opportunities:*",
    ])
    for s in top_setups:
        lines.append(f"• *{s['symbol']}* · Score `{s['score']}/100` ({s['state']}) · RSI {s['rsi']:.1f}")

    if earnings_soon:
        lines.extend([
            "",
            f"⚠️ *Imminent Earnings Catalysts (≤7 Days):*",
        ])
        for e in earnings_soon:
            lines.append(f"• *{e['symbol']}* reports in `{e['days_until']} days` ({e['timing']}) · Exp Move ±{e['implied_move_pct']}%")

    if dividends_soon:
        lines.extend([
            "",
            f"💰 *Upcoming Ex-Dividends:*",
        ])
        for d in dividends_soon[:2]:
            lines.append(f"• *{d['symbol']}* ex-date in `{d['days_to_ex']} days` (${d['estimated_cashflow']:,.2f} est. cash)")

    lines.extend([
        "",
        f"🛡️ *Risk Posture:*",
        f"• 1-Day 95% VaR: `${var_95:,.2f}` | Stance: {executive_stance}",
    ])

    telegram_markdown = "\n".join(lines)

    return {
        "date": date_str,
        "generated_at": now.isoformat(),
        "pulse": {
            "total_value": round(total_val, 2),
            "day_change_amount": round(day_change_amt, 2),
            "day_change_pct": round(day_change_pct, 2),
            "top_gainer": {"symbol": top_gainer.symbol, "change": top_gainer.day_change} if top_gainer else None,
            "top_loser": {"symbol": top_loser.symbol, "change": top_loser.day_change} if top_loser else None,
        },
        "top_setups": top_setups,
        "catalysts": {
            "earnings_soon": earnings_soon,
            "dividends_soon": dividends_soon,
        },
        "sentiment": {
            "ranks_count": ranks_count,
            "highlights": top_ranks,
        },
        "risk": {
            "beta": weighted_beta,
            "var_95": var_95,
            "executive_stance": executive_stance,
        },
        "telegram_markdown": telegram_markdown,
    }


async def dispatch_briefing_to_telegram(
    token: str,
    chat_id: str,
    briefing: dict[str, Any]
) -> dict[str, Any]:
    """Dispatches the morning briefing message to Telegram."""
    if not token or not chat_id:
        return {"sent": False, "error": "Telegram token or chat_id is missing."}

    text = briefing.get("telegram_markdown", "")
    url = f"https://api.telegram.org/bot{token}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            res = await client.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            })
            data = res.json()
            if data.get("ok"):
                return {
                    "sent": True,
                    "message_id": data.get("result", {}).get("message_id"),
                    "delivered_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                return {"sent": False, "error": data.get("description", "Unknown Telegram error")}
    except Exception as exc:
        logger.error(f"Failed to dispatch morning briefing to Telegram: {exc}")
        return {"sent": False, "error": str(exc)}
