import pytest
from app import store
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_multi_portfolio_lifecycle(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test_multi.db")
    monkeypatch.setenv("ATLAS_DB", db_path)

    p1 = {
        "holdings": [
            {"symbol": "AAPL", "name": "Apple", "quantity": 10, "price": 150.0, "weight": 50.0, "sector": "Technology"},
            {"symbol": "MSFT", "name": "Microsoft", "quantity": 5, "price": 300.0, "weight": 50.0, "sector": "Technology"}
        ]
    }
    p2 = {
        "holdings": [
            {"symbol": "LMT", "name": "Lockheed Martin", "quantity": 20, "price": 450.0, "weight": 100.0, "sector": "Aerospace & Defense"}
        ]
    }

    # 1. Save two portfolios
    store.save_list("portfolio", p1, name="Tech Portfolio", path=db_path, is_active=False)
    store.save_list("portfolio", p2, name="Defense Portfolio", path=db_path, is_active=True)

    # 2. List saved portfolios via endpoint
    res = client.get("/api/v1/portfolios/saved")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total_saved"] == 2
    portfolios = data["portfolios"]
    assert len(portfolios) == 2
    
    defense = next(p for p in portfolios if p["name"] == "Defense Portfolio")
    tech = next(p for p in portfolios if p["name"] == "Tech Portfolio")
    assert defense["is_active"] is True
    assert tech["is_active"] is False
    assert defense["count"] == 1
    assert tech["count"] == 2
    assert defense["total_value"] == 9000.0
    assert tech["total_value"] == 3000.0

    # 3. Rename portfolio
    res_rename = client.patch(f"/api/v1/portfolios/saved/{tech['id']}", json={"name": "Big Tech Growth"})
    assert res_rename.status_code == 200
    assert res_rename.json()["data"]["name"] == "Big Tech Growth"

    # 4. Activate the tech portfolio
    res_act = client.post(f"/api/v1/portfolios/saved/{tech['id']}/activate")
    assert res_act.status_code == 200
    state = res_act.json()["data"]
    assert state["source"]["name"] == "Big Tech Growth"
    assert state["source"]["id"] == tech["id"]

    # 5. Delete portfolio
    res_del = client.delete(f"/api/v1/portfolios/saved/{defense['id']}")
    assert res_del.status_code == 200
    
    res_list_after = client.get("/api/v1/portfolios/saved")
    assert res_list_after.json()["data"]["total_saved"] == 1
