import json
import pytest

from app import ratings
from app.ratings_ingest import (
    extract_snapshots,
    feed_to_raw,
    snapshot_to_row,
    snapshots_to_feed,
)

AS_OF = "2026-07-06T15:34:00Z"


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "test.db"))

# Real snapshot shapes emitted by the extraction project (from its sa/zacks tests).
SA_QUANT = {"ticker": "AEM", "provider": "seeking_alpha", "rating_type": "quant", "rating": "Hold", "score": 2.82}
SA_ANALYSTS = {"ticker": "AEM", "provider": "seeking_alpha", "rating_type": "analysts", "rating": "Buy", "score": 3.83}
SA_WALL = {"ticker": "AEM", "provider": "seeking_alpha", "rating_type": "wall_street", "rating": "Buy", "score": 4.09}
ZACKS = {"ticker": "AEM", "provider": "zacks", "rating_type": "rank", "rating": "Hold", "score": 3}
INVESTING = {"ticker": "AEM", "provider": "investing", "rating_type": "technical", "rating": "Buy"}


def test_snapshot_mapping_matches_gauge_sources():
    assert snapshot_to_row(SA_QUANT, AS_OF) == {"ticker": "AEM", "source": "sa_quant", "value": 2.82, "label": "Hold", "as_of": AS_OF}
    assert snapshot_to_row(SA_WALL, AS_OF)["source"] == "sa_wall_street"
    # Zacks score is coerced to an integer rank.
    zrow = snapshot_to_row(ZACKS, AS_OF)
    assert zrow["source"] == "zacks" and zrow["value"] == 3 and isinstance(zrow["value"], int)
    # Investing.com is categorical — the value is the label text.
    assert snapshot_to_row(INVESTING, AS_OF)["value"] == "Buy"


def test_unknown_or_unparseable_snapshots_are_dropped():
    assert snapshot_to_row({"ticker": "X", "provider": "morningstar", "rating_type": "star"}, AS_OF) is None
    assert snapshot_to_row({"ticker": "X", "provider": "seeking_alpha", "rating_type": "quant", "score": "n/a"}, AS_OF) is None
    assert snapshot_to_row({"provider": "zacks", "rating_type": "rank", "score": 2}, AS_OF) is None  # no ticker


def test_extract_snapshots_from_single_page_payload():
    page = {"status": "success", "parsed_seeking_alpha_snapshots": [SA_QUANT], "parsed_zacks_snapshots": [ZACKS]}
    snaps = extract_snapshots(page)
    assert {s["rating_type"] for s in snaps} == {"quant", "rank"}


def test_feed_round_trips_to_raw_map():
    feed = snapshots_to_feed([SA_QUANT, SA_ANALYSTS, SA_WALL, ZACKS, INVESTING], AS_OF)
    raw, as_of = feed_to_raw(feed)
    assert as_of == AS_OF
    assert raw["AEM"] == {"sa_quant": 2.82, "sa_analysts": 3.83, "sa_wall_street": 4.09, "zacks": 3, "investing": "Buy"}


def test_end_to_end_endpoint_serves_feed_data(tmp_path, monkeypatch):
    feed = snapshots_to_feed([SA_QUANT, SA_ANALYSTS, SA_WALL, ZACKS, INVESTING], AS_OF)
    feed_path = tmp_path / "ratings_feed.json"
    feed_path.write_text(json.dumps(feed), encoding="utf-8")
    monkeypatch.setenv("ATLAS_RATINGS_FEED", str(feed_path))

    result = ratings.build_ticker_ratings("AEM")
    by_source = {r.source.value: r for r in result.ratings}
    assert set(by_source) == {"sa_quant", "sa_analysts", "sa_wall_street", "zacks", "investing"}
    assert by_source["sa_quant"].value_native in ("2.8", "2.82") and by_source["sa_quant"].label == "Hold"
    assert by_source["zacks"].value_native == "3" and by_source["zacks"].normalized == 50.0
    assert by_source["sa_quant"].as_of == AS_OF  # real feed timestamp, not the seed's
    assert result.consensus is not None


def test_falls_back_to_seed_when_feed_absent(monkeypatch):
    monkeypatch.delenv("ATLAS_RATINGS_FEED", raising=False)
    # CRDO exists only in the seeded sample, proving fallback works.
    assert len(ratings.build_ticker_ratings("CRDO").ratings) == 5
