import pytest
from app import report_service
from app.models import Holding
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_generate_weekly_performance_pdf_bytes():
    mock_summary = {
        "total_value": 750000.0,
        "day_pnl": 3500.0,
        "day_return": 0.0047,
        "unrealized_pnl": 85000.0,
        "cash": 45000.0,
    }
    mock_holdings = [
        Holding(
            symbol="NVDA",
            name="NVIDIA Corporation",
            quantity=100.0,
            price=120.0,
            avgCost=100.0,
            weight=0.5,
            dayChange=2.5,
            aboveSma50=True,
            aboveSma200=True,
            rsi=62.0,
            sector="Technology",
        ),
        Holding(
            symbol="PLTR",
            name="Palantir Technologies",
            quantity=500.0,
            price=35.0,
            avgCost=25.0,
            weight=0.3,
            dayChange=-1.0,
            aboveSma50=True,
            aboveSma200=False,
            rsi=48.0,
            sector="Technology",
        ),
        Holding(
            symbol="CASH",
            name="USD Cash",
            quantity=45000.0,
            price=1.0,
            avgCost=1.0,
            weight=0.2,
            sector="Cash",
        ),
    ]
    mock_history = [
        {
            "id": "hist-1",
            "symbol": "PLTR",
            "title": "Profit Target Reached",
            "category": "PROFIT_TARGET",
            "trigger_value": 36.0,
            "action_taken": "TRIMMED",
            "alpha_saved_or_locked": 1250.0,
            "triggered_at": "2026-09-20T14:30:00Z",
        }
    ]

    pdf_bytes = report_service.generate_weekly_performance_pdf(
        summary_data=mock_summary,
        holdings=mock_holdings,
        history_entries=mock_history,
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # Check valid PDF signature
    assert pdf_bytes.startswith(b"%PDF-")


def test_reports_weekly_pdf_endpoint():
    res = client.get("/api/v1/reports/weekly-pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=Atlas_Portfolio_Defense_Report.pdf" in res.headers.get("content-disposition", "")
    assert res.content.startswith(b"%PDF-")


def test_market_intraday_triggers_endpoint():
    res = client.get("/api/v1/market/intraday-triggers")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert isinstance(data["data"], list)
