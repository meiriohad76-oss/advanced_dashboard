"""Market Data Provider Interface (§13 of specification)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field


class Quote(BaseModel):
    """Normalized quote DTO (§13)."""
    symbol: str
    price: float
    prev_close: float | None = Field(default=None, alias="prevClose")
    day_change_pct: float | None = Field(default=None, alias="dayChangePct")
    bid: float | None = None
    ask: float | None = None
    volume: int | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    provider: str

    model_config = {"populate_by_name": True}


class MarketDataProvider(ABC):
    """Abstract Market Data Provider (§13)."""

    @abstractmethod
    async def get_quote(self, symbol: str) -> Quote | None:
        """Fetch a single quote."""
        pass

    @abstractmethod
    async def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        """Fetch multiple quotes in batch."""
        pass

    @abstractmethod
    async def healthcheck(self) -> bool:
        """Verify provider availability."""
        pass
