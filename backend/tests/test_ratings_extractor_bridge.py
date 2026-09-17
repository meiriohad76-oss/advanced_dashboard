import json
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app
from app.ratings_extractor_bridge import extract_ratings_from_db, sync_ratings_from_extractor

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "atlas.db"))
    monkeypatch.setenv("ATLAS_FEED_OUT_FILE", str(tmp_path / "feed_out.json"))


def test_extract_ratings_from_db(tmp_path):
    analyzer_db = tmp_path / "analyzer.db"
    conn = sqlite3.connect(analyzer_db)
    conn.execute(
        """
        CREATE TABLE ticker_enrichments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            provider TEXT NOT NULL,
            data_type TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT
        )
        """
    )
    # Insert Seeking Alpha, Zacks, and Investing.com test records
    conn.execute(
        "INSERT INTO ticker_enrichments (ticker, provider, data_type, data_json) VALUES (?, ?, ?, ?)",
        ("NVDA", "seeking_alpha", "quant", json.dumps({"ticker": "NVDA", "provider": "seeking_alpha", "rating_type": "quant", "rating": "Strong Buy", "score": 4.85})),
    )
    conn.execute(
        "INSERT INTO ticker_enrichments (ticker, provider, data_type, data_json) VALUES (?, ?, ?, ?)",
        ("NVDA", "zacks", "rank", json.dumps({"ticker": "NVDA", "provider": "zacks", "rating_type": "rank", "rating": "Rank #1 Strong Buy", "score": 1})),
    )
    conn.execute(
        "INSERT INTO ticker_enrichments (ticker, provider, data_type, data_json) VALUES (?, ?, ?, ?)",
        ("NVDA", "investing_pro", "forecast", json.dumps({"ticker": "NVDA", "provider": "investing_pro", "rating_type": "forecast", "rating": "Strong Buy", "score": None})),
    )
    conn.commit()
    conn.close()

    feed = extract_ratings_from_db(str(analyzer_db), as_of="2026-09-17T06:00:00Z")
    assert len(feed["ratings"]) == 3
    by_source = {r["source"]: r for r in feed["ratings"]}
    assert "sa_quant" in by_source and by_source["sa_quant"]["value"] == 4.85
    assert "zacks" in by_source and by_source["zacks"]["value"] == 1
    assert "investing" in by_source and by_source["investing"]["value"] == "Strong Buy"


def test_sync_ratings_from_extractor_with_monkeypatch(tmp_path, monkeypatch):
    analyzer_db = tmp_path / "analyzer.db"
    conn = sqlite3.connect(analyzer_db)
    conn.execute(
        """
        CREATE TABLE ticker_enrichments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            provider TEXT NOT NULL,
            data_type TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        "INSERT INTO ticker_enrichments (ticker, provider, data_type, data_json) VALUES (?, ?, ?, ?)",
        ("ANET", "seeking_alpha", "quant", json.dumps({"ticker": "ANET", "provider": "seeking_alpha", "rating_type": "quant", "rating": "Strong Buy", "score": 4.9})),
    )
    conn.commit()
    conn.close()

    monkeypatch.setenv("EMAIL_ANALYZER_DB", str(analyzer_db))
    res = sync_ratings_from_extractor()
    assert res["synced"] is True
    assert res["imported_rows"] == 1
    assert "ANET" in res["tickers"]

    latest = store.latest_feed()
    assert latest is not None
    assert any(r["ticker"] == "ANET" for r in latest["ratings"])


def test_ratings_sync_auto_endpoint(tmp_path, monkeypatch):
    analyzer_db = tmp_path / "analyzer.db"
    conn = sqlite3.connect(analyzer_db)
    conn.execute(
        """
        CREATE TABLE ticker_enrichments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            provider TEXT NOT NULL,
            data_type TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        "INSERT INTO ticker_enrichments (ticker, provider, data_type, data_json) VALUES (?, ?, ?, ?)",
        ("AEM", "zacks", "rank", json.dumps({"ticker": "AEM", "provider": "zacks", "rating_type": "rank", "score": 2})),
    )
    conn.commit()
    conn.close()

    monkeypatch.setenv("EMAIL_ANALYZER_DB", str(analyzer_db))
    resp = client.post("/api/v1/ratings/sync-auto")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["sync_details"]["synced"] is True


def test_ratings_changes_endpoint():
    resp = client.get("/api/v1/ratings/changes")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "changes" in data
    assert "count" in data
    assert isinstance(data["changes"], list)
    if data["count"] > 0:
        change = data["changes"][0]
        assert "ticker" in change
        assert "direction" in change
        assert "previous" in change
        assert "current" in change


def test_ratings_extractor_ensure_endpoint(monkeypatch):
    monkeypatch.setattr("app.ratings_extractor_bridge.is_extractor_running", lambda url: True)
    resp = client.post("/api/v1/ratings/extractor/ensure")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "running"
    assert data["already_running"] is True
    assert "research" in data["url"]

