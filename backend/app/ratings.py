"""External per-ticker ratings (BL-001).

Ratings are ingested external facts, not values Atlas computes. In the POC they
are seeded; a later integration will map the external extraction project's output
into ``RAW_RATINGS`` unchanged. The five sources use different native scales and
directions, so each is normalized to a common 0-100 "bullishness" axis
(100 = Strong Buy, 0 = Strong Sell) before rendering. Zacks Rank is inverted
(1 = best), which the normalizer handles.
"""
from __future__ import annotations

import os
from typing import Any

from . import ratings_ingest, store
from .models import Rating, RatingSource, TickerRatings

# As-of timestamp for the seeded snapshot (ISO-8601 UTC). Used when no real feed is
# configured. Real data carries its own run timestamp via the feed's ``as_of``.
SEED_AS_OF = "2026-09-09T14:42:00Z"

# Env var pointing at a ratings-feed JSON file produced from the extraction project
# (see ratings_ingest / docs/ratings-feed-contract.md). When unset or unreadable,
# the app serves the seeded sample below.
FEED_ENV_VAR = "ATLAS_RATINGS_FEED"

# Display metadata per source, in render order.
SOURCE_META: list[tuple[str, str]] = [
    (RatingSource.ZACKS, "Zacks Rank"),
    (RatingSource.SA_QUANT, "SA Quant"),
    (RatingSource.SA_ANALYSTS, "SA Analysts"),
    (RatingSource.SA_WALL_STREET, "SA Wall St"),
    (RatingSource.INVESTING, "Investing.com"),
]

# Seeded raw ratings, keyed by symbol. A ``None`` value means the source did not
# cover that symbol; it renders as an explicit "no data" state, never a guess.
# SPY intentionally has gaps to exercise partial-coverage handling.
#
# AEM / NVO / RIO overlap the external extractor's coverage universe (BL-005) so the
# gauge shows *real* data the moment a run is imported. AEM's seed values are the
# actual figures the extractor produced end-to-end (SA Quant 2.82 "Hold", SA Analysts
# 3.83 "Buy", SA Wall St 4.09 "Buy" -> consensus 64.5 "Buy"); Zacks and Investing.com
# were not present in that output, so they render "no data" rather than a guessed bar.
# NVO / RIO have no verified figures yet, so they carry no seed and show "no data"
# until a live extraction fills them (the seed must never fabricate a rating).
RAW_RATINGS: dict[str, dict[str, object]] = {
    "CRDO": {"zacks": 2, "sa_quant": 4.6, "sa_analysts": 4.1, "sa_wall_street": 3.9, "investing": "Strong Buy"},
    "NVDA": {"zacks": 1, "sa_quant": 4.8, "sa_analysts": 4.5, "sa_wall_street": 4.6, "investing": "Strong Buy"},
    "MSFT": {"zacks": 2, "sa_quant": 3.8, "sa_analysts": 4.2, "sa_wall_street": 4.4, "investing": "Buy"},
    "ANET": {"zacks": 2, "sa_quant": 4.88, "sa_analysts": 3.75, "sa_wall_street": 4.73, "investing": "Strong Buy"},
    "VRT": {"zacks": 3, "sa_quant": 3.4, "sa_analysts": 3.9, "sa_wall_street": 4.0, "investing": "Neutral"},
    "GOOGL": {"zacks": 2, "sa_quant": 4.0, "sa_analysts": 4.3, "sa_wall_street": 4.5, "investing": "Buy"},
    "SPY": {"zacks": 3, "sa_quant": None, "sa_analysts": None, "sa_wall_street": 3.5, "investing": "Buy"},
    "AEM": {"zacks": None, "sa_quant": 2.8, "sa_analysts": 3.75, "sa_wall_street": 4.27, "investing": None},
    "NVO": {"zacks": None, "sa_quant": None, "sa_analysts": None, "sa_wall_street": None, "investing": None},
    "RIO": {"zacks": None, "sa_quant": None, "sa_analysts": None, "sa_wall_street": None, "investing": None},
}

ZACKS_LABEL = {1: "Strong Buy", 2: "Buy", 3: "Hold", 4: "Sell", 5: "Strong Sell"}
INVESTING_NORMALIZED = {"Strong Sell": 0.0, "Sell": 25.0, "Neutral": 50.0, "Buy": 75.0, "Strong Buy": 100.0}
SA_LABEL_SCORES: dict[str, float] = {
    "strong buy": 4.8,
    "buy": 4.0,
    "hold": 3.0,
    "neutral": 3.0,
    "sell": 2.0,
    "strong sell": 1.0,
}


def normalize_zacks(rank: int) -> float:
    """Zacks Rank 1-5 (1 = best) -> 0-100 bullishness (higher = better)."""
    return round((5 - rank) / 4 * 100, 1)


def normalize_five(value: float) -> float:
    """Seeking Alpha 1.0-5.0 (5 = best) -> 0-100 bullishness."""
    return round((value - 1) / 4 * 100, 1)


def label_from_normalized(n: float) -> str:
    if n >= 80:
        return "Strong Buy"
    if n >= 60:
        return "Buy"
    if n >= 40:
        return "Hold"
    if n >= 20:
        return "Sell"
    return "Strong Sell"


def _rating(source: str, display: str, raw: object, as_of: str) -> Rating | None:
    """Build one normalized Rating, or ``None`` if the source is missing OR the
    upstream value is malformed/out-of-range.

    RAW_RATINGS is designed to be replaced wholesale by the external extraction
    project's output, so this is the trust boundary for unvalidated upstream data.
    An unrecognized categorical label or an out-of-range number is treated exactly
    like "no coverage" (dropped) rather than crashing the endpoint or being coerced
    into a guessed value — consistent with the feature's "never guess" contract.
    """
    if raw is None:
        return None
    if source == RatingSource.ZACKS:
        try:
            rank = round(float(raw))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
        if not 1 <= rank <= 5:
            return None
        normalized = normalize_zacks(rank)
        return Rating(source=source, display=display, value_native=str(rank),
                      label=ZACKS_LABEL.get(rank, label_from_normalized(normalized)),
                      normalized=normalized, native_scale="1-5 (1 best)", as_of=as_of)
    if source == RatingSource.INVESTING:
        text = str(raw).strip()
        normalized = INVESTING_NORMALIZED.get(text)
        if normalized is None:
            return None
        return Rating(source=source, display=display, value_native=text, label=text,
                      normalized=normalized, native_scale="Strong Sell-Strong Buy", as_of=as_of)
    # Seeking Alpha numeric sources (or categorical fallback).
    try:
        value = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        clean_raw = str(raw).strip().lower()
        if clean_raw in SA_LABEL_SCORES:
            value = SA_LABEL_SCORES[clean_raw]
        else:
            return None
    if not 1.0 <= value <= 5.0:
        return None
    normalized = normalize_five(value)

    # Format value: 2 decimals if present (e.g. 4.31, 3.18, 3.22), else 1 decimal (e.g. 4.6, 4.0)
    raw_str = str(raw).strip()
    decimals = len(raw_str.split(".")[-1]) if "." in raw_str else 0
    if decimals >= 2 or round(value, 2) != round(value, 1):
        value_native = f"{value:.2f}"
    else:
        value_native = f"{value:.1f}"

    # Seeking Alpha standard rating tiers (4.5+ Strong Buy, 3.5-4.49 Buy, 2.5-3.49 Hold, 1.5-2.49 Sell, <1.5 Strong Sell)
    if value >= 4.5:
        sa_label = "Strong Buy"
    elif value >= 3.5:
        sa_label = "Buy"
    elif value >= 2.5:
        sa_label = "Hold"
    elif value >= 1.5:
        sa_label = "Sell"
    else:
        sa_label = "Strong Sell"

    return Rating(source=source, display=display, value_native=value_native,
                  label=sa_label, normalized=normalized,
                  native_scale="1-5 (5 best)", as_of=as_of)


def active_source() -> tuple[dict[str, dict[str, Any]], str, str]:
    """Return ``(raw_map, as_of, source)`` for the ratings currently served.

    Precedence: the latest imported DB run (BL-004), then a file feed named by
    ``ATLAS_RATINGS_FEED``, then the seeded sample. Read fresh each call so a new
    extraction is picked up without a restart; any failure degrades to the seed
    rather than surfacing an error (POC graceful-degradation principle).
    """
    feed: dict | None = None
    source = "seed"
    try:
        feed = store.latest_feed()
        if feed is not None:
            source = "db"
    except Exception:  # noqa: BLE001 — storage must never break rendering
        feed = None
    if feed is None:
        path = os.environ.get(FEED_ENV_VAR)
        if path:
            try:
                feed = ratings_ingest.load_feed(path)
                source = "feed"
            except (OSError, ValueError):
                feed = None
    if feed is not None:
        raw_map, as_of = ratings_ingest.feed_to_raw(feed)
        if raw_map:
            merged = {**RAW_RATINGS, **raw_map}
            return merged, (as_of or SEED_AS_OF), source
    return RAW_RATINGS, SEED_AS_OF, "seed"


def _active_ratings() -> tuple[dict[str, dict[str, Any]], str]:
    raw_map, as_of, _ = active_source()
    return raw_map, as_of


def build_ticker_ratings(symbol: str) -> TickerRatings:
    """Assemble normalized ratings + blended consensus for one symbol.

    Consensus is the mean of the available normalized values; missing sources are
    excluded rather than treated as zero. Returns an empty set (consensus ``None``)
    for symbols with no coverage, e.g. CASH.
    """
    raw_map, as_of = _active_ratings()
    raw = raw_map.get(symbol.upper(), {})
    ratings: list[Rating] = []
    for key, (source, display) in zip(
        ("zacks", "sa_quant", "sa_analysts", "sa_wall_street", "investing"), SOURCE_META
    ):
        rating = _rating(source, display, raw.get(key), as_of)
        if rating is not None:
            ratings.append(rating)
    if ratings:
        consensus = round(sum(r.normalized for r in ratings) / len(ratings), 1)
        consensus_label: str | None = label_from_normalized(consensus)
    else:
        consensus = None
        consensus_label = None
    return TickerRatings(symbol=symbol.upper(), ratings=ratings,
                         consensus=consensus, consensus_label=consensus_label)
