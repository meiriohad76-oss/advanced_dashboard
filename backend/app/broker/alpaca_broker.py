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


alpaca_broker = AlpacaBrokerSync()
