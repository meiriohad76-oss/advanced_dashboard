import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app import ratings, store
from app.main import app

client = TestClient(app)
NOW = datetime(2026, 9, 11, 12, 0, 0, tzinfo=timezone.utc)


def test_freshness_flags_data_older_than_three_days():
    fresh = store.evaluate_freshness((NOW - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), NOW)
    assert fresh["stale"] is False and fresh["age_days"] == 1.0 and fresh["threshold_days"] == 3

    stale = store.evaluate_freshness((NOW - timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%SZ"), NOW)
    assert stale["stale"] is True and stale["age_days"] == 4.0

    unknown = store.evaluate_freshness("", NOW)
    assert unknown["stale"] is True and unknown["age_days"] is None


def test_save_and_read_latest_run(tmp_path):
    db = str(tmp_path / "atlas.db")
    assert store.latest_feed(path=db) is None  # no runs yet, no file created
    store.save_feed({"as_of": "2026-09-10T00:00:00Z", "ratings": [{"ticker": "AEM", "source": "zacks", "value": 2}]}, path=db)
    store.save_feed({"as_of": "2026-09-11T00:00:00Z", "ratings": [{"ticker": "AEM", "source": "zacks", "value": 1}]}, path=db)
    latest = store.latest_feed(path=db)
    assert latest["as_of"] == "2026-09-11T00:00:00Z"  # newest run wins


def test_status_and_import_endpoints(tmp_path, monkeypatch):
    db = str(tmp_path / "atlas.db")
    monkeypatch.setenv("ATLAS_DB", db)
    monkeypatch.delenv("ATLAS_RATINGS_FEED", raising=False)

    # With no run imported, status falls back to the seed sample.
    status = client.get("/api/v1/ratings/status").json()["data"]
    assert status["source"] == "seed" and status["threshold_days"] == 3
    assert status["extractor_url"].startswith("http")

    # A real-shaped extractor output file to import.
    extractor_dir = tmp_path / "extractor"
    extractor_dir.mkdir()
    (extractor_dir / "aem.json").write_text(json.dumps({
        "parsed_seeking_alpha_snapshots": [
            {"ticker": "AEM", "provider": "seeking_alpha", "rating_type": "quant", "rating": "Hold", "score": 2.82},
        ],
        "parsed_zacks_snapshots": [
            {"ticker": "AEM", "provider": "zacks", "rating_type": "rank", "rating": "Buy", "score": 2},
        ],
    }), encoding="utf-8")
    monkeypatch.setenv("ATLAS_EXTRACTOR_GLOB", str(extractor_dir / "*.json"))

    imported = client.post("/api/v1/ratings/import").json()["data"]
    assert imported["source"] == "db" and imported["stale"] is False
    assert imported["imported_rows"] == 2 and imported["tickers"] == len(ratings.RAW_RATINGS)

    # Endpoints still serve fine after an import (symbols not in the run render empty).
    assert client.get("/api/v1/signals/CRDO/ratings").status_code == 200
    assert client.get("/api/v1/signals/NVDA/ratings").status_code == 200


def test_import_requires_configuration(monkeypatch):
    monkeypatch.delenv("ATLAS_EXTRACTOR_GLOB", raising=False)
    assert client.post("/api/v1/ratings/import").status_code == 400
