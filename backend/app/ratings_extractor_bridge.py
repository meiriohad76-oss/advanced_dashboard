"""Automatic Ratings Extractor Bridge.

Connects directly to the companion "email article analyzer" SQLite database
(located at C:\\Users\\meiri\\OneDrive\\Documents\\email article analyzer\\data\\app.db or EMAIL_ANALYZER_DB)
to pull real-time extracted ratings across Seeking Alpha (Quant, Analysts, Wall St),
Zacks (Rank #1-5), and Investing.com (Forecast / Consensus).

This completely automates the rank extraction pipeline without requiring manual
JSON file drops or copy-pasting.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

from . import ratings_ingest, store

logger = logging.getLogger(__name__)

def find_analyzer_db() -> str | None:
    """Find the path to the email article analyzer SQLite database."""
    env_path = os.environ.get("EMAIL_ANALYZER_DB")
    if env_path and os.path.exists(env_path) and os.path.isfile(env_path):
        return env_path

    candidates = [
        r"C:\Users\meiri\OneDrive\Documents\email article analyzer\data\app.db",
        os.path.expanduser(r"~\OneDrive\Documents\email article analyzer\data\app.db"),
        os.path.expanduser(r"~\Documents\email article analyzer\data\app.db"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "email article analyzer", "data", "app.db")),
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate) and os.path.isfile(candidate):
            return candidate
    return None


def extract_ratings_from_db(db_path: str, as_of: str | None = None) -> dict[str, Any]:
    """Extract rating snapshots from the email article analyzer SQLite database
    and assemble them into an Atlas ratings feed.
    """
    as_of = as_of or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = sqlite3.connect(db_path)
    try:
        # Pull all enrichments for relevant providers
        cursor = conn.execute(
            """
            SELECT ticker, provider, data_type, data_json, updated_at
            FROM ticker_enrichments
            WHERE provider IN ('seeking_alpha', 'zacks', 'investing', 'investing_pro')
            ORDER BY id ASC
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    raw_snapshots: list[dict[str, Any]] = []
    for ticker, provider, data_type, data_json, updated_at in rows:
        try:
            parsed = json.loads(data_json) if data_json else {}
            if not isinstance(parsed, dict):
                continue
            parsed.setdefault("ticker", ticker)
            parsed.setdefault("provider", provider)
            parsed.setdefault("rating_type", data_type)
            if updated_at:
                parsed.setdefault("updated_at", updated_at)
            raw_snapshots.append(parsed)
        except Exception:
            continue

    # Convert each snapshot using ratings_ingest
    feed_rows: list[dict[str, Any]] = []
    for s in raw_snapshots:
        row = ratings_ingest.snapshot_to_row(s, as_of)
        if row:
            feed_rows.append(row)

    # Later rows for the same (ticker, source) win
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for r in feed_rows:
        by_key[(r["ticker"], r["source"])] = r

    unique_rows = list(by_key.values())
    return {
        "as_of": as_of,
        "ratings": unique_rows,
    }


def sync_ratings_from_extractor(force: bool = False, out_file: str | None = None) -> dict[str, Any]:
    """Extract ratings from the email article analyzer database, persist into Atlas SQLite DB,
    and write data/ratings_feed.json.
    """
    db_path = find_analyzer_db()
    if not db_path:
        return {
            "synced": False,
            "reason": "email article analyzer database not found",
        }

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    feed = extract_ratings_from_db(db_path, as_of=now)
    if not feed["ratings"]:
        return {
            "synced": False,
            "reason": "no valid ratings found in email analyzer database",
            "db_path": db_path,
        }

    # Save to Atlas SQLite DB (ratings_runs table)
    store.save_feed(feed, imported_at=now)

    # Also update data/ratings_feed.json file at root & in data/
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    feed_file = out_file or os.environ.get("ATLAS_FEED_OUT_FILE") or os.path.join(repo_root, "data", "ratings_feed.json")
    try:
        os.makedirs(os.path.dirname(feed_file), exist_ok=True)
        with open(feed_file, "w", encoding="utf-8") as f:
            json.dump(feed, f, indent=2)
    except Exception as exc:
        logger.warning("Could not write ratings_feed.json: %s", exc)

    distinct_tickers = sorted(list({r["ticker"] for r in feed["ratings"]}))
    return {
        "synced": True,
        "source": "email_article_analyzer",
        "db_path": db_path,
        "as_of": now,
        "imported_rows": len(feed["ratings"]),
        "tickers_count": len(distinct_tickers),
        "tickers": distinct_tickers,
    }
