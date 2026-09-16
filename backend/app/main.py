from __future__ import annotations

import asyncio
import glob
import json
import os
import random
from datetime import datetime, timezone
from uuid import uuid4

from dotenv import load_dotenv

# Load .env from project root or current working directory
_root_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
if os.path.exists(_root_env):
    load_dotenv(_root_env)
else:
    load_dotenv()

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import alerts, imports, ratings_ingest, store
from .broker import alpaca_broker
from .company_names import resolve_company_name
from .data import BASE_ALERTS, SCENARIO_ALERT, holdings_for_scenario
from .engine import assess_holding, calculate_risk
from .market_data import market_router
from .models import AskRequest, AskResponse, Holding
from .portfolio_fit import compute_fit
from .ratings import active_source, build_ticker_ratings

app = FastAPI(title="Atlas Portfolio Intelligence", version="0.1.0", docs_url="/api/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "http://127.0.0.1:4173", "http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_scenario_active = False


def envelope(data: object) -> dict:
    return {"data": data, "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), "request_id": str(uuid4())}}


# ---- Active data source: an uploaded portfolio (DB) overrides the seeded demo book. ----

def current_holdings() -> list[Holding]:
    """The holdings the dashboard serves. An uploaded portfolio (persisted in the DB)
    is the source of truth; otherwise the seeded demo book (with the scenario toggle)."""
    stored = store.latest_list("portfolio")
    if stored and stored["payload"].get("holdings"):
        return [Holding(**item) for item in stored["payload"]["holdings"]]
    return holdings_for_scenario(_scenario_active)


def _portfolio_source() -> dict:
    stored = store.latest_list("portfolio")
    if stored and stored["payload"].get("holdings"):
        payload = stored["payload"]
        source_type = payload.get("broker") or "uploaded"
        return {
            "source": source_type,
            "name": stored["name"],
            "imported_at": stored["imported_at"],
            "count": len(payload["holdings"]),
            "has_signal_inputs": bool(payload.get("has_signal_inputs")),
            "portfolio_value": payload.get("portfolio_value"),
            "cash": payload.get("cash"),
            "scenario_active": False,
        }
    return {
        "source": "seed",
        "name": None,
        "imported_at": None,
        "count": len(holdings_for_scenario(_scenario_active)),
        "has_signal_inputs": True,
        "scenario_active": _scenario_active,
    }


@app.get("/api/v1/system/health")
def health() -> dict:
    return envelope({"status": "healthy", "mode": "seeded-demo", "database": "not-required", "calculation_engine": "healthy", "data_freshness": "current"})


@app.post("/api/v1/tickers/resolve")
def resolve_tickers(payload: dict) -> dict:
    symbols = payload.get("symbols", [])
    resolved = {sym: resolve_company_name(sym) for sym in symbols}
    return envelope({"resolved": resolved})


@app.get("/api/v1/demo/state")
def demo_state() -> dict:
    holdings = current_holdings()
    uploaded = _portfolio_source()["source"] in {"uploaded", "alpaca"}
    alerts = BASE_ALERTS if uploaded else ([_scenario_alert()] + BASE_ALERTS if _scenario_active else BASE_ALERTS)
    return envelope({"scenario_active": _scenario_active and not uploaded,
                     "source": _portfolio_source(),
                     "holdings": [holding.model_dump(by_alias=True) for holding in holdings],
                     "alerts": [alert.model_dump() for alert in alerts]})


def _scenario_alert():
    return SCENARIO_ALERT


@app.post("/api/v1/demo/scenario/{action}")
def scenario(action: str) -> dict:
    global _scenario_active
    if action not in {"activate", "reset"}:
        raise HTTPException(status_code=400, detail="action must be activate or reset")
    _scenario_active = action == "activate"
    return demo_state()


@app.get("/api/v1/portfolios/demo/summary")
def portfolio_summary() -> dict:
    stored = store.latest_list("portfolio")
    if not (stored and stored["payload"].get("holdings")):
        return envelope({"portfolio_id": "demo", "base_currency": "USD", "market_value": 684320.00, "cash": 31200.00, "total_value": 715520.00, "day_pnl": 4272.00, "day_return": 0.0063, "unrealized_pnl": 81244.00, "ytd_return": 0.0884, "benchmark": {"symbol": "SPY", "ytd_return": 0.0712, "relative_return": 0.0172}, "data_quality": {"status": "current", "source": "seeded-demo", "latest_price_age_seconds": 18}})
    holdings = current_holdings()
    is_cash = lambda h: h.sector.strip().lower() == "cash"
    invest_mv = sum(h.quantity * h.price for h in holdings if not is_cash(h))
    cash = sum(h.quantity * h.price for h in holdings if is_cash(h))
    payload_cash = stored["payload"].get("cash")
    if cash == 0 and payload_cash is not None:
        cash = float(payload_cash)
    total = invest_mv + cash
    day_pnl = sum(h.quantity * h.price * (h.day_change / 100.0) for h in holdings if not is_cash(h))
    unrealized = sum(h.quantity * (h.price - h.avg_cost) for h in holdings if not is_cash(h))
    src = stored["payload"].get("broker") or "uploaded"
    return envelope({"portfolio_id": src, "base_currency": "USD",
                     "market_value": round(invest_mv, 2), "cash": round(cash, 2), "total_value": round(total, 2),
                     "day_pnl": round(day_pnl, 2), "day_return": (round(day_pnl / total, 4) if total else None),
                     "unrealized_pnl": round(unrealized, 2), "ytd_return": None,
                     "benchmark": {"symbol": "SPY", "ytd_return": None, "relative_return": None},
                     "data_quality": {"status": "current", "source": src, "name": stored["name"], "latest_price_age_seconds": None}})


@app.get("/api/v1/portfolios/demo/positions")
def positions() -> dict:
    return envelope([holding.model_dump(by_alias=True) for holding in current_holdings()])


@app.get("/api/v1/signals")
def signals() -> dict:
    assessments = [assess_holding(holding) for holding in current_holdings() if holding.symbol != "CASH"]
    return envelope([assessment.model_dump() for assessment in sorted(assessments, key=lambda item: item.score, reverse=True)])


def get_tradable_holding(symbol: str) -> Holding:
    """Resolve a path ``symbol`` to a non-CASH holding, or 404. Shared by the signal,
    ratings and portfolio-fit routes so the lookup/exclusion rule lives in one place."""
    holding = next((item for item in current_holdings() if item.symbol == symbol.upper()), None)
    if holding is None or holding.symbol == "CASH":
        raise HTTPException(status_code=404, detail="symbol not found")
    return holding


@app.get("/api/v1/signals/{symbol}", responses={404: {"description": "Symbol not tradable or not found"}})
def signal(holding: Holding = Depends(get_tradable_holding)) -> dict:
    return envelope(assess_holding(holding).model_dump())


@app.get("/api/v1/signals/{symbol}/ratings", responses={404: {"description": "Symbol not tradable or not found"}})
def ratings(holding: Holding = Depends(get_tradable_holding)) -> dict:
    return envelope(build_ticker_ratings(holding.symbol).model_dump())


@app.get("/api/v1/signals/{symbol}/portfolio-fit", responses={404: {"description": "Symbol not tradable or not found"}})
def portfolio_fit(holding: Holding = Depends(get_tradable_holding)) -> dict:
    """Portfolio-aware signal adjustment (spec section 25): the Technical / Portfolio-Fit
    / Combined triad plus the deterministic section-73 explanation, evaluated against the
    current book."""
    return envelope(compute_fit(holding, current_holdings()).model_dump())


# ---- Portfolio import (real data replaces the seed) ----

@app.post("/api/v1/portfolio/import")
async def portfolio_import(file: UploadFile = File(...)) -> dict:
    """Upload a real portfolio as CSV or Excel. Parsed holdings are persisted and become
    the source of truth across the dashboard (value, weights, signals, risk, fit, ratings)."""
    content = await file.read()
    try:
        rows = imports.read_tabular(file.filename or "", content)
        parsed = imports.parse_portfolio(rows)
    except imports.ImportError_ as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    store.save_list("portfolio", parsed, name=file.filename)
    return envelope({**_portfolio_source(), "warnings": parsed["warnings"]})


@app.post("/api/v1/portfolio/reset")
def portfolio_reset() -> dict:
    """Discard the uploaded portfolio and revert to the seeded demo book."""
    store.clear_list("portfolio")
    return envelope(_portfolio_source())


@app.get("/api/v1/portfolio/source")
def portfolio_source() -> dict:
    return envelope(_portfolio_source())


# ---- Watchlist (new; also uploaded from CSV/Excel) ----

def _watchlist_payload() -> dict:
    stored = store.latest_list("watchlist")
    if stored and stored["payload"].get("items"):
        payload = stored["payload"]
        return {"source": "uploaded", "name": stored["name"], "imported_at": stored["imported_at"],
                "items": payload["items"], "count": len(payload["items"])}
    return {"source": "empty", "name": None, "imported_at": None, "items": [], "count": 0}


@app.get("/api/v1/watchlist")
def watchlist() -> dict:
    return envelope(_watchlist_payload())


@app.post("/api/v1/watchlist/import")
async def watchlist_import(file: UploadFile = File(...)) -> dict:
    """Upload a real watchlist as CSV or Excel (symbol required; name/sector/note optional)."""
    content = await file.read()
    try:
        rows = imports.read_tabular(file.filename or "", content)
        parsed = imports.parse_watchlist(rows)
    except imports.ImportError_ as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    store.save_list("watchlist", parsed, name=file.filename)
    payload = _watchlist_payload()
    payload["warnings"] = parsed["warnings"]
    return envelope(payload)


@app.post("/api/v1/watchlist/reset")
def watchlist_reset() -> dict:
    store.clear_list("watchlist")
    return envelope(_watchlist_payload())


def _ratings_status_payload() -> dict:
    raw_map, as_of, source = active_source()
    freshness = store.evaluate_freshness(as_of, datetime.now(timezone.utc))
    return {
        "source": source,  # "db" (imported run) | "feed" (file) | "seed" (sample)
        "tickers": len(raw_map),
        "extractor_url": os.environ.get("ATLAS_EXTRACTOR_URL", "http://127.0.0.1:8000"),
        **freshness,
    }


@app.get("/api/v1/ratings/status")
def ratings_status() -> dict:
    """Freshness of the ratings the dashboard is serving: last extraction time, age,
    and whether it is stale (older than the 3-day threshold)."""
    return envelope(_ratings_status_payload())


@app.post("/api/v1/ratings/import")
def ratings_import() -> dict:
    """Import the newest extractor output into the DB as a run (BL-004). Scans the
    JSON files matched by ``ATLAS_EXTRACTOR_GLOB``, maps their rating snapshots, and
    stores them stamped with the current time."""
    pattern = os.environ.get("ATLAS_EXTRACTOR_GLOB")
    if not pattern:
        raise HTTPException(status_code=400, detail="ATLAS_EXTRACTOR_GLOB is not configured")
    snapshots: list[dict] = []
    files = 0
    for path in glob.glob(pattern, recursive=True):
        try:
            with open(path, encoding="utf-8-sig") as handle:
                snapshots.extend(ratings_ingest.extract_snapshots(json.load(handle)))
            files += 1
        except (OSError, ValueError):
            continue
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    feed = ratings_ingest.snapshots_to_feed(snapshots, now)
    if not feed["ratings"]:
        raise HTTPException(status_code=422, detail="no ratings found in extractor output")
    store.save_feed(feed, imported_at=now)
    payload = _ratings_status_payload()
    payload["imported_files"] = files
    payload["imported_rows"] = len(feed["ratings"])
    return envelope(payload)


@app.post("/api/v1/ratings/poll")
def ratings_poll(url: str | None = None) -> dict:
    """Poll an external HTTP extractor URL for fresh rating snapshots."""
    target_url = url or os.environ.get("ATLAS_EXTRACTOR_URL", "http://127.0.0.1:8000/api/v1/ratings")
    try:
        snapshots = ratings_ingest.fetch_remote_feed(target_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to poll extractor at {target_url}: {exc}")
    if not snapshots:
        raise HTTPException(status_code=422, detail="No snapshots returned from extractor")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    feed = ratings_ingest.snapshots_to_feed(snapshots, now)
    store.save_feed(feed, imported_at=now)
    payload = _ratings_status_payload()
    payload["imported_rows"] = len(feed["ratings"])
    payload["polled_url"] = target_url
    return envelope(payload)


@app.get("/api/v1/alerts")
def alerts_get() -> dict:
    uploaded = _portfolio_source()["source"] == "uploaded"
    values = BASE_ALERTS if uploaded else (([_scenario_alert()] + BASE_ALERTS) if _scenario_active else BASE_ALERTS)
    return envelope([alert.model_dump() for alert in values])


@app.post("/api/v1/alerts/test")
def alerts_test(webhook_url: str | None = None) -> dict:
    """Test dispatching a sample alert payload to a webhook URL."""
    sample = BASE_ALERTS[1]  # Sector concentration warning
    res = alerts.dispatch_alert(sample, webhook_url=webhook_url)
    return envelope(res)


@app.get("/api/browser-tasks/next")
def browser_tasks_next() -> dict:
    return {"status": "ok", "tasks": []}


@app.post("/api/v1/alerts/dispatch")
def alerts_dispatch(webhook_url: str | None = None) -> dict:
    """Dispatch all currently active triggered alerts to configured webhooks."""
    uploaded = _portfolio_source()["source"] == "uploaded"
    active_alerts = BASE_ALERTS if uploaded else (([_scenario_alert()] + BASE_ALERTS) if _scenario_active else BASE_ALERTS)
    triggered = [a for a in active_alerts if a.status == "TRIGGERED"]
    results = [alerts.dispatch_alert(a, webhook_url=webhook_url) for a in triggered]
    return envelope({"triggered_count": len(triggered), "dispatches": results})


@app.get("/api/v1/analytics/risk")
def risk() -> dict:
    return envelope(calculate_risk(current_holdings()).model_dump())


@app.post("/api/v1/assistant/ask", response_model=dict)
def ask(request: AskRequest) -> dict:
    question = request.question.lower()
    holdings = current_holdings()
    risk_summary = calculate_risk(holdings)
    ranked = sorted(((holding, assess_holding(holding)) for holding in holdings if holding.symbol != "CASH"), key=lambda pair: pair[1].score, reverse=True)
    mentioned = next((pair for pair in ranked if pair[0].symbol.lower() in question), None)
    if mentioned:
        holding, assessment = mentioned
        answer = f"{holding.symbol} is {assessment.state.value.lower()} at {assessment.score}/100. " + ". ".join(assessment.facts[:3]) + f". Its portfolio weight is {holding.weight:.1f}%."
        grounding = [f"signal:{holding.symbol}", "model:default_swing_v1", "portfolio:demo"]
    elif "risk" in question or "concentration" in question:
        answer = f"{risk_summary.largest_sector} is the largest sector exposure at {risk_summary.sector_weight:.1f}%. The largest position is {risk_summary.largest_position:.1f}% and the top five represent {risk_summary.top_five:.1f}%."
        grounding = ["analytics:concentration", "portfolio:demo"]
    elif "signal" in question or "attention" in question:
        holding, assessment = ranked[0]
        answer = f"{holding.symbol} needs the most attention at {assessment.score}/100 ({assessment.state.value}). " + ". ".join(assessment.facts[:3]) + "."
        grounding = [f"signal:{holding.symbol}", "model:default_swing_v1"]
    else:
        answer = "I can explain current signals, material changes, portfolio concentration, and the provenance of each displayed metric."
        grounding = ["capabilities:demo"]
    response = AskResponse(answer=answer, grounding=grounding)
    return envelope(response.model_dump())


# ---- Real-time Market Data & Broker Integration (§13, §14, §97) ----

@app.get("/api/v1/market/status")
async def market_status() -> dict:
    """Return connectivity status and active provider chain (§14)."""
    info = await market_router.get_active_provider_info()
    return envelope(info)


@app.get("/api/v1/market/quote/{symbol}")
async def market_quote(symbol: str) -> dict:
    """Fetch live quote for a single symbol with fallback (§13)."""
    quote = await market_router.get_quote(symbol)
    if not quote:
        raise HTTPException(status_code=404, detail=f"Quote not available for {symbol}")
    return envelope(quote.model_dump(by_alias=True))


@app.post("/api/v1/market/quotes")
async def market_quotes(payload: dict) -> dict:
    """Fetch live quotes for a batch of symbols (§13)."""
    symbols = payload.get("symbols", [])
    quotes = await market_router.get_quotes(symbols)
    return envelope({k: v.model_dump(by_alias=True) for k, v in quotes.items()})


@app.get("/api/v1/broker/alpaca/status")
async def broker_alpaca_status() -> dict:
    """Return Alpaca broker account status and connection health (§97)."""
    status = await alpaca_broker.get_status()
    return envelope(status)


@app.post("/api/v1/broker/alpaca/sync")
async def broker_alpaca_sync() -> dict:
    """Read-only synchronization of Alpaca positions and balances (§97)."""
    try:
        res = await alpaca_broker.sync_positions()
        return envelope(res)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/v1/market/stream")
async def market_stream(limit: int | None = None) -> StreamingResponse:
    """Server-Sent Events (SSE) endpoint providing real-time market price updates (§14).
    Uses Alpaca or Yahoo Finance live quotes when available, with graceful simulation fallback."""
    async def event_generator():
        count = 0
        while True:
            if limit is not None and count >= limit:
                break
            holdings = current_holdings()
            symbols = [h.symbol for h in holdings if h.symbol != "CASH"]
            if symbols:
                chosen = random.sample(symbols, min(4, len(symbols)))
                ticks = []
                try:
                    live_quotes = await market_router.get_quotes(chosen)
                except Exception:
                    live_quotes = {}

                for sym in chosen:
                    q = live_quotes.get(sym)
                    if q:
                        ticks.append({
                            "symbol": sym,
                            "price": q.price,
                            "change_pct": q.day_change_pct if q.day_change_pct is not None else 0.0,
                            "bid": q.bid,
                            "ask": q.ask,
                            "provider": q.provider,
                        })
                    else:
                        h = next((item for item in holdings if item.symbol == sym), None)
                        base_price = h.price if h else 100.0
                        pct = random.uniform(-0.003, 0.003)
                        new_p = round(base_price * (1.0 + pct), 2)
                        ticks.append({
                            "symbol": sym,
                            "price": new_p,
                            "change_pct": round(pct * 100, 3),
                            "provider": "Simulation",
                        })

                data = json.dumps({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "ticks": ticks
                })
                yield f"data: {data}\n\n"
            count += 1
            if limit is not None and count >= limit:
                break
            await asyncio.sleep(2.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

