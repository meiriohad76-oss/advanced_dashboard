from app.data import BASE_HOLDINGS, holdings_for_scenario
from app.engine import assess_holding
from app.models import SignalState
from app.portfolio_fit import compute_fit


def _by_symbol(holdings, symbol):
    return next(h for h in holdings if h.symbol == symbol)


def test_diversifier_has_perfect_fit_and_no_adjustment():
    # A holding with no overage and no correlation drag has fit_score = 100
    spy = _by_symbol(BASE_HOLDINGS, "SPY").model_copy(update={"returns_history": None})
    fit = compute_fit(spy, [h.model_copy(update={"returns_history": None}) for h in BASE_HOLDINGS])
    assert fit.fit_score == 100
    assert fit.concentration_adjustment == 0
    assert fit.combined_score == fit.technical_score
    assert all(not factor.breached for factor in fit.factors)


def test_overweight_sector_member_is_penalized_and_explained():
    # CRDO is in Semiconductors (36.2% > 35% limit), so its fit is dragged below 100 and
    # the combined score sits below the technical score — but the technical score itself
    # is untouched (separate score, per spec section 25).
    crdo = _by_symbol(BASE_HOLDINGS, "CRDO").model_copy(update={"returns_history": None})
    no_returns = [h.model_copy(update={"returns_history": None}) for h in BASE_HOLDINGS]
    fit = compute_fit(crdo, no_returns)
    assert fit.technical_score == assess_holding(crdo).score == 65
    assert fit.fit_score < 100
    assert fit.concentration_adjustment < 0
    assert fit.combined_score == fit.technical_score + fit.concentration_adjustment
    sector_factor = next(f for f in fit.factors if f.label == "Sector exposure")
    assert sector_factor.breached is True
    assert "Semiconductors" in sector_factor.detail
    # The explanation is the deterministic section-73 "why".
    assert any("Portfolio Fit" in line for line in fit.explanation)
    assert fit.correlation_available is False

    # When returns_history is present, correlation_available is True
    fit_with_corr = compute_fit(_by_symbol(BASE_HOLDINGS, "CRDO"), BASE_HOLDINGS)
    assert fit_with_corr.correlation_available is True


def test_adjustment_relationship_holds_and_scores_stay_bounded():
    for holding in BASE_HOLDINGS:
        fit = compute_fit(holding, BASE_HOLDINGS)
        assert fit.concentration_adjustment == fit.fit_score - 100
        assert 0 <= fit.fit_score <= 100
        assert 0 <= fit.combined_score <= 100
        assert fit.concentration_adjustment <= 0


def test_deterministic():
    a = compute_fit(_by_symbol(BASE_HOLDINGS, "NVDA"), BASE_HOLDINGS)
    b = compute_fit(_by_symbol(BASE_HOLDINGS, "NVDA"), BASE_HOLDINGS)
    assert a.model_dump() == b.model_dump()


def test_scenario_combined_tracks_technical_move():
    # In the demo scenario CRDO's technical score jumps 65 -> 90; the concentration
    # adjustment is unchanged (weights are the same), so combined moves with it.
    base = compute_fit(_by_symbol(BASE_HOLDINGS, "CRDO"), BASE_HOLDINGS)
    active_holdings = holdings_for_scenario(True)
    active = compute_fit(_by_symbol(active_holdings, "CRDO"), active_holdings)
    assert base.technical_score == 65
    assert active.technical_score == 90
    assert active.concentration_adjustment == base.concentration_adjustment
    assert active.combined_score == 90 + active.concentration_adjustment
    assert active.combined_state in set(SignalState)


def test_correlation_calculation_when_returns_history_present():
    from app.portfolio_fit import compute_correlation
    # Perfect positive correlation (r = 1.0)
    assert compute_correlation([1.0, 2.0, 3.0, 4.0], [2.0, 4.0, 6.0, 8.0]) == 1.0
    # Perfect negative correlation (r = -1.0)
    assert compute_correlation([1.0, 2.0, 3.0, 4.0], [-1.0, -2.0, -3.0, -4.0]) == -1.0
    # Holding with attached return history
    h1 = BASE_HOLDINGS[0].model_copy()
    h2 = BASE_HOLDINGS[1].model_copy()
    setattr(h1, "returns_history", [0.01, 0.02, -0.01, 0.03, 0.01])
    setattr(h2, "returns_history", [0.01, 0.02, -0.01, 0.03, 0.01])
    fit = compute_fit(h1, [h1, h2])
    assert fit.correlation_available is True
    assert any("correlation" in line.lower() for line in fit.explanation)

