from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_and_signal_flow():
    assert client.get("/api/v1/system/health").status_code == 200
    client.post("/api/v1/demo/scenario/reset")
    assert client.get("/api/v1/signals/CRDO").json()["data"]["score"] == 65
    client.post("/api/v1/demo/scenario/activate")
    assert client.get("/api/v1/signals/CRDO").json()["data"]["score"] == 90


def test_assistant_reports_grounding():
    response = client.post("/api/v1/assistant/ask", json={"question": "Why is CRDO ranked first?"})
    assert response.status_code == 200
    assert response.json()["data"]["generated_numbers"] is False
    assert "signal:CRDO" in response.json()["data"]["grounding"]


def test_market_stream_endpoint():
    with client.stream("GET", "/api/v1/market/stream?limit=1") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        for chunk in response.iter_raw():
            if chunk:
                assert b"data:" in chunk
                break
