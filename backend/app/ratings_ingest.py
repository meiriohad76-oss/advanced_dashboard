"""Ingest external ratings from the extraction project (BL-001).

The extractor ("email article analyzer") emits per-source rating *snapshots* of the
shape:

    {"ticker", "provider", "rating_type", "rating", "score", "price_target",
     "currency", "source_text"}

This module maps those snapshots onto the gauge's five sources and a small, stable
**ratings feed** contract (see docs/ratings-feed-contract.md), then converts a feed
into the ``{symbol: {source: native_value}}`` map that ``ratings.py`` already knows
how to normalize. The feed file is the integration boundary: point
``ATLAS_RATINGS_FEED`` at one and the /ratings endpoint serves real data; with no
feed (or a malformed one) the app falls back to the seeded sample.

Scales line up with the normalizers already in ratings.py: Seeking Alpha ratings are
1-5 floats (5 = best); Zacks is a 1-5 rank (1 = best); Investing.com is categorical.
"""
from __future__ import annotations

import json
from typing import Any

# (provider, rating_type) as emitted by the extractor -> gauge source key.
# Providers/types are matched case-insensitively.
PROVIDER_SOURCE: dict[tuple[str, str], str] = {
    ("seeking_alpha", "quant"): "sa_quant",
    ("seeking_alpha", "analysts"): "sa_analysts",
    ("seeking_alpha", "wall_street"): "sa_wall_street",
    ("zacks", "rank"): "zacks",
    # Investing.com categorical technical summary — accepted if the extractor emits it.
    ("investing", "technical"): "investing",
    ("investing", "summary"): "investing",
    ("investing", "rating"): "investing",
    ("investing_com", "technical"): "investing",
    ("investing_pro", "technical"): "investing",
}

# Sources whose native value is a categorical string rather than a number.
_CATEGORICAL = {"investing"}


def extract_snapshots(obj: Any) -> list[dict]:
    """Pull rating snapshots out of an extractor payload.

    Accepts either an already-flat list of snapshot dicts, or a single-page
    extractor result object carrying ``parsed_seeking_alpha_snapshots`` /
    ``parsed_zacks_snapshots`` / ``parsed_investing_snapshots`` arrays.
    """
    if isinstance(obj, list):
        return [s for s in obj if isinstance(s, dict) and "provider" in s]
    if isinstance(obj, dict):
        snapshots: list[dict] = []
        for key in ("parsed_seeking_alpha_snapshots", "parsed_zacks_snapshots", "parsed_investing_snapshots"):
            value = obj.get(key)
            if isinstance(value, list):
                snapshots.extend(s for s in value if isinstance(s, dict))
        return snapshots
    return []


def _source_key(snapshot: dict) -> str | None:
    provider = str(snapshot.get("provider", "")).strip().lower()
    rating_type = str(snapshot.get("rating_type", "")).strip().lower()
    return PROVIDER_SOURCE.get((provider, rating_type))


def snapshot_to_row(snapshot: dict, as_of: str) -> dict | None:
    """Convert one extractor snapshot to a feed row, or None if it isn't a
    recognized/parseable rating."""
    source = _source_key(snapshot)
    if source is None:
        return None
    label = snapshot.get("rating")
    if source in _CATEGORICAL:
        value: Any = str(label).strip() if label is not None else None
    else:
        raw_score = snapshot.get("score")
        try:
            value = float(raw_score)
        except (TypeError, ValueError):
            return None
        if source == "zacks":
            value = round(value)
    if value is None or value == "":
        return None
    row = {"ticker": str(snapshot.get("ticker", "")).strip().upper(), "source": source,
           "value": value, "label": (str(label).strip() if label is not None else None), "as_of": as_of}
    if not row["ticker"]:
        return None
    if snapshot.get("source_url"):
        row["url"] = snapshot["source_url"]
    return row


def snapshots_to_feed(snapshots: list[dict], as_of: str) -> dict:
    """Build a ratings-feed document from a list of extractor snapshots."""
    rows = [row for row in (snapshot_to_row(s, as_of) for s in snapshots) if row is not None]
    return {"as_of": as_of, "ratings": rows}


def feed_to_raw(feed: dict) -> tuple[dict[str, dict[str, Any]], str]:
    """Collapse a feed into ``({symbol: {source: native_value}}, as_of)`` — the shape
    ratings.py normalizes. Later rows for the same (ticker, source) win."""
    as_of = str(feed.get("as_of", ""))
    raw: dict[str, dict[str, Any]] = {}
    for row in feed.get("ratings", []):
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker", "")).strip().upper()
        source = row.get("source")
        value = row.get("value")
        if not ticker or source not in {"zacks", "sa_quant", "sa_analysts", "sa_wall_street", "investing"} or value is None:
            continue
        raw.setdefault(ticker, {})[source] = value
    return raw, as_of


def load_feed(path: str) -> dict:
    """Read a feed JSON file. Raises on I/O or JSON errors — callers decide whether
    to fall back to the seed."""
    with open(path, encoding="utf-8-sig") as handle:  # tolerate a UTF-8 BOM
        return json.load(handle)


def fetch_remote_feed(url: str, timeout: float = 5.0) -> list[dict]:
    """Fetch rating snapshots from an external HTTP extractor URL."""
    import urllib.request
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Atlas-Dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return extract_snapshots(data)
