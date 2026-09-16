"""Portfolio-aware signal adjustment (spec section 25) + deterministic explanation
(spec section 73).

The technical score (``engine.assess_holding``) evaluates a setup in isolation. This
module evaluates the same setup *in portfolio context*: a holding that piles into an
already-over-limit sector, an oversized single position, or an over-limit top-5 block
is a worse place to add risk than the raw technical score alone implies.

Design, matching the spec:

- The adjustment is a **separate score**, never a silent edit of the technical score
  (spec: "This should be a separate score, not silently modify the raw technical
  score."). The UI shows the triad Technical / Portfolio Fit / Combined.
- Every number is **deterministic and explainable** — no AI, no guessing. The
  ``explanation`` list is the section-73 plain-language "why", generated from the same
  inputs that produce the numbers, so the score is fully auditable.
- Correlation-with-portfolio (one of the spec's inputs) needs a returns history this
  seeded POC does not carry, so it is reported as unavailable and **excluded** from the
  math rather than fabricated (consistent with the project's "never guess" contract).

Concentration limits are the same ones the risk view uses, and are configurable.
"""
from __future__ import annotations

from collections import defaultdict

from .engine import assess_holding, classify_score
from .models import FitFactor, Holding, PortfolioFit

# Concentration limits (percent of book), matching the risk analytics view. Configurable.
RISK_LIMITS: dict[str, float] = {
    "max_single_position_pct": 20.0,
    "max_top5_pct": 70.0,
    "max_sector_pct": 35.0,
}

# Score points of drag applied per 1 percentage point of a holding's *attributed*
# over-limit exposure. Configurable knob controlling how hard concentration bites.
POINTS_PER_EXCESS_PCT: float = 10.0


def _clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def sector_weights(holdings: list[Holding]) -> dict[str, float]:
    weights: defaultdict[str, float] = defaultdict(float)
    for holding in holdings:
        weights[holding.sector] += holding.weight
    return dict(weights)


def _top5_sum(holdings: list[Holding]) -> float:
    return sum(sorted((holding.weight for holding in holdings), reverse=True)[:5])


def compute_correlation(returns_a: list[float], returns_b: list[float]) -> float:
    """Compute Pearson correlation coefficient r between two return series."""
    n = min(len(returns_a), len(returns_b))
    if n < 2:
        return 0.0
    mean_a = sum(returns_a[:n]) / n
    mean_b = sum(returns_b[:n]) / n
    cov = sum((returns_a[i] - mean_a) * (returns_b[i] - mean_b) for i in range(n))
    var_a = sum((returns_a[i] - mean_a) ** 2 for i in range(n))
    var_b = sum((returns_b[i] - mean_b) ** 2 for i in range(n))
    denom = (var_a * var_b) ** 0.5
    if denom == 0:
        return 0.0
    return max(-1.0, min(1.0, round(cov / denom, 4)))


def compute_fit(holding: Holding, holdings: list[Holding]) -> PortfolioFit:
    """Assess ``holding`` in the context of the whole ``holdings`` book.

    Returns the Technical / Portfolio-Fit / Combined triad plus the per-limit factors
    and a deterministic explanation. Fit is 100 when the holding adds no over-limit
    concentration; each percentage point of attributed excess subtracts
    ``POINTS_PER_EXCESS_PCT`` from Fit, and the same shortfall is what Combined applies
    to the technical score (``concentration_adjustment = fit_score - 100``).
    """
    technical = assess_holding(holding).score

    sectors = sector_weights(holdings)
    sector_total = sectors.get(holding.sector, holding.weight)
    max_sector = RISK_LIMITS["max_sector_pct"]
    max_single = RISK_LIMITS["max_single_position_pct"]
    max_top5 = RISK_LIMITS["max_top5_pct"]

    factors: list[FitFactor] = []

    # 1. Sector limit. A holding shares blame for its sector's overage in proportion to
    #    its own weight within that sector.
    sector_overage = max(0.0, sector_total - max_sector)
    sector_share = holding.weight / sector_total if sector_total > 0 else 0.0
    sector_attr = round(sector_overage * sector_share, 2)
    if sector_overage > 0:
        detail = (
            f"{holding.sector} is {sector_total:.1f}% of the book, "
            f"{sector_overage:.1f}% over the {max_sector:.0f}% limit; {holding.symbol} is "
            f"{sector_share * 100:.0f}% of that sector, so it carries {sector_attr:.1f}% of the excess."
        )
    else:
        detail = f"{holding.sector} is {sector_total:.1f}% of the book, within the {max_sector:.0f}% limit."
    factors.append(FitFactor(label="Sector exposure", detail=detail, points=sector_attr, breached=sector_overage > 0))

    # 2. Single-position limit.
    position_attr = round(max(0.0, holding.weight - max_single), 2)
    if position_attr > 0:
        detail = f"Position weight {holding.weight:.1f}% is {position_attr:.1f}% over the {max_single:.0f}% single-position limit."
    else:
        detail = f"Position weight {holding.weight:.1f}% is within the {max_single:.0f}% single-position limit."
    factors.append(FitFactor(label="Position size", detail=detail, points=position_attr, breached=position_attr > 0))

    # 3. Top-5 block limit. Only holdings inside the top-5 block share its overage.
    top5 = _top5_sum(holdings)
    top5_symbols = {h.symbol for h in sorted(holdings, key=lambda h: h.weight, reverse=True)[:5]}
    top5_overage = max(0.0, top5 - max_top5)
    if holding.symbol in top5_symbols and top5_overage > 0 and top5 > 0:
        top5_attr = round(top5_overage * (holding.weight / top5), 2)
        detail = (
            f"Top-5 holdings total {top5:.1f}%, {top5_overage:.1f}% over the {max_top5:.0f}% limit; "
            f"{holding.symbol} carries {top5_attr:.1f}% of the excess."
        )
        top5_breached = True
    else:
        top5_attr = 0.0
        detail = f"Top-5 holdings total {top5:.1f}%, within the {max_top5:.0f}% limit."
        top5_breached = False
    factors.append(FitFactor(label="Top-5 concentration", detail=detail, points=top5_attr, breached=top5_breached))

    # 4. Optional Systemic Correlation (Spec Section 37).
    returns = getattr(holding, "returns_history", None)
    correlation_available = bool(returns and len(returns) >= 5)
    corr_attr = 0.0
    corr_val = 0.0
    if correlation_available:
        n_pts = len(returns)
        portfolio_returns = [0.0] * n_pts
        total_weight = sum(h.weight for h in holdings if getattr(h, "returns_history", None)) or 1.0
        for h in holdings:
            h_ret = getattr(h, "returns_history", None)
            if h_ret and len(h_ret) == n_pts:
                w_norm = h.weight / total_weight
                for t in range(n_pts):
                    portfolio_returns[t] += w_norm * h_ret[t]
        corr_val = compute_correlation(returns, portfolio_returns)
        if corr_val > 0.70:
            corr_attr = round((corr_val - 0.70) * 10.0, 2)
            detail = f"Returns correlation with portfolio is +{corr_val:.2f}, {corr_attr:.1f}% drag above the +0.70 threshold."
            factors.append(FitFactor(label="Systemic correlation", detail=detail, points=corr_attr, breached=True))
        else:
            detail = f"Returns correlation with portfolio is +{corr_val:.2f}, within the +0.70 threshold."
            factors.append(FitFactor(label="Systemic correlation", detail=detail, points=0.0, breached=False))

    drag = round(sector_attr + position_attr + top5_attr + corr_attr, 2)
    fit_score = _clamp_score(100 - drag * POINTS_PER_EXCESS_PCT)
    concentration_adjustment = fit_score - 100  # <= 0
    combined_score = _clamp_score(technical + concentration_adjustment)

    explanation = [factor.detail for factor in factors]
    if correlation_available:
        explanation.append(f"Portfolio returns correlation is +{corr_val:.2f} (evaluated over {len(returns)}-day return series).")
    else:
        explanation.append("Correlation with the portfolio needs a price history this dataset does not carry, so it is excluded rather than estimated.")

    if concentration_adjustment < 0:
        explanation.append(
            f"Portfolio Fit {fit_score}/100 → {concentration_adjustment} applied to the technical score "
            f"({technical} → {combined_score})."
        )
    else:
        explanation.append(f"No concentration drag — Portfolio Fit is {fit_score}/100 and the combined score equals the technical score.")

    return PortfolioFit(
        symbol=holding.symbol,
        technical_score=technical,
        fit_score=fit_score,
        concentration_adjustment=concentration_adjustment,
        combined_score=combined_score,
        combined_state=classify_score(combined_score),
        factors=factors,
        explanation=explanation,
        correlation_available=correlation_available,
    )
