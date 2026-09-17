"""Minimal SQLite storage for imported ratings runs (BL-004).

Each extraction run is stored as one row: the ratings feed (JSON) plus its
``extracted_at`` timestamp. The dashboard reads the latest run and shows how fresh it
is; data older than the staleness threshold is flagged. Uses stdlib ``sqlite3`` — no
new dependency. DB path comes from ``ATLAS_DB`` (default: backend/data/atlas.db).
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = os.path.join(os.path.dirname(__file__), "..", "data", "atlas.db")
STALE_THRESHOLD_DAYS = 3


def _db_path() -> str:
    return os.environ.get("ATLAS_DB", DEFAULT_DB)


def _connect(path: str) -> sqlite3.Connection:
    if path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ratings_runs ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, extracted_at TEXT NOT NULL, "
        "imported_at TEXT NOT NULL, feed TEXT NOT NULL)"
    )
    # Uploaded portfolio / watchlist. One kind ('portfolio' | 'watchlist') can have many
    # rows over time; the latest by id wins, so re-uploading just supersedes.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS imported_lists ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT, "
        "imported_at TEXT NOT NULL, payload TEXT NOT NULL)"
    )
    return conn


def save_feed(feed: dict, imported_at: str | None = None, path: str | None = None) -> None:
    """Persist one ratings feed as a new run."""
    path = path or _db_path()
    imported_at = imported_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _connect(path)
    try:
        conn.execute(
            "INSERT INTO ratings_runs (extracted_at, imported_at, feed) VALUES (?, ?, ?)",
            (str(feed.get("as_of", "")), imported_at, json.dumps(feed)),
        )
        conn.commit()
    finally:
        conn.close()


def latest_feed(path: str | None = None) -> dict | None:
    """Return the most recent stored feed, or None if there are no runs. Does not
    create the DB file on a pure read (keeps callers side-effect free)."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return None
    conn = _connect(path)
    try:
        row = conn.execute("SELECT feed FROM ratings_runs ORDER BY id DESC LIMIT 1").fetchone()
    finally:
        conn.close()
    return json.loads(row[0]) if row else None


def save_list(kind: str, payload: dict, name: str | None = None, imported_at: str | None = None, path: str | None = None) -> str:
    """Persist an uploaded portfolio/watchlist as the newest row for its kind."""
    path = path or _db_path()
    imported_at = imported_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _connect(path)
    try:
        conn.execute(
            "INSERT INTO imported_lists (kind, name, imported_at, payload) VALUES (?, ?, ?, ?)",
            (kind, name, imported_at, json.dumps(payload)),
        )
        conn.commit()
    finally:
        conn.close()
    return imported_at


def latest_list(kind: str, path: str | None = None) -> dict | None:
    """Return the most recent uploaded list of ``kind`` as
    ``{name, imported_at, payload}``, or None if nothing has been uploaded."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return None
    conn = _connect(path)
    try:
        row = conn.execute(
            "SELECT name, imported_at, payload FROM imported_lists WHERE kind = ? ORDER BY id DESC LIMIT 1",
            (kind,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return {"name": row[0], "imported_at": row[1], "payload": json.loads(row[2])}


def update_latest_list(kind: str, payload: dict, path: str | None = None) -> bool:
    """Update payload of the most recent imported list in-place."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return False
    conn = _connect(path)
    try:
        cur = conn.execute("SELECT id FROM imported_lists WHERE kind = ? ORDER BY id DESC LIMIT 1", (kind,))
        row = cur.fetchone()
        if not row:
            return False
        conn.execute("UPDATE imported_lists SET payload = ? WHERE id = ?", (json.dumps(payload), row[0]))
        conn.commit()
        return True
    finally:
        conn.close()


def clear_list(kind: str, path: str | None = None) -> None:
    """Remove all uploaded rows of ``kind`` (revert to the seed)."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return
    conn = _connect(path)
    try:
        conn.execute("DELETE FROM imported_lists WHERE kind = ?", (kind,))
        conn.commit()
    finally:
        conn.close()


def evaluate_freshness(extracted_at: str, now: datetime, threshold_days: int = STALE_THRESHOLD_DAYS) -> dict[str, Any]:
    """Pure freshness check: age in days and whether it exceeds the threshold.

    An unparseable/empty timestamp is treated as stale (data can't be trusted as fresh).
    """
    try:
        dt = datetime.fromisoformat(extracted_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return {"extracted_at": extracted_at or None, "age_days": None, "stale": True, "threshold_days": threshold_days}
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age_days = (now - dt).total_seconds() / 86400
    return {
        "extracted_at": extracted_at,
        "age_days": round(age_days, 2),
        "stale": age_days > threshold_days,
        "threshold_days": threshold_days,
    }
