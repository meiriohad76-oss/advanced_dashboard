from __future__ import annotations

from collections import defaultdict

from .models import Holding, RiskSummary, ScoreComponent, SignalAssessment, SignalState


def classify_score(score: int) -> SignalState:
    if score >= 90:
        return SignalState.STRONG_ENTRY
    if score >= 80:
        return SignalState.ENTRY
    if score >= 65:
        return SignalState.APPROACHING
    if score >= 50:
        return SignalState.WATCH
    return SignalState.NO_SETUP


def assess_holding(holding: Holding) -> SignalAssessment:
    if not holding.has_signal_inputs:
        return SignalAssessment(
            symbol=holding.symbol,
            score=0,
            state=SignalState.NO_SETUP,
            components=[
                ScoreComponent(label="Trend", score=0, max=30, facts=["Signals need market data"]),
                ScoreComponent(label="Momentum", score=0, max=25, facts=["Signals need market data"]),
                ScoreComponent(label="Setup", score=0, max=25, facts=["Signals need market data"]),
                ScoreComponent(label="Volume", score=0, max=20, facts=["Signals need market data"]),
            ],
            facts=["Technical indicator columns (RSI/MACD/SMA) not supplied in imported file."]
        )

    trend = 0
    trend_facts: list[str] = []
    if holding.above_sma_200:
        trend += 10
        trend_facts.append("Price above 200-day average")
    if holding.above_sma_50:
        trend += 10
        trend_facts.append("Price above 50-day average")
    if holding.trend_slope_positive:
        trend += 10
        trend_facts.append("50-day trend is rising")

    momentum = 0
    momentum_facts: list[str] = []
    if 45 <= holding.rsi <= 65:
        momentum += 12
        momentum_facts.append(f"RSI {holding.rsi:.0f} in target range")
    if holding.macd_bullish:
        momentum += 13
        momentum_facts.append("MACD is bullish")

    setup = 0
    setup_facts: list[str] = []
    if holding.breakout_20d:
        setup += 15
        setup_facts.append("Price cleared its prior 20-day high")
    if holding.above_sma_50:
        setup += 10
        setup_facts.append("Setup is supported by the 50-day average")

    volume = 0
    volume_facts: list[str] = []
    if holding.relative_volume >= 1.3:
        volume += 20
        volume_facts.append(f"Relative volume is {holding.relative_volume:.2f}x")
    elif holding.relative_volume >= 1.0:
        volume += 10
        volume_facts.append(f"Relative volume is {holding.relative_volume:.2f}x")

    components = [
        ScoreComponent(label="Trend", score=trend, max=30, facts=trend_facts),
        ScoreComponent(label="Momentum", score=momentum, max=25, facts=momentum_facts),
        ScoreComponent(label="Setup", score=setup, max=25, facts=setup_facts),
        ScoreComponent(label="Volume", score=volume, max=20, facts=volume_facts),
    ]
    score = sum(component.score for component in components)
    return SignalAssessment(symbol=holding.symbol, score=score, state=classify_score(score), components=components, facts=[fact for component in components for fact in component.facts])


# Sector beta dictionary for deterministic beta estimation relative to SPY
SECTOR_BETAS: dict[str, float] = {
    "Semiconductors": 1.45,
    "Software": 1.25,
    "Infrastructure": 1.15,
    "Diversified": 1.00,
    "Metals & Mining": 0.90,
    "Healthcare": 0.70,
    "Cash": 0.00,
}


def calculate_risk(holdings: list[Holding]) -> RiskSummary:
    sector_weights: defaultdict[str, float] = defaultdict(float)
    total_val = sum(h.quantity * h.price for h in holdings) or 715520.0
    weighted_beta = 0.0
    total_w = 0.0

    for holding in holdings:
        sector_weights[holding.sector] += holding.weight
        beta = SECTOR_BETAS.get(holding.sector, 1.0)
        weighted_beta += (holding.weight / 100.0) * beta
        total_w += holding.weight / 100.0

    portfolio_beta = round(weighted_beta / (total_w or 1.0), 2)
    # Parametric 1-day 95% VaR: Z_0.95 = 1.645, daily volatility ~ 1.2% * portfolio_beta
    daily_vol = 0.012 * portfolio_beta
    var_95_pct = round(1.645 * daily_vol * 100.0, 2)
    var_95_amount = round((var_95_pct / 100.0) * total_val, 2)

    largest_sector, sector_weight = max(sector_weights.items(), key=lambda item: item[1])
    largest = max(holding.weight for holding in holdings)
    top_five = sum(sorted((holding.weight for holding in holdings), reverse=True)[:5])

    return RiskSummary(
        largest_position=largest,
        top_five=top_five,
        largest_sector=largest_sector,
        sector_weight=sector_weight,
        status="Elevated" if largest > 20 or sector_weight > 35 else "Balanced",
        portfolio_beta=portfolio_beta,
        var_95_pct=var_95_pct,
        var_95_amount=var_95_amount,
    )
