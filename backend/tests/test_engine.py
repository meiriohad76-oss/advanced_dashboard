from app.data import BASE_HOLDINGS, holdings_for_scenario
from app.engine import assess_holding, calculate_risk, classify_score
from app.models import SignalState


def test_score_boundaries():
    assert classify_score(49) == SignalState.NO_SETUP
    assert classify_score(65) == SignalState.APPROACHING
    assert classify_score(80) == SignalState.ENTRY
    assert classify_score(90) == SignalState.STRONG_ENTRY


def test_scenario_is_explainable():
    before = assess_holding(BASE_HOLDINGS[0])
    after = assess_holding(holdings_for_scenario(True)[0])
    assert before.score == 65
    assert after.score == 90
    assert "Price cleared its prior 20-day high" in after.facts


def test_risk_is_derived_from_positions():
    risk = calculate_risk(BASE_HOLDINGS)
    assert risk.largest_sector == "Semiconductors"
    assert risk.sector_weight == 36.2
    assert risk.status == "Elevated"
    assert risk.portfolio_beta > 1.0  # Semiconductors concentration pushes beta above 1
    assert risk.var_95_pct > 0.0
    assert risk.var_95_amount > 0.0
