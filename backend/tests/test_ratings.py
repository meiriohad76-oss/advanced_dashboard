import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ratings import build_ticker_ratings, normalize_five, normalize_zacks

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "test.db"))


def test_normalization_direction_is_consistent():
    # Zacks is inverted (1 = best) but must normalize to the same "higher = better" axis.
    assert normalize_zacks(1) == 100.0
    assert normalize_zacks(5) == 0.0
    assert normalize_zacks(3) == 50.0
    # Seeking Alpha 1-5 (5 = best).
    assert normalize_five(5) == 100.0
    assert normalize_five(1) == 0.0
    assert normalize_five(3) == 50.0


def test_full_coverage_symbol_has_five_ratings_and_consensus():
    result = build_ticker_ratings("CRDO")
    assert [r.source.value for r in result.ratings] == [
        "zacks", "sa_quant", "sa_analysts", "sa_wall_street", "investing",
    ]
    assert result.consensus is not None
    # Zacks 2 -> 75, SA 4.6/4.1/3.9 -> 90/77.5/72.5, Investing Strong Buy -> 100. Mean = 83.0.
    assert result.consensus == 83.0
    assert result.consensus_label == "Strong Buy"
    zacks = result.ratings[0]
    assert zacks.value_native == "2" and zacks.label == "Buy" and zacks.normalized == 75.0


def test_partial_coverage_drops_missing_sources_without_guessing():
    result = build_ticker_ratings("SPY")
    sources = [r.source.value for r in result.ratings]
    assert sources == ["zacks", "sa_wall_street", "investing"]
    assert "sa_quant" not in sources
    assert result.consensus is not None  # consensus over available sources only


def test_uncovered_symbol_returns_empty_set():
    result = build_ticker_ratings("CASH")
    assert result.ratings == []
    assert result.consensus is None
    assert result.consensus_label is None


def test_malformed_upstream_values_are_dropped_not_guessed(monkeypatch):
    from app import ratings as ratings_module
    # Simulate real extracted data with bad values: out-of-range Zacks, out-of-range
    # SA number, and an unknown Investing label. Only the valid SA analysts remains.
    monkeypatch.setitem(ratings_module.RAW_RATINGS, "TEST", {
        "zacks": 9, "sa_quant": 7.5, "sa_analysts": 3.0, "sa_wall_street": None, "investing": "Outperform",
    })
    result = ratings_module.build_ticker_ratings("TEST")
    assert [r.source.value for r in result.ratings] == ["sa_analysts"]
    assert result.ratings[0].normalized == 50.0
    assert 0 <= (result.consensus or 0) <= 100


def test_active_source_merges_feed_over_seed_per_ticker(tmp_path, monkeypatch):
    from app import ratings as ratings_module
    feed_file = tmp_path / "feed.json"
    feed_file.write_text(json.dumps({
        "as_of": "2026-09-14T00:00:00Z",
        "ratings": [
            {"ticker": "AEM", "source": "sa_quant", "value": 4.5, "label": "Strong Buy"},
        ],
    }), encoding="utf-8")
    monkeypatch.setenv("ATLAS_RATINGS_FEED", str(feed_file))

    raw_map, as_of, source = ratings_module.active_source()
    assert source == "feed"
    assert raw_map["AEM"]["sa_quant"] == 4.5
    assert raw_map["CRDO"]["zacks"] == 2


def test_ratings_endpoint_and_404():
    body = client.get("/api/v1/signals/CRDO/ratings").json()["data"]
    assert body["symbol"] == "CRDO"
    assert len(body["ratings"]) == 5
    assert body["ratings"][0]["as_of"].endswith("Z")
    assert client.get("/api/v1/signals/CASH/ratings").status_code == 404
    assert client.get("/api/v1/signals/ZZZZ/ratings").status_code == 404

