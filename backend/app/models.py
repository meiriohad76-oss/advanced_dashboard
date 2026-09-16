from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class SignalState(str, Enum):
    NO_SETUP = "NO SETUP"
    WATCH = "WATCH"
    APPROACHING = "APPROACHING"
    ENTRY = "ENTRY"
    STRONG_ENTRY = "STRONG ENTRY"


class Holding(BaseModel):
    symbol: str
    name: str
    sector: str
    quantity: float
    price: float
    avg_cost: float = Field(alias="avgCost")
    day_change: float = Field(alias="dayChange")
    weight: float
    rsi: float
    macd_bullish: bool = Field(alias="macdBullish")
    above_sma_50: bool = Field(alias="aboveSma50")
    above_sma_200: bool = Field(alias="aboveSma200")
    relative_volume: float = Field(alias="relativeVolume")
    breakout_20d: bool = Field(alias="breakout20d")
    trend_slope_positive: bool = Field(alias="trendSlopePositive")
    # False when an uploaded holding carries no technical columns — the UI then shows
    # "signals need market data" instead of a fabricated score. Seed/demo holdings are True.
    has_signal_inputs: bool = Field(default=True, alias="hasSignalInputs")
    returns_history: list[float] | None = Field(default=None, alias="returnsHistory")

    model_config = {"populate_by_name": True}


class WatchlistItem(BaseModel):
    symbol: str
    name: str | None = None
    sector: str | None = None
    note: str | None = None


class ScoreComponent(BaseModel):
    label: str
    score: int
    max: int
    facts: list[str]


class SignalAssessment(BaseModel):
    symbol: str
    score: int
    state: SignalState
    components: list[ScoreComponent]
    facts: list[str]


class Alert(BaseModel):
    id: str
    symbol: str | None = None
    title: str
    message: str
    status: Literal["TRIGGERED", "ARMED", "COOLDOWN"]
    severity: Literal["info", "warning", "critical"]
    time: str


class RiskSummary(BaseModel):
    largest_position: float
    top_five: float
    largest_sector: str
    sector_weight: float
    status: Literal["Balanced", "Elevated"]
    portfolio_beta: float = Field(default=1.18, alias="portfolioBeta")
    var_95_pct: float = Field(default=1.95, alias="var95Pct")
    var_95_amount: float = Field(default=13950.0, alias="var95Amount")


class FitFactor(BaseModel):
    label: str
    detail: str
    points: float  # percentage points of attributed over-limit exposure (0 if within limit)
    breached: bool


class PortfolioFit(BaseModel):
    symbol: str
    technical_score: int = Field(ge=0, le=100)
    fit_score: int = Field(ge=0, le=100)
    concentration_adjustment: int = Field(le=0)
    combined_score: int = Field(ge=0, le=100)
    combined_state: SignalState
    factors: list[FitFactor]
    explanation: list[str]
    correlation_available: bool = False


class RatingSource(str, Enum):
    ZACKS = "zacks"
    SA_QUANT = "sa_quant"
    SA_ANALYSTS = "sa_analysts"
    SA_WALL_STREET = "sa_wall_street"
    INVESTING = "investing"


class Rating(BaseModel):
    source: RatingSource
    display: str
    value_native: str
    label: str
    normalized: float = Field(ge=0, le=100)
    native_scale: str
    as_of: str
    url: str | None = None


class TickerRatings(BaseModel):
    symbol: str
    ratings: list[Rating]
    consensus: float | None = Field(default=None, ge=0, le=100)
    consensus_label: str | None = None


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class AskResponse(BaseModel):
    answer: str
    grounding: list[str]
    generated_numbers: bool = False
