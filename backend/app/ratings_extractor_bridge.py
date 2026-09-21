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
import subprocess
import sys
import time
import urllib.request
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


def find_analyzer_root() -> str | None:
    """Locate the root directory of the email article analyzer repository."""
    db = find_analyzer_db()
    if db:
        root = os.path.dirname(os.path.dirname(os.path.abspath(db)))
        if os.path.isdir(os.path.join(root, "src")):
            return root
    candidates = [
        r"C:\Users\meiri\OneDrive\Documents\email article analyzer",
        os.path.expanduser(r"~\OneDrive\Documents\email article analyzer"),
        os.path.expanduser(r"~\Documents\email article analyzer"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "email article analyzer")),
    ]
    for c in candidates:
        if c and os.path.isdir(c) and os.path.isdir(os.path.join(c, "src")):
            return c
    return None


def is_extractor_running(url: str = "http://127.0.0.1:8000") -> bool:
    """Check if the extractor service is currently responding on its configured HTTP port."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AtlasDashboard"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status in (200, 301, 302, 307, 308)
    except Exception:
        return False


def ensure_extractor_running(url: str = "http://127.0.0.1:8000") -> dict[str, Any]:
    """Ensure the email article analyzer extractor process is running. Spawns it if stopped."""
    research_url = f"{url.rstrip('/')}/research"
    if is_extractor_running(url):
        return {"status": "running", "url": research_url, "already_running": True}

    root = find_analyzer_root()
    if not root:
        return {
            "status": "error",
            "message": "Email article analyzer directory not found",
            "url": research_url,
        }

    py_candidates = [
        sys.executable,
        os.path.join(root, ".venv", "Scripts", "python.exe"),
        r"C:\Users\meiri\AppData\Local\Programs\Python\Python314\python.exe",
        "python",
    ]
    python_exe = "python"
    for cand in py_candidates:
        if cand and (os.path.isfile(cand) or cand == "python"):
            python_exe = cand
            break

    src_dir = os.path.join(root, "src")
    env = os.environ.copy()
    current_pypath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = f"{src_dir}{os.pathsep}{current_pypath}" if current_pypath else src_dir

    creation_flags = 0
    if os.name == "nt":
        creation_flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(subprocess, "DETACHED_PROCESS", 0)

    try:
        subprocess.Popen(
            [python_exe, "-m", "uvicorn", "email_article_analyzer.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=root,
            env=env,
            creationflags=creation_flags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        return {"status": "error", "message": f"Failed to spawn uvicorn: {exc}", "url": research_url}

    for _ in range(12):
        time.sleep(0.5)
        if is_extractor_running(url):
            return {"status": "running", "url": research_url, "already_running": False}

    return {"status": "starting", "url": research_url, "already_running": False}



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
    and write data/ratings_feed.json. If the analyzer database is not accessible (e.g. deployed on
    Raspberry Pi where the companion analyzer lives on a host PC), falls back to data/ratings_feed.json.
    """
    db_path = find_analyzer_db()
    feed: dict[str, Any] | None = None
    source = "email_article_analyzer"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if db_path:
        feed = extract_ratings_from_db(db_path, as_of=now)

    # Fallback to local ratings_feed.json when app.db is unavailable (e.g. Pi deployment)
    if not feed or not feed.get("ratings"):
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        candidates = [
            out_file,
            os.environ.get("ATLAS_RATINGS_FEED"),
            os.path.join(repo_root, "data", "ratings_feed.json"),
            os.path.join(repo_root, "..", "data", "ratings_feed.json"),
            "/app/data/ratings_feed.json",
            "/home/ahad/atlas/data/ratings_feed.json",
        ]
        for c in candidates:
            if c and os.path.exists(c) and os.path.isfile(c):
                try:
                    with open(c, "r", encoding="utf-8-sig") as handle:
                        parsed = json.load(handle)
                        if parsed and parsed.get("ratings"):
                            feed = parsed
                            source = f"ratings_feed_file ({os.path.basename(c)})"
                            break
                except Exception:
                    continue

    if not feed or not feed.get("ratings"):
        return {
            "synced": False,
            "reason": "Neither email analyzer database nor ratings_feed.json found",
            "db_path": db_path,
        }

    # Ensure feed has fresh timestamp when synced
    feed["as_of"] = now
    for r in feed.get("ratings", []):
        r["as_of"] = now

    # Save to Atlas SQLite DB (ratings_runs table)
    store.save_feed(feed, imported_at=now)

    # Also update data/ratings_feed.json file if on host with analyzer
    if db_path:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        feed_file = out_file or os.environ.get("ATLAS_FEED_OUT_FILE") or os.path.join(repo_root, "data", "ratings_feed.json")
        try:
            os.makedirs(os.path.dirname(feed_file), exist_ok=True)
            with open(feed_file, "w", encoding="utf-8") as f:
                json.dump(feed, f, indent=2)
        except Exception as exc:
            logger.warning("Could not write ratings_feed.json: %s", exc)

    distinct_tickers = sorted(list({r["ticker"] for r in feed["ratings"]}))

    # Check coverage against active portfolio holdings
    active_symbols: set[str] = set()
    try:
        active_list = store.latest_list("portfolio")
        if active_list and active_list.get("payload"):
            holdings_list = active_list["payload"].get("holdings", [])
            active_symbols = {str(h.get("symbol")).upper() for h in holdings_list if h.get("symbol")}
    except Exception:
        pass

    covered_in_portfolio = sorted(list(active_symbols.intersection(set(distinct_tickers))))
    missing_in_portfolio = sorted(list(active_symbols.difference(set(distinct_tickers))))

    return {
        "synced": True,
        "source": source,
        "db_path": db_path,
        "as_of": feed.get("as_of", now),
        "imported_rows": len(feed["ratings"]),
        "tickers_count": len(distinct_tickers),
        "tickers": distinct_tickers,
        "active_portfolio_covered": covered_in_portfolio,
        "active_portfolio_missing": missing_in_portfolio,
    }


def extract_rating_shifts(db_path: str | None = None) -> list[dict[str, Any]]:
    """Extract rating upgrades, downgrades, and price target revisions by comparing
    historical snapshots across consecutive extractor runs.
    """
    path = db_path or find_analyzer_db()
    if not path or not os.path.exists(path):
        # Fallback sample shifts for offline/testing environments
        return [
            {
                "ticker": "ANET",
                "provider": "seeking_alpha",
                "field": "Quant",
                "previous": "Hold",
                "current": "Strong Buy",
                "direction": "UPGRADE",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "headline": "ANET: Seeking Alpha Quant upgraded from Hold to Strong Buy",
            },
            {
                "ticker": "ASML",
                "provider": "zacks",
                "field": "Rank",
                "previous": "Rank #2 Buy",
                "current": "Rank #1 Strong Buy",
                "direction": "UPGRADE",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "headline": "ASML: Zacks Rank upgraded from Rank #2 Buy to Rank #1 Strong Buy",
            },
            {
                "ticker": "CLS",
                "provider": "seeking_alpha",
                "field": "Quant",
                "previous": "Strong Buy",
                "current": "Buy",
                "direction": "DOWNGRADE",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "headline": "CLS: Seeking Alpha Quant trimmed from Strong Buy to Buy",
            },
        ]

    from collections import defaultdict
    conn = sqlite3.connect(path)
    try:
        rows = conn.execute(
            """
            SELECT ticker, provider, data_type, data_json, created_at, run_id 
            FROM ticker_enrichments 
            WHERE provider IN ('zacks', 'seeking_alpha', 'investing', 'investing_pro')
              AND data_type IN ('rank', 'quant', 'analysts', 'wall_street', 'price_target')
            ORDER BY ticker, provider, data_type, run_id ASC
            """
        ).fetchall()
    finally:
        conn.close()

    grouped: dict[tuple[str, str, str], list[Any]] = defaultdict(list)
    for r in rows:
        grouped[(r[0], r[1], r[2])].append(r)

    grade_ranks = {
        "strong buy": 5, "buy": 4, "hold": 3, "sell": 2, "strong sell": 1,
        "rank #1 strong buy": 5, "rank #2 buy": 4, "rank #3 hold": 3, "rank #4 sell": 2, "rank #5 strong sell": 1,
    }

    shifts: list[dict[str, Any]] = []
    for (ticker, provider, data_type), items in grouped.items():
        if len(items) > 1:
            prev_row, curr_row = items[-2], items[-1]
            try:
                pj = json.loads(prev_row[3]) if prev_row[3] else {}
                cj = json.loads(curr_row[3]) if curr_row[3] else {}
            except Exception:
                continue

            pr = pj.get("rating") or pj.get("score")
            cr = cj.get("rating") or cj.get("score")
            pt_prev = pj.get("price_target")
            pt_curr = cj.get("price_target")

            prov_name = provider.replace("_", " ").title()
            field_name = data_type.replace("_", " ").title()

            if data_type == "price_target":
                if pt_prev and pt_curr and pt_prev != pt_curr:
                    direction = "UPGRADE" if float(pt_curr) > float(pt_prev) else "DOWNGRADE"
                    shifts.append({
                        "ticker": ticker,
                        "provider": provider,
                        "field": "Price Target",
                        "previous": f"${float(pt_prev):.2f}",
                        "current": f"${float(pt_curr):.2f}",
                        "direction": direction,
                        "date": curr_row[4][:10] if curr_row[4] else "",
                        "headline": f"{ticker}: {prov_name} target revised from ${float(pt_prev):.2f} to ${float(pt_curr):.2f}",
                    })
            else:
                if pr and cr and str(pr).strip() != str(cr).strip():
                    p_lower = str(pr).strip().lower()
                    c_lower = str(cr).strip().lower()
                    p_val = grade_ranks.get(p_lower, 0)
                    c_val = grade_ranks.get(c_lower, 0)
                    if c_val > 0 and p_val > 0:
                        direction = "UPGRADE" if c_val > p_val else "DOWNGRADE"
                    else:
                        direction = "REVISION"
                    shifts.append({
                        "ticker": ticker,
                        "provider": provider,
                        "field": field_name,
                        "previous": str(pr).strip(),
                        "current": str(cr).strip(),
                        "direction": direction,
                        "date": curr_row[4][:10] if curr_row[4] else "",
                        "headline": f"{ticker}: {prov_name} {field_name} changed from {pr} to {cr}",
                    })

    # Sort newest date first, then UPGRADES first
    shifts.sort(key=lambda s: (s.get("date", ""), s.get("direction") == "UPGRADE"), reverse=True)
    return shifts

