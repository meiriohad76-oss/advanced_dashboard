from fastapi.testclient import TestClient
from app.main import app
from app.scheduler import sync_runner

client = TestClient(app)


def test_scheduler_status_and_toggle():
    res = client.get("/api/v1/scheduler/status")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "enabled" in data
    assert "interval_seconds" in data
    assert "runs_completed" in data

    # Toggle off
    toggle_res = client.post("/api/v1/scheduler/toggle", json={"enabled": False})
    assert toggle_res.status_code == 200
    assert toggle_res.json()["data"]["enabled"] is False

    # Toggle back on
    toggle_on = client.post("/api/v1/scheduler/toggle", json={"enabled": True})
    assert toggle_on.status_code == 200
    assert toggle_on.json()["data"]["enabled"] is True


def test_scheduler_run_now():
    res = client.post("/api/v1/scheduler/run-now")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "synced" in data
    assert "session" in data
