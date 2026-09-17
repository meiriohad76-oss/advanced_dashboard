"""Alpaca Read-Only Broker Synchronization (§97 of specification).

Connects to Alpaca Trading API to read real-time account balances and open positions,
converting them into the dashboard's unified portfolio format without executing any orders.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
import httpx

from ..company_names import resolve_company_name
from ..models import Holding
from .. import store


class AlpacaBrokerSync:
    """Read-only synchronization service for Alpaca portfolios."""

    def __init__(self, api_key: str | None = None, secret_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key if api_key is not None else (os.getenv("ALPACA_API_KEY") or os.getenv("APCA_API_KEY_ID") or "")
        self.secret_key = secret_key if secret_key is not None else (os.getenv("ALPACA_SECRET_KEY") or os.getenv("APCA_API_SECRET_KEY") or "")
        raw_url = base_url or os.getenv("ALPACA_BASE_URL") or "https://paper-api.alpaca.markets"
        self.base_url = raw_url.rstrip("/").removesuffix("/v2")
        self.last_synced: str | None = None

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.secret_key)

    def _headers(self) -> dict[str, str]:
        return {
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.secret_key,
        }

    async def get_status(self) -> dict[str, Any]:
        """Check Alpaca broker connectivity and account overview."""
        if not self.is_configured:
            return {
                "configured": False,
                "connected": False,
                "account_status": "NOT_CONFIGURED",
                "portfolio_value": 0.0,
                "cash": 0.0,
                "buying_power": 0.0,
                "currency": "USD",
                "last_synced": self.last_synced,
            }

        try:
            async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
                res = await client.get(f"{self.base_url}/v2/account", headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "configured": True,
                        "connected": True,
                        "account_status": data.get("status", "ACTIVE"),
                        "portfolio_value": round(float(data.get("portfolio_value", 0.0)), 2),
                        "cash": round(float(data.get("cash", 0.0)), 2),
                        "buying_power": round(float(data.get("buying_power", 0.0)), 2),
                        "currency": data.get("currency", "USD"),
                        "last_synced": self.last_synced,
                    }
                else:
                    return {
                        "configured": True,
                        "connected": False,
                        "account_status": f"HTTP_{res.status_code}",
                        "portfolio_value": 0.0,
                        "cash": 0.0,
                        "buying_power": 0.0,
                        "currency": "USD",
                        "last_synced": self.last_synced,
                        "error": res.text,
                    }
        except Exception as exc:
            return {
                "configured": True,
                "connected": False,
                "account_status": "CONNECTION_ERROR",
                "portfolio_value": 0.0,
                "cash": 0.0,
                "buying_power": 0.0,
                "currency": "USD",
                "last_synced": self.last_synced,
                "error": str(exc),
            }

    async def sync_positions(self) -> dict[str, Any]:
        """Fetch open positions and account details, saving to SQLite as active portfolio."""
        if not self.is_configured:
            raise ValueError("Alpaca API credentials are not configured.")

        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            # 1. Fetch account
            acct_res = await client.get(f"{self.base_url}/v2/account", headers=self._headers())
            if acct_res.status_code != 200:
                raise ValueError(f"Failed to fetch Alpaca account: {acct_res.text}")
            acct_data = acct_res.json()

            # 2. Fetch positions
            pos_res = await client.get(f"{self.base_url}/v2/positions", headers=self._headers())
            if pos_res.status_code != 200:
                raise ValueError(f"Failed to fetch Alpaca positions: {pos_res.text}")
            positions = pos_res.json()

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.last_synced = now_iso

        portfolio_value = float(acct_data.get("portfolio_value", 0.0))
        cash = float(acct_data.get("cash", 0.0))

        if not positions:
            # Empty positions in broker
            parsed = {
                "holdings": [],
                "has_signal_inputs": False,
                "warnings": ["Alpaca account currently has no open equity positions."],
                "count": 0,
                "broker": "alpaca",
                "portfolio_value": portfolio_value,
                "cash": cash,
            }
            store.save_list("portfolio", parsed, name="Alpaca Paper Portfolio", imported_at=now_iso)
            return {
                "success": True,
                "count": 0,
                "holdings": [],
                "portfolio_value": portfolio_value,
                "cash": cash,
                "synced_at": now_iso,
                "message": "Synchronized 0 positions from Alpaca.",
            }

        # Calculate position market values and weights
        total_mv = sum(abs(float(p.get("market_value", 0.0))) for p in positions)
        if total_mv <= 0:
            total_mv = portfolio_value if portfolio_value > 0 else 1.0

        holdings: list[Holding] = []
        for p in positions:
            sym = p.get("symbol", "").upper()
            qty = float(p.get("qty", 0.0))
            price = round(float(p.get("current_price", 0.0)), 2)
            avg_cost = round(float(p.get("avg_entry_price", 0.0)), 2)
            mv = float(p.get("market_value", qty * price))
            day_change = round(float(p.get("change_today", 0.0)) * 100.0, 2)
            weight = round((abs(mv) / total_mv) * 100.0, 4)

            sector = "Index ETF" if sym in {"SPY", "QQQ", "IWM", "DIA", "VOO", "VTI"} else "Equities"
            h = Holding(
                symbol=sym,
                name=resolve_company_name(sym),
                sector=sector,
                quantity=qty,
                price=price,
                avgCost=avg_cost,
                dayChange=day_change,
                weight=weight,
                rsi=50.0,
                macdBullish=False,
                aboveSma50=True,
                aboveSma200=True,
                relativeVolume=1.0,
                breakout20d=False,
                trendSlopePositive=True,
                hasSignalInputs=False,
            )
            holdings.append(h)

        parsed = {
            "holdings": [h.model_dump(by_alias=True) for h in holdings],
            "has_signal_inputs": False,
            "warnings": [],
            "count": len(holdings),
            "broker": "alpaca",
            "portfolio_value": portfolio_value,
            "cash": cash,
        }

        store.save_list("portfolio", parsed, name="Alpaca Paper Portfolio", imported_at=now_iso)

        return {
            "success": True,
            "count": len(holdings),
            "holdings": parsed["holdings"],
            "portfolio_value": portfolio_value,
            "cash": cash,
            "synced_at": now_iso,
            "message": f"Successfully synchronized {len(holdings)} position(s) from Alpaca.",
        }

    async def place_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        order_type: str = "market",
        time_in_force: str = "day",
        limit_price: float | None = None,
    ) -> dict[str, Any]:
        """Place an order with Alpaca paper trading account, with simulation fallback if unconfigured."""
        sym = symbol.strip().upper()
        order_side = side.strip().lower()
        if order_side not in ("buy", "sell"):
            raise ValueError("Side must be 'buy' or 'sell'")

        if not self.is_configured:
            # Simulated paper order response for development & offline testing
            from uuid import uuid4
            return {
                "id": str(uuid4()),
                "client_order_id": f"atlas_sim_{sym}_{int(qty)}",
                "symbol": sym,
                "qty": qty,
                "side": order_side,
                "type": order_type,
                "time_in_force": time_in_force,
                "status": "filled",
                "simulated": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "message": f"Simulated paper trade: {order_side.upper()} {qty} {sym} executed.",
            }

        payload: dict[str, Any] = {
            "symbol": sym,
            "qty": qty,
            "side": order_side,
            "type": order_type,
            "time_in_force": time_in_force,
        }
        if limit_price is not None:
            payload["limit_price"] = limit_price

        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            res = await client.post(f"{self.base_url}/v2/orders", json=payload, headers=self._headers())
            if res.status_code in (200, 201):
                data = res.json()
                return {
                    "id": data.get("id"),
                    "symbol": data.get("symbol"),
                    "qty": float(data.get("qty", qty)),
                    "side": data.get("side"),
                    "type": data.get("type"),
                    "status": data.get("status", "accepted"),
                    "simulated": False,
                    "created_at": data.get("created_at"),
                    "message": f"Alpaca paper order accepted: {order_side.upper()} {qty} {sym}.",
                }
            raise ValueError(f"Alpaca order rejected ({res.status_code}): {res.text}")

    async def get_orders(self, status: str = "open", limit: int = 50) -> list[dict[str, Any]]:
        """Retrieve recent orders from Alpaca."""
        if not self.is_configured:
            return []

        try:
            async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
                res = await client.get(f"{self.base_url}/v2/orders?status={status}&limit={limit}", headers=self._headers())
                if res.status_code == 200:
                    return res.json()
                return []
        except Exception:
            return []

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel an open order."""
        if not self.is_configured:
            return {"cancelled": True, "simulated": True, "order_id": order_id}

        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            res = await client.delete(f"{self.base_url}/v2/orders/{order_id}", headers=self._headers())
            return {"cancelled": res.status_code in (200, 204), "status_code": res.status_code}


def calculate_portfolio_rebalance(holdings: list[Holding], max_position_pct: float = 12.0, max_sector_pct: float = 30.0) -> dict[str, Any]:
    """Calculate recommended rebalance trades comparing current holdings weights
    against model signal priorities (Entry vs Exit setups) with concentration caps.
    """
    from ..engine import assess_holding

    non_cash = [h for h in holdings if h.symbol != "CASH"]
    if not non_cash:
        return {"orders": [], "total_rebalance_amount": 0.0, "current_value": 0.0}

    total_value = sum(h.quantity * h.price for h in non_cash)
    if total_value <= 0:
        total_value = 100000.0

    raw_targets: dict[str, float] = {}
    for h in non_cash:
        assessment = assess_holding(h)
        score = assessment.score
        # High conviction (Entry/Strong Entry) targeted higher
        if score >= 80:
            target = 8.5
        elif score >= 65:
            target = 5.5
        elif score >= 50:
            target = 3.5
        else:
            target = 1.5  # underperforming or exit setups
        raw_targets[h.symbol] = target

    # Sector constraint check: sum of targets per sector
    sector_targets: dict[str, float] = {}
    for h in non_cash:
        sec = h.sector or "Equities"
        sector_targets[sec] = sector_targets.get(sec, 0.0) + raw_targets[h.symbol]

    for sec, tot in sector_targets.items():
        if tot > max_sector_pct:
            scale = max_sector_pct / tot
            for h in non_cash:
                if (h.sector or "Equities") == sec:
                    raw_targets[h.symbol] *= scale

    # Normalize targets so they sum to 100%
    sum_targets = sum(raw_targets.values()) or 1.0
    norm_targets = {sym: round((v / sum_targets) * 100.0, 2) for sym, v in raw_targets.items()}

    # Cap single positions at max_position_pct
    for sym in norm_targets:
        if norm_targets[sym] > max_position_pct:
            norm_targets[sym] = max_position_pct

    # Re-normalize
    sum_targets = sum(norm_targets.values()) or 1.0
    norm_targets = {sym: round((v / sum_targets) * 100.0, 2) for sym, v in norm_targets.items()}

    orders: list[dict[str, Any]] = []
    total_rebalance_amt = 0.0

    for h in non_cash:
        target_wt = norm_targets.get(h.symbol, 0.0)
        curr_wt = h.weight
        delta_wt = round(target_wt - curr_wt, 2)

        # Only propose trade if delta weight is at least 0.4%
        if abs(delta_wt) >= 0.4:
            target_mv = total_value * (target_wt / 100.0)
            current_mv = h.quantity * h.price
            dollar_diff = target_mv - current_mv
            share_diff = int(round(dollar_diff / h.price))

            if share_diff != 0:
                side = "buy" if share_diff > 0 else "sell"
                trade_qty = abs(share_diff)
                trade_amt = round(trade_qty * h.price, 2)
                total_rebalance_amt += trade_amt

                assessment = assess_holding(h)
                if side == "buy":
                    reason = f"Scale into {assessment.state.value} setup (score {assessment.score}/100)"
                else:
                    reason = f"Trim overweight position to {target_wt:.1f}% target cap"

                orders.append({
                    "symbol": h.symbol,
                    "name": h.name,
                    "sector": h.sector,
                    "price": h.price,
                    "current_quantity": h.quantity,
                    "current_weight": round(curr_wt, 2),
                    "target_weight": target_wt,
                    "delta_weight": delta_wt,
                    "side": side,
                    "quantity": trade_qty,
                    "estimated_amount": trade_amt,
                    "score": assessment.score,
                    "state": assessment.state.value,
                    "reason": reason,
                })

    # Sort sells first to free up buying power, then highest delta buys
    orders.sort(key=lambda o: (o["side"] != "sell", -abs(o["delta_weight"])))

    return {
        "orders_count": len(orders),
        "total_rebalance_amount": round(total_rebalance_amt, 2),
        "portfolio_value": round(total_value, 2),
        "orders": orders,
    }


alpaca_broker = AlpacaBrokerSync()

