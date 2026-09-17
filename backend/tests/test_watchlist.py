import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test.db")
    monkeypatch.setenv("ATLAS_DB", test_db)
    yield


def test_watchlist_default_returns_curated_candidates():
    client = TestClient(app)
    resp = client.get("/api/v1/watchlist")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["source"] == "default"
    assert data["count"] >= 5
    symbols = [it["symbol"] for it in data["items"]]
    assert "NVDA" in symbols
    assert "CRM" in symbols


def test_watchlist_add_item():
    client = TestClient(app)
    resp = client.post("/api/v1/watchlist/items", json={"symbol": "PLTR", "note": "Enterprise momentum"})
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["item"]["symbol"] == "PLTR"
    assert payload["item"]["name"] == "Palantir Technologies Inc."
    assert payload["item"]["note"] == "Enterprise momentum"

    # Verify retrieval
    get_resp = client.get("/api/v1/watchlist")
    items = get_resp.json()["data"]["items"]
    symbols = [it["symbol"] for it in items]
    assert "PLTR" in symbols


def test_watchlist_remove_item():
    client = TestClient(app)
    # Add then remove
    client.post("/api/v1/watchlist/items", json={"symbol": "AMD", "note": "Chip recovery"})
    rem_resp = client.delete("/api/v1/watchlist/items/AMD")
    assert rem_resp.status_code == 200
    assert rem_resp.json()["data"]["removed"] is True

    # Ensure not present
    get_resp = client.get("/api/v1/watchlist")
    items = get_resp.json()["data"]["items"]
    assert "AMD" not in [it["symbol"] for it in items]


def test_watchlist_reset():
    client = TestClient(app)
    client.post("/api/v1/watchlist/items", json={"symbol": "TSLA", "note": "EV"})
    reset_resp = client.post("/api/v1/watchlist/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["data"]["source"] == "default"
