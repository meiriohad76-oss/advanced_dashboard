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
        "imported_at TEXT NOT NULL, payload TEXT NOT NULL, is_active INTEGER DEFAULT 0)"
    )
    # Smart Recommended Alerts & Triggers
    conn.execute(
        "CREATE TABLE IF NOT EXISTS alert_recommendations ("
        "id TEXT PRIMARY KEY, symbol TEXT NOT NULL, category TEXT NOT NULL, "
        "status TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL, updated_at TEXT)"
    )
    # Active User Armed Alerts
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_alerts ("
        "id TEXT PRIMARY KEY, symbol TEXT NOT NULL, metric TEXT NOT NULL, "
        "condition TEXT NOT NULL, target_value REAL NOT NULL, severity TEXT NOT NULL, "
        "status TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT)"
    )
    cursor = conn.execute("PRAGMA table_info(imported_lists)")
    cols = [r[1] for r in cursor.fetchall()]
    if "is_active" not in cols:
        conn.execute("ALTER TABLE imported_lists ADD COLUMN is_active INTEGER DEFAULT 0")
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


def save_list(
    kind: str,
    payload: dict,
    name: str | None = None,
    imported_at: str | None = None,
    is_active: bool = True,
    path: str | None = None,
) -> str:
    """Persist an uploaded portfolio/watchlist as a row for its kind, marking it active if requested."""
    path = path or _db_path()
    imported_at = imported_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    active_val = 1 if is_active else 0
    conn = _connect(path)
    try:
        if is_active:
            conn.execute("UPDATE imported_lists SET is_active = 0 WHERE kind = ?", (kind,))
        conn.execute(
            "INSERT INTO imported_lists (kind, name, imported_at, payload, is_active) VALUES (?, ?, ?, ?, ?)",
            (kind, name, imported_at, json.dumps(payload), active_val),
        )
        conn.commit()
    finally:
        conn.close()
    return imported_at


def list_saved_portfolios(kind: str = "portfolio", path: str | None = None) -> list[dict[str, Any]]:
    """Return all saved portfolios ordered newest first, with summary statistics."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return []
    conn = _connect(path)
    try:
        cur = conn.execute(
            "SELECT id, name, imported_at, payload, is_active FROM imported_lists WHERE kind = ? ORDER BY id DESC",
            (kind,),
        )
        rows = cur.fetchall()
        result = []
        for r in rows:
            p_data = json.loads(r[3])
            holdings = p_data.get("holdings", [])
            total_val = sum(float(h.get("quantity", 0.0) or 0.0) * float(h.get("price", 0.0) or 0.0) for h in holdings)
            result.append({
                "id": r[0],
                "name": r[1] or f"Portfolio #{r[0]}",
                "imported_at": r[2],
                "count": len(holdings),
                "total_value": round(total_val, 2),
                "is_active": bool(r[4]),
            })
        return result
    finally:
        conn.close()


def activate_portfolio(portfolio_id: int, kind: str = "portfolio", path: str | None = None) -> dict | None:
    """Mark portfolio_id as active, deactivate all others, and return its stored record."""
    path = path or _db_path()
    conn = _connect(path)
    try:
        conn.execute("UPDATE imported_lists SET is_active = 0 WHERE kind = ?", (kind,))
        conn.execute("UPDATE imported_lists SET is_active = 1 WHERE id = ? AND kind = ?", (portfolio_id, kind))
        conn.commit()
        row = conn.execute("SELECT id, name, imported_at, payload, is_active FROM imported_lists WHERE id = ?", (portfolio_id,)).fetchone()
        if not row:
            return None
        return {"id": row[0], "name": row[1], "imported_at": row[2], "payload": json.loads(row[3]), "is_active": True}
    finally:
        conn.close()


def rename_portfolio(portfolio_id: int, new_name: str, path: str | None = None) -> bool:
    """Rename a saved portfolio."""
    path = path or _db_path()
    conn = _connect(path)
    try:
        cur = conn.execute("UPDATE imported_lists SET name = ? WHERE id = ?", (new_name.strip(), portfolio_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_portfolio(portfolio_id: int, kind: str = "portfolio", path: str | None = None) -> bool:
    """Delete a saved portfolio. If it was active, activate the newest remaining portfolio."""
    path = path or _db_path()
    conn = _connect(path)
    try:
        row = conn.execute("SELECT is_active FROM imported_lists WHERE id = ?", (portfolio_id,)).fetchone()
        if not row:
            return False
        was_active = bool(row[0])
        conn.execute("DELETE FROM imported_lists WHERE id = ?", (portfolio_id,))
        conn.commit()
        if was_active:
            newest = conn.execute("SELECT id FROM imported_lists WHERE kind = ? ORDER BY id DESC LIMIT 1", (kind,)).fetchone()
            if newest:
                conn.execute("UPDATE imported_lists SET is_active = 1 WHERE id = ?", (newest[0],))
                conn.commit()
        return True
    finally:
        conn.close()


def deactivate_all(kind: str = "portfolio", path: str | None = None) -> None:
    """Deactivate all portfolios of kind (e.g. when reverting to demo)."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return
    conn = _connect(path)
    try:
        conn.execute("UPDATE imported_lists SET is_active = 0 WHERE kind = ?", (kind,))
        conn.commit()
    finally:
        conn.close()


def latest_list(kind: str, path: str | None = None) -> dict | None:
    """Return the currently active (or most recent) uploaded list of ``kind`` as
    ``{id, name, imported_at, payload, is_active}``, or None if nothing has been uploaded."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return None
    conn = _connect(path)
    try:
        # Check active first
        row = conn.execute(
            "SELECT id, name, imported_at, payload, is_active FROM imported_lists WHERE kind = ? AND is_active = 1 ORDER BY id DESC LIMIT 1",
            (kind,),
        ).fetchone()
        if not row:
            # Fall back to newest row
            row = conn.execute(
                "SELECT id, name, imported_at, payload, is_active FROM imported_lists WHERE kind = ? ORDER BY id DESC LIMIT 1",
                (kind,),
            ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "imported_at": row[2], "payload": json.loads(row[3]), "is_active": bool(row[4])}


def update_latest_list(kind: str, payload: dict, path: str | None = None) -> bool:
    """Update payload of the active (or latest) imported list in-place."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return False
    conn = _connect(path)
    try:
        cur = conn.execute("SELECT id FROM imported_lists WHERE kind = ? AND is_active = 1 ORDER BY id DESC LIMIT 1", (kind,))
        row = cur.fetchone()
        if not row:
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


def add_watchlist_item(item: dict[str, Any], path: str | None = None) -> dict[str, Any]:
    """Add or update a single symbol in the active watchlist."""
    symbol = str(item.get("symbol", "")).strip().upper()
    if not symbol:
        raise ValueError("Symbol is required")

    stored = latest_list("watchlist", path=path)
    if stored and isinstance(stored.get("payload"), dict):
        payload = dict(stored["payload"])
        items = list(payload.get("items", []))
    else:
        payload = {"items": [], "source": "created"}
        items = []

    # Update if exists, else append
    existing_idx = next((i for i, it in enumerate(items) if it.get("symbol", "").upper() == symbol), None)
    new_entry = {
        "symbol": symbol,
        "name": item.get("name") or (items[existing_idx].get("name") if existing_idx is not None else symbol),
        "sector": item.get("sector") or (items[existing_idx].get("sector") if existing_idx is not None else "Equities"),
        "note": item.get("note") if "note" in item else (items[existing_idx].get("note") if existing_idx is not None else ""),
    }

    if existing_idx is not None:
        items[existing_idx].update(new_entry)
    else:
        items.append(new_entry)

    payload["items"] = items
    if stored:
        update_latest_list("watchlist", payload, path=path)
    else:
        save_list("watchlist", payload, name="Candidate Radar", path=path)

    return new_entry


def remove_watchlist_item(symbol: str, path: str | None = None) -> bool:
    """Remove a symbol from the active watchlist."""
    sym = symbol.strip().upper()
    stored = latest_list("watchlist", path=path)
    if not stored or not isinstance(stored.get("payload"), dict):
        return False

    payload = dict(stored["payload"])
    items = list(payload.get("items", []))
    original_len = len(items)
    filtered = [it for it in items if it.get("symbol", "").upper() != sym]

    if len(filtered) == original_len:
        return False

    payload["items"] = filtered
    update_latest_list("watchlist", payload, path=path)
    return True


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


def get_alert_recommendation_statuses(path: str | None = None) -> dict[str, str]:
    """Return map of recommendation ID to status ('PENDING', 'ACKNOWLEDGED', 'DECLINED')."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return {}
    conn = _connect(path)
    try:
        rows = conn.execute("SELECT id, status FROM alert_recommendations").fetchall()
        return {r[0]: r[1] for r in rows}
    finally:
        conn.close()


def save_alert_recommendation_action(
    rec_id: str,
    symbol: str,
    category: str,
    status: str,
    payload: dict | None = None,
    path: str | None = None,
) -> None:
    """Save or update user action on a recommendation (ACKNOWLEDGED or DECLINED)."""
    path = path or _db_path()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _connect(path)
    try:
        payload_json = json.dumps(payload) if payload else None
        conn.execute(
            "INSERT INTO alert_recommendations (id, symbol, category, status, payload, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at",
            (rec_id, symbol.upper(), category, status, payload_json, now_iso, now_iso),
        )
        conn.commit()
    finally:
        conn.close()


def get_user_alerts(path: str | None = None) -> list[dict[str, Any]]:
    """Return all stored armed user alerts."""
    path = path or _db_path()
    if path != ":memory:" and not os.path.exists(path):
        return []
    conn = _connect(path)
    try:
        rows = conn.execute(
            "SELECT id, symbol, metric, condition, target_value, severity, status, created_at, payload "
            "FROM user_alerts ORDER BY created_at DESC"
        ).fetchall()
        alerts: list[dict[str, Any]] = []
        for r in rows:
            alert = {
                "id": r[0],
                "symbol": r[1],
                "metric": r[2],
                "condition": r[3],
                "targetValue": r[4],
                "severity": r[5],
                "status": r[6],
                "createdAt": r[7],
            }
            if r[8]:
                try:
                    alert.update(json.loads(r[8]))
                except Exception:
                    pass
            alerts.append(alert)
        return alerts
    finally:
        conn.close()


def save_user_alert(alert_data: dict[str, Any], path: str | None = None) -> dict[str, Any]:
    """Persist or update an active user alert."""
    path = path or _db_path()
    conn = _connect(path)
    try:
        alert_id = str(alert_data.get("id") or f"usr_{int(datetime.now(timezone.utc).timestamp() * 1000)}")
        symbol = str(alert_data.get("symbol", "")).upper()
        metric = str(alert_data.get("metric", "PRICE"))
        condition = str(alert_data.get("condition", "ABOVE"))
        target_val = float(alert_data.get("targetValue", 0.0) or 0.0)
        severity = str(alert_data.get("severity", "warning"))
        status = str(alert_data.get("status", "ARMED"))
        created_at = str(alert_data.get("createdAt") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
        payload_json = json.dumps(alert_data)

        conn.execute(
            "INSERT INTO user_alerts (id, symbol, metric, condition, target_value, severity, status, created_at, payload) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET "
            "symbol = excluded.symbol, metric = excluded.metric, condition = excluded.condition, "
            "target_value = excluded.target_value, severity = excluded.severity, status = excluded.status, payload = excluded.payload",
            (alert_id, symbol, metric, condition, target_val, severity, status, created_at, payload_json),
        )
        conn.commit()
        alert_data["id"] = alert_id
        return alert_data
    finally:
        conn.close()


def delete_user_alert(alert_id: str, path: str | None = None) -> bool:
    """Delete a user alert by ID."""
    path = path or _db_path()
    conn = _connect(path)
    try:
        cur = conn.execute("DELETE FROM user_alerts WHERE id = ?", (alert_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()

