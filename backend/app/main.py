from __future__ import annotations

import asyncio
import glob
import io
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

from . import alert_recommendations, alerts, analytics_service, backtest_service, bars_service, briefing_service, catalysts_service, imports, intraday_service, notifications, ratings_ingest, report_service, store
from .broker.alpaca_broker import alpaca_broker, calculate_portfolio_rebalance
from .company_names import resolve_company_name
from .sectors import resolve_sector
from .data import BASE_ALERTS, SCENARIO_ALERT, holdings_for_scenario
from .engine import assess_holding, calculate_risk
from .live_enricher import enrich_holdings_with_live_market, generate_live_alerts
from .market_data import market_router
from .models import AskRequest, AskResponse, Holding
from .portfolio_fit import compute_fit
from .ratings import active_source, build_ticker_ratings
from .ratings_extractor_bridge import (
    ensure_extractor_running,
    extract_rating_shifts,
    is_extractor_running,
    sync_ratings_from_extractor,
)
from .scheduler import sync_runner
from . import bars_service

app = FastAPI(title="Atlas Portfolio Intelligence", version="0.1.0", docs_url="/api/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "http://127.0.0.1:4173", "http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_scenario_active = False
_live_enriched_holdings: list[Holding] | None = None
_live_enriched_meta: dict[str, Any] | None = None


async def initialize_operational_state():
    """Ensure Atlas boots directly into Live Operational Mode:
    1. Load unified portfolio Excel if DB portfolio is empty
    2. Auto-sync Seeking Alpha, Zacks, and Investing.com ranks from email article analyzer
    3. Enrich holdings with live market quotes and technical indicators
    """
    global _live_enriched_holdings, _live_enriched_meta
    # 1. Load portfolio if none in DB
    stored = store.latest_list("portfolio")
    if not stored or not stored.get("payload", {}).get("holdings"):
        possible_excel_paths = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "unified portfolio 11082026.xlsx")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "unified portfolio 11082026.xlsx")),
            "unified portfolio 11082026.xlsx",
        ]
        for p in possible_excel_paths:
            if os.path.exists(p) and os.path.isfile(p):
                try:
                    with open(p, "rb") as f:
                        content = f.read()
                    rows = imports.read_tabular(os.path.basename(p), content)
                    parsed = imports.parse_portfolio(rows)
                    store.save_list("portfolio", parsed, name=os.path.basename(p))
                    break
                except Exception:
                    pass

    # 2. Sync ratings from extractor database
    try:
        sync_ratings_from_extractor()
    except Exception:
        pass

    # 3. Enrich with live market data on startup
    try:
        base = current_holdings()
        if base:
            enriched, meta = await enrich_holdings_with_live_market(base, force_refresh=False)
            _live_enriched_holdings = enriched
            _live_enriched_meta = meta
            stored = store.latest_list("portfolio")
            if stored and stored.get("payload", {}).get("holdings"):
                p_data = dict(stored["payload"])
                p_data["holdings"] = [h.model_dump(by_alias=True) for h in enriched]
                p_data["has_signal_inputs"] = True
                p_data["refreshed_at"] = meta.get("timestamp")
                store.update_latest_list("portfolio", p_data)
    except Exception:
        pass


@app.on_event("startup")
async def on_startup():
    await initialize_operational_state()
    sync_runner.start()


def envelope(data: object) -> dict:
    return {"data": data, "meta": {"timestamp": datetime.now(timezone.utc).isoformat(), "request_id": str(uuid4())}}


# ---- Active data source: live quotes take precedence; an uploaded portfolio (DB) overrides the seeded demo book. ----

def current_holdings() -> list[Holding]:
    """The holdings the dashboard serves. If live enriched holdings are available,
    they take precedence. Otherwise an active uploaded portfolio (persisted in the DB),
    otherwise the seeded demo book (with the scenario toggle)."""
    if _live_enriched_holdings is not None:
        return _live_enriched_holdings
    stored = store.latest_list("portfolio")
    if stored and stored.get("is_active") and stored["payload"].get("holdings"):
        return [Holding(**item) for item in stored["payload"]["holdings"]]
    return holdings_for_scenario(_scenario_active)


def _portfolio_source() -> dict:
    stored = store.latest_list("portfolio")
    refreshed = _live_enriched_meta.get("timestamp") if _live_enriched_meta else None
    if stored and stored.get("is_active") and stored.get("payload", {}).get("holdings"):
        payload = stored["payload"]
        source_type = payload.get("broker") or "uploaded"
        last_ref = refreshed or payload.get("refreshed_at")
        return {
            "id": stored.get("id"),
            "source": source_type,
            "mode": "live",
            "name": stored.get("name") or "Live Portfolio",
            "imported_at": stored.get("imported_at"),
            "last_refreshed": last_ref,
            "provider": _live_enriched_meta.get("provider") if _live_enriched_meta else "Live Market",
            "count": len(payload["holdings"]),
            "has_signal_inputs": bool(payload.get("has_signal_inputs", True)),
            "portfolio_value": payload.get("portfolio_value"),
            "cash": payload.get("cash"),
            "scenario_active": False,
        }
    return {
        "id": None,
        "source": "live",
        "mode": "live",
        "name": "Live Strategic Portfolio",
        "imported_at": None,
        "last_refreshed": refreshed,
        "provider": _live_enriched_meta.get("provider") if _live_enriched_meta else "Live Market",
        "count": len(holdings_for_scenario(_scenario_active)),
        "has_signal_inputs": True,
        "scenario_active": _scenario_active,
    }


@app.get("/api/v1/system/health")
async def health() -> dict:
    active_info = await market_router.get_active_provider_info()
    return envelope({
        "status": "healthy",
        "mode": "live-operational",
        "market_data": active_info,
        "database": "connected" if store.latest_list("portfolio") else "ready",
        "calculation_engine": "healthy",
        "data_freshness": "live" if _live_enriched_meta else "current",
        "last_refreshed": _live_enriched_meta.get("timestamp") if _live_enriched_meta else None,
    })


@app.post("/api/v1/tickers/resolve")
def resolve_tickers(payload: dict) -> dict:
    symbols = payload.get("symbols", [])
    resolved = {sym: resolve_company_name(sym) for sym in symbols}
    return envelope({"resolved": resolved})


@app.get("/api/v1/demo/state")
def demo_state() -> dict:
    holdings = current_holdings()
    uploaded = _portfolio_source()["source"] in {"uploaded", "alpaca"}
    if _live_enriched_holdings is not None:
        alerts = generate_live_alerts(_live_enriched_holdings)
    elif uploaded:
        alerts = generate_live_alerts(holdings)
    else:
        alerts = ([_scenario_alert()] + BASE_ALERTS) if _scenario_active else BASE_ALERTS
    return envelope({"scenario_active": _scenario_active and not uploaded,
                     "source": _portfolio_source(),
                     "holdings": [holding.model_dump(by_alias=True) for holding in holdings],
                     "alerts": [alert.model_dump() for alert in alerts]})


def _scenario_alert():
    return SCENARIO_ALERT


@app.post("/api/v1/demo/scenario/{action}")
def scenario(action: str) -> dict:
    global _scenario_active, _live_enriched_holdings, _live_enriched_meta
    if action not in {"activate", "reset"}:
        raise HTTPException(status_code=400, detail="action must be activate or reset")
    _scenario_active = action == "activate"
    _live_enriched_holdings = None
    _live_enriched_meta = None
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
    global _live_enriched_holdings, _live_enriched_meta
    content = await file.read()
    try:
        rows = imports.read_tabular(file.filename or "", content)
        parsed = imports.parse_portfolio(rows)
    except imports.ImportError_ as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Auto-enrich with live market quotes & technical indicators
    try:
        raw_holdings = [Holding(**h) for h in parsed["holdings"]]
        enriched, meta = await enrich_holdings_with_live_market(raw_holdings, force_refresh=True)
        parsed["holdings"] = [h.model_dump(by_alias=True) for h in enriched]
        parsed["has_signal_inputs"] = True
        parsed["refreshed_at"] = meta.get("timestamp")
        _live_enriched_holdings = enriched
        _live_enriched_meta = meta
    except Exception:
        pass

    store.save_list("portfolio", parsed, name=file.filename)
    return envelope({**_portfolio_source(), "warnings": parsed["warnings"]})


@app.post("/api/v1/portfolio/reset")
def portfolio_reset() -> dict:
    """Discard active portfolio and revert to the seeded demo book."""
    global _live_enriched_holdings, _live_enriched_meta
    _live_enriched_holdings = None
    _live_enriched_meta = None
    store.deactivate_all("portfolio")
    return envelope(_portfolio_source())


@app.get("/api/v1/portfolio/source")
def portfolio_source() -> dict:
    return envelope(_portfolio_source())


@app.get("/api/v1/portfolios/saved")
def portfolios_saved_list() -> dict:
    """List all saved portfolios with summary info and active status."""
    portfolios = store.list_saved_portfolios("portfolio")
    return envelope({
        "portfolios": portfolios,
        "total_saved": len(portfolios),
        "active_id": next((p["id"] for p in portfolios if p["is_active"]), None),
    })


@app.post("/api/v1/portfolios/saved/{portfolio_id}/activate")
async def portfolios_saved_activate(portfolio_id: int) -> dict:
    """Activate a specific saved portfolio and re-enrich market indicators."""
    global _live_enriched_holdings, _live_enriched_meta
    activated = store.activate_portfolio(portfolio_id, "portfolio")
    if not activated:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    _live_enriched_holdings = None
    _live_enriched_meta = None

    raw_holdings = [Holding(**h) for h in activated["payload"].get("holdings", [])]
    try:
        enriched, meta = await enrich_holdings_with_live_market(raw_holdings, force_refresh=False)
        activated["payload"]["holdings"] = [h.model_dump(by_alias=True) for h in enriched]
        activated["payload"]["refreshed_at"] = meta.get("timestamp")
        store.update_latest_list("portfolio", activated["payload"])
        _live_enriched_holdings = enriched
        _live_enriched_meta = meta
    except Exception:
        pass

    return demo_state()


@app.patch("/api/v1/portfolios/saved/{portfolio_id}")
def portfolios_saved_rename(portfolio_id: int, payload: dict) -> dict:
    """Rename a saved portfolio."""
    new_name = payload.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    ok = store.rename_portfolio(portfolio_id, new_name)
    if not ok:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return envelope({"id": portfolio_id, "name": new_name, "renamed": True})


@app.delete("/api/v1/portfolios/saved/{portfolio_id}")
def portfolios_saved_delete(portfolio_id: int) -> dict:
    """Delete a saved portfolio."""
    global _live_enriched_holdings, _live_enriched_meta
    ok = store.delete_portfolio(portfolio_id, "portfolio")
    if not ok:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    _live_enriched_holdings = None
    _live_enriched_meta = None
    return envelope({"deleted_id": portfolio_id, "status": "deleted"})


# ---- Watchlist (Candidate Entry Point Radar) ----

DEFAULT_WATCHLIST_CANDIDATES = [
    {"symbol": "NVDA", "name": "NVIDIA", "sector": "Semiconductors", "note": "Market leader; track pullbacks near 50 SMA"},
    {"symbol": "CRM", "name": "Salesforce", "sector": "Software", "note": "Enterprise AI agent monetization catalyst"},
    {"symbol": "CRDO", "name": "Credo Technology", "sector": "Semiconductors", "note": "High-speed optical DSP momentum"},
    {"symbol": "VRT", "name": "Vertiv Holdings", "sector": "Infrastructure", "note": "AI liquid cooling infrastructure leader"},
    {"symbol": "ANET", "name": "Arista Networks", "sector": "Infrastructure", "note": "Cloud networking breakout candidate"},
    {"symbol": "GOOGL", "name": "Alphabet", "sector": "Software", "note": "Cloud growth + Gemini enterprise adoption"},
    {"symbol": "AEM", "name": "Agnico Eagle Mines", "sector": "Metals & Mining", "note": "Gold producer hedge; strong cash flow"},
    {"symbol": "NOW", "name": "ServiceNow", "sector": "Software", "note": "Workflow automation leader"},
]


def _watchlist_payload() -> dict:
    stored = store.latest_list("watchlist")
    if stored and stored.get("payload") and stored["payload"].get("items"):
        payload = stored["payload"]
        return {"source": "uploaded", "name": stored.get("name"), "imported_at": stored.get("imported_at"),
                "items": payload["items"], "count": len(payload["items"])}
    return {"source": "default", "name": "Curated Candidates", "imported_at": None, "items": DEFAULT_WATCHLIST_CANDIDATES, "count": len(DEFAULT_WATCHLIST_CANDIDATES)}


@app.get("/api/v1/watchlist")
def watchlist() -> dict:
    return envelope(_watchlist_payload())


@app.post("/api/v1/watchlist/items")
def watchlist_add_item(payload: dict) -> dict:
    """Add or update a candidate symbol in the watchlist."""
    symbol = str(payload.get("symbol", "")).strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    name = payload.get("name") or resolve_company_name(symbol) or symbol
    sector = payload.get("sector") or resolve_sector(symbol) or "Equities"
    note = payload.get("note", "")
    item = store.add_watchlist_item({"symbol": symbol, "name": name, "sector": sector, "note": note})
    return envelope({"item": item, "watchlist": _watchlist_payload()})


@app.delete("/api/v1/watchlist/items/{symbol}")
def watchlist_remove_item(symbol: str) -> dict:
    """Remove a symbol from the active watchlist."""
    sym = symbol.strip().upper()
    # If the user is currently looking at the default list, initialize a real watchlist list excluding this symbol
    stored = store.latest_list("watchlist")
    if not stored or not stored.get("payload") or not stored["payload"].get("items"):
        filtered = [it for it in DEFAULT_WATCHLIST_CANDIDATES if it["symbol"].upper() != sym]
        store.save_list("watchlist", {"items": filtered, "source": "custom"}, name="Candidate Radar")
        return envelope({"symbol": sym, "removed": True, "watchlist": _watchlist_payload()})

    removed = store.remove_watchlist_item(sym)
    return envelope({"symbol": sym, "removed": removed, "watchlist": _watchlist_payload()})


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
    base_extractor_url = os.environ.get("ATLAS_EXTRACTOR_URL", "http://127.0.0.1:8000")
    research_url = f"{base_extractor_url.rstrip('/')}/research"
    return {
        "source": source,  # "db" (imported run) | "feed" (file) | "seed" (sample)
        "tickers": len(raw_map),
        "extractor_url": research_url,
        "extractor_running": is_extractor_running(base_extractor_url),
        **freshness,
    }


@app.post("/api/v1/ratings/extractor/ensure")
def ratings_extractor_ensure() -> dict:
    """Ensure the email article analyzer extractor process is running. Spawns it if stopped."""
    base_url = os.environ.get("ATLAS_EXTRACTOR_URL", "http://127.0.0.1:8000")
    res = ensure_extractor_running(base_url)
    return envelope(res)


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
    holdings = _live_enriched_holdings if _live_enriched_holdings is not None else current_holdings()
    uploaded = _portfolio_source()["source"] in {"uploaded", "alpaca"}
    if uploaded or _live_enriched_holdings is not None:
        values = generate_live_alerts(holdings)
    else:
        values = ([_scenario_alert()] + BASE_ALERTS) if _scenario_active else BASE_ALERTS
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
    holdings = _live_enriched_holdings if _live_enriched_holdings is not None else current_holdings()
    uploaded = _portfolio_source()["source"] in {"uploaded", "alpaca"}
    if uploaded or _live_enriched_holdings is not None:
        active_alerts = generate_live_alerts(holdings)
    else:
        active_alerts = ([_scenario_alert()] + BASE_ALERTS) if _scenario_active else BASE_ALERTS
    triggered = [a for a in active_alerts if a.status == "TRIGGERED"]
    results = [alerts.dispatch_alert(a, webhook_url=webhook_url) for a in triggered]
    return envelope({"triggered_count": len(triggered), "dispatches": results})


@app.get("/api/v1/alerts/recommendations")
async def alerts_recommendations(symbol: str | None = None) -> dict:
    """Generate and return smart alert recommendations for portfolio holdings and watchlist tickers."""
    holdings = _live_enriched_holdings if _live_enriched_holdings is not None else current_holdings()
    wl = _watchlist_payload().get("items", [])
    
    # Enrich watchlist candidates with quotes if missing price
    wl_symbols = [str(w.get("symbol", "")).upper() for w in wl if w.get("symbol")]
    quotes = {}
    if wl_symbols:
        try:
            quotes = await market_router.get_quotes(wl_symbols)
        except Exception:
            quotes = {}

    enriched_wl = []
    for w in wl:
        sym = str(w.get("symbol", "")).upper()
        item = dict(w)
        q = quotes.get(sym)
        if q and getattr(q, "price", 0) > 0:
            item["price"] = q.price
            if getattr(q, "change_pct", None) is not None:
                item["change_pct"] = q.change_pct
        enriched_wl.append(item)

    statuses = store.get_alert_recommendation_statuses()
    recs = alert_recommendations.generate_all_recommendations(holdings, enriched_wl, existing_statuses=statuses)
    if symbol:
        recs = [r for r in recs if r.symbol.upper() == symbol.upper()]
    return envelope([r.model_dump() for r in recs])


@app.post("/api/v1/alerts/recommendations/{rec_id}/action")
def alerts_recommendations_action(rec_id: str, payload: dict) -> dict:
    """Acknowledge, decline, or customize/change a recommended alert."""
    action = str(payload.get("action", "")).lower()
    if action not in {"acknowledge", "decline", "change"}:
        raise HTTPException(status_code=400, detail="Action must be 'acknowledge', 'decline', or 'change'")

    status = "ACKNOWLEDGED" if action in {"acknowledge", "change"} else "DECLINED"
    symbol = str(payload.get("symbol", "")).upper()
    category = str(payload.get("category", "PROFIT_TARGET"))

    custom_alert = payload.get("custom_alert")
    if action in {"acknowledge", "change"} and custom_alert:
        store.save_user_alert(custom_alert)

    store.save_alert_recommendation_action(
        rec_id=rec_id,
        symbol=symbol,
        category=category,
        status=status,
        payload=payload,
    )
    return envelope({"id": rec_id, "status": status, "action": action})


@app.get("/api/v1/alerts/user-alerts")
def user_alerts_get() -> dict:
    """Get active armed user alerts persisted in the backend database."""
    return envelope(store.get_user_alerts())


@app.post("/api/v1/alerts/user-alerts")
def user_alerts_save(payload: dict) -> dict:
    """Save or update an armed user alert in the backend database."""
    saved = store.save_user_alert(payload)
    return envelope(saved)


@app.delete("/api/v1/alerts/user-alerts/{alert_id}")
def user_alerts_delete(alert_id: str) -> dict:
    """Delete an armed user alert from the backend database."""
    deleted = store.delete_user_alert(alert_id)
    return envelope({"id": alert_id, "deleted": deleted})


@app.get("/api/v1/alerts/history")
def alerts_history_get(limit: int = 100) -> dict:
    """Retrieve audit history of triggered alerts and recorded actions."""
    return envelope(store.get_alert_history(limit=limit))


@app.post("/api/v1/alerts/history")
def alerts_history_save(payload: dict) -> dict:
    """Record a triggered alert event into persistent history."""
    saved = store.save_alert_history_entry(payload)
    return envelope(saved)


@app.post("/api/v1/alerts/history/{entry_id}/action")
def alerts_history_action(entry_id: str, payload: dict) -> dict:
    """Record user action taken on a triggered alert (e.g. TRIMMED, STOPPED_OUT_CASH, ACKNOWLEDGED, IGNORED)."""
    action_taken = str(payload.get("action", payload.get("action_taken", "ACKNOWLEDGED"))).upper()
    notes = payload.get("notes")
    alpha = payload.get("alpha_saved_or_locked")
    alpha_val = float(alpha) if alpha is not None else None
    res = store.update_alert_history_action(
        entry_id=entry_id,
        action_taken=action_taken,
        notes=notes,
        alpha_saved_or_locked=alpha_val,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Alert history entry not found")
    return envelope(res)


@app.delete("/api/v1/alerts/history/{entry_id}")
def alerts_history_delete(entry_id: str) -> dict:
    """Delete an alert history item."""
    deleted = store.delete_alert_history_entry(entry_id)
    return envelope({"id": entry_id, "deleted": deleted})


@app.delete("/api/v1/alerts/history")
def alerts_history_clear() -> dict:
    """Clear all alert history."""
    cleared = store.clear_alert_history()
    return envelope({"cleared": cleared})



@app.get("/api/v1/notifications/settings")
def notifications_get_settings() -> dict:
    """Get active Telegram and webhook notification configurations."""
    return envelope(notifications.get_settings())


@app.post("/api/v1/notifications/settings")
def notifications_save_settings(payload: dict) -> dict:
    """Save updated Telegram and webhook notification settings."""
    updated = notifications.save_settings(payload)
    return envelope(updated)


@app.post("/api/v1/notifications/test")
async def notifications_test() -> dict:
    """Test connectivity for enabled notification channels (Telegram / Webhook)."""
    res = await notifications.test_notifications()
    return envelope(res)


@app.post("/api/v1/notifications/briefing/test")
async def notifications_briefing_test() -> dict:
    """Trigger on-demand pre-market daily briefing dispatch to Telegram for testing."""
    holdings_list = current_holdings()
    statuses = store.get_alert_recommendation_statuses()
    recs = alert_recommendations.generate_all_recommendations(holdings_list, existing_statuses=statuses)
    recs_data = [r.model_dump() if hasattr(r, "model_dump") else r.dict() for r in recs]
    try:
        shifts = extract_rating_shifts(limit=5)
    except Exception:
        shifts = []
    res = await notifications.send_telegram_premarket_briefing(
        holdings=holdings_list,
        recommendations=recs_data,
        rating_shifts=shifts,
    )
    return envelope(res)


@app.post("/api/v1/notifications/telegram/webhook")
async def notifications_telegram_webhook(payload: dict) -> dict:
    """Receive Telegram webhook callbacks for interactive buttons (trade execution, dismiss)."""
    res = await notifications.handle_telegram_update(payload)
    return envelope(res)


@app.post("/api/v1/notifications/telegram/send-trade-prompt")
async def notifications_send_trade_prompt(payload: dict) -> dict:
    """Dispatch an interactive trade authorization card to Telegram with inline execution buttons."""
    symbol = payload.get("symbol", "").upper()
    qty = float(payload.get("qty", 10.0))
    side = payload.get("side", "buy")
    tp = float(payload.get("take_profit_price")) if payload.get("take_profit_price") else None
    sl = float(payload.get("stop_loss_price")) if payload.get("stop_loss_price") else None

    settings = notifications.get_settings()
    token = settings.get("telegram_token", "")
    chat_id = settings.get("telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(status_code=400, detail="Telegram bot token or chat ID is not configured")

    h = next((item for item in current_holdings() if item.symbol == symbol), None)
    price = h.price if h else float(payload.get("price", 100.0))
    score = assess_holding(h).score if h else 80.0

    res = await notifications.send_telegram_trade_prompt(
        token=token,
        chat_id=chat_id,
        symbol=symbol,
        qty=qty,
        side=side,
        price=price,
        score=score,
        take_profit=tp,
        stop_loss=sl,
    )
    return envelope(res)


@app.get("/api/v1/reports/weekly-pdf")
def reports_weekly_pdf() -> StreamingResponse:
    """Generate and stream the publication-grade executive weekly performance & defense report PDF."""
    summary = portfolio_summary().get("data", {})
    holdings = current_holdings()
    history = store.get_alert_history(limit=50)
    pdf_bytes = report_service.generate_weekly_performance_pdf(
        summary_data=summary,
        holdings=holdings,
        history_entries=history,
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Atlas_Portfolio_Defense_Report.pdf"},
    )


@app.post("/api/v1/reports/send-telegram")
async def reports_send_telegram() -> dict:
    """Generate the executive weekly performance PDF and send it directly to the configured Telegram chat."""
    settings = notifications.get_settings()
    token = settings.get("telegram_token", "")
    chat_id = settings.get("telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(status_code=400, detail="Telegram bot token or chat ID is not configured in Notification Settings")

    summary = portfolio_summary().get("data", {})
    holdings = current_holdings()
    history = store.get_alert_history(limit=50)
    pdf_bytes = report_service.generate_weekly_performance_pdf(
        summary_data=summary,
        holdings=holdings,
        history_entries=history,
    )

    now_date = datetime.now(timezone.utc).strftime("%b %d, %Y")
    caption = f"📊 *Atlas Executive Portfolio & Defense Report*\n📅 _{now_date}_\nTotal Value: `${summary.get('total_value', 0.0):,.2f}`"

    res = await notifications.send_telegram_document(
        token=token,
        chat_id=chat_id,
        document_bytes=pdf_bytes,
        filename=f"Atlas_Defense_Report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf",
        caption=caption,
    )
    return envelope(res)


@app.get("/api/v1/scheduler/status")
def scheduler_status() -> dict:
    """Get status of automated extractor background runner."""
    return envelope(sync_runner.get_status())


@app.post("/api/v1/scheduler/toggle")
def scheduler_toggle(payload: dict | None = None) -> dict:
    """Enable or disable automated background synchronization."""
    enabled = payload.get("enabled") if payload else None
    return envelope(sync_runner.toggle(enabled))


@app.get("/api/v1/analytics/risk")
def risk() -> dict:
    return envelope(calculate_risk(current_holdings()).model_dump())


@app.get("/api/v1/analytics/correlation")
async def analytics_correlation(max_symbols: int = 10) -> dict:
    """Calculate pairwise Pearson correlation matrix for top holdings (§14, §25)."""
    holdings_dict = [h.model_dump() for h in current_holdings()]
    data = await analytics_service.get_correlation_matrix(holdings_dict, max_symbols=max_symbols)
    return envelope(data)


@app.get("/api/v1/analytics/benchmark-comparison")
async def analytics_benchmark_comparison(range: str = "1y") -> dict:
    """Calculate cumulative return series vs SPY and QQQ benchmarks (§14, §28)."""
    holdings_dict = [h.model_dump() for h in current_holdings()]
    data = await analytics_service.get_benchmark_comparison(holdings_dict, range_str=range)
    return envelope(data)


@app.post("/api/v1/scheduler/run-now")
async def scheduler_run_now() -> dict:
    """Manually trigger an immediate background extraction, quote refresh, and alert check cycle."""
    res = await sync_runner.run_sync_cycle()
    return envelope(res)


@app.post("/api/v1/analytics/backtest")
def analytics_backtest(payload: dict | None = None) -> dict:
    """Run quantitative 5-Point Entry Criteria strategy backtest simulation (§13, §14)."""
    p = payload or {}
    symbol = str(p.get("symbol", "SPY"))
    entry_score = int(p.get("entry_score", 75))
    exit_score = int(p.get("exit_score", 50))
    lookback = str(p.get("lookback", "1y"))
    initial_capital = float(p.get("initial_capital", 100000.0))
    take_profit_pct = float(p.get("take_profit_pct", 15.0))
    stop_loss_pct = float(p.get("stop_loss_pct", 5.0))
    max_holding_days = int(p.get("max_holding_days", 20))
    rsi_min = float(p.get("rsi_min", 38.0))
    rsi_max = float(p.get("rsi_max", 58.0))
    strategy_mode = str(p.get("strategy_mode", "5point_entry"))

    holdings = current_holdings()
    res = backtest_service.run_backtest(
        holdings=holdings,
        symbol=symbol,
        entry_score=entry_score,
        exit_score=exit_score,
        lookback=lookback,
        initial_capital=initial_capital,
        take_profit_pct=take_profit_pct,
        stop_loss_pct=stop_loss_pct,
        max_holding_days=max_holding_days,
        rsi_min=rsi_min,
        rsi_max=rsi_max,
        strategy_mode=strategy_mode,
    )
    return envelope(res)


@app.get("/api/v1/catalysts/earnings")
async def catalysts_earnings() -> dict:
    """Upcoming earnings announcements, fiscal timing (BMO/AMC), and risk flags for portfolio holdings (§13, §14)."""
    holdings = current_holdings()
    res = await catalysts_service.get_earnings_calendar(holdings)
    return envelope(res)


@app.get("/api/v1/catalysts/dividends")
def catalysts_dividends() -> dict:
    """Dividend cashflow projections, monthly income distribution, and upcoming ex-dates (§13, §14)."""
    holdings = current_holdings()
    res = catalysts_service.get_dividend_projections(holdings)
    return envelope(res)


@app.get("/api/v1/briefing/daily")
async def briefing_daily() -> dict:
    """Generate pre-market daily executive briefing memo synthesizing performance, catalysts, and risk (§13, §14)."""
    holdings = current_holdings()
    res = await briefing_service.generate_daily_briefing(holdings)
    return envelope(res)


@app.post("/api/v1/briefing/dispatch")
async def briefing_dispatch(payload: dict | None = None) -> dict:
    """Dispatch the morning briefing memo directly to Telegram (§13, §14)."""
    p = payload or {}
    settings = notifications.get_settings()
    token = p.get("telegram_token") or settings.get("telegram_token", "")
    chat_id = p.get("telegram_chat_id") or settings.get("telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(status_code=400, detail="Telegram bot token or chat ID is not configured")

    holdings = current_holdings()
    briefing = await briefing_service.generate_daily_briefing(holdings)
    res = await briefing_service.dispatch_briefing_to_telegram(token=token, chat_id=chat_id, briefing=briefing)
    return envelope(res)



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


@app.get("/api/v1/market/bars/{symbol}")
async def market_bars(symbol: str, range: str = "6mo", interval: str = "1d") -> dict:
    """Fetch OHLCV historical price bars with SMA technical overlays for charting (§13, §14)."""
    sym = symbol.strip().upper()
    h = next((item for item in current_holdings() if item.symbol == sym), None)
    base_price = h.price if h else None
    bars_data = await bars_service.get_symbol_bars(sym, range_str=range, interval=interval, base_price=base_price)
    return envelope(bars_data)


@app.get("/api/v1/market/intraday-triggers")
async def market_intraday_triggers(symbol: str | None = None) -> dict:
    """Evaluate and return multi-timeframe intraday triggers (15m, 1h, VWAP, Volume)."""
    holdings = current_holdings()
    if symbol:
        sym = symbol.strip().upper()
        h = next((item for item in holdings if item.symbol == sym), None)
        base_p = h.price if h else None
        triggers = await intraday_service.evaluate_ticker_intraday(sym, base_price=base_p)
    else:
        triggers = await intraday_service.evaluate_intraday_triggers_for_holdings(holdings)
    return envelope([t.model_dump() if hasattr(t, "model_dump") else t.dict() for t in triggers])


@app.post("/api/v1/market/quotes")
async def market_quotes(payload: dict) -> dict:
    """Fetch live quotes for a batch of symbols (§13)."""
    symbols = payload.get("symbols", [])
    quotes = await market_router.get_quotes(symbols)
    return envelope({k: v.model_dump(by_alias=True) for k, v in quotes.items()})


@app.post("/api/v1/market/refresh")
async def market_refresh(payload: dict | None = None) -> dict:
    """Full operational refresh (§13, §14):
    1. Re-fetches live market quotes and 1y historical price bars
    2. Recalculates technical indicators (RSI, SMA50, SMA200, MACD, Trend Slope, RelVol)
    3. Recomputes portfolio market values, today's P&L, and weights
    4. Recalculates all signals, portfolio fit, and risk metrics
    5. Re-evaluates system and portfolio alerts
    6. Persists updated state to DB if an uploaded portfolio is active
    """
    global _live_enriched_holdings, _live_enriched_meta
    base = current_holdings()
    enriched, meta = await enrich_holdings_with_live_market(base, force_refresh=True)
    _live_enriched_holdings = enriched
    _live_enriched_meta = meta

    # If an uploaded portfolio is in DB, update stored holdings in place
    stored = store.latest_list("portfolio")
    if stored and stored["payload"].get("holdings"):
        p_data = dict(stored["payload"])
        p_data["holdings"] = [h.model_dump(by_alias=True) for h in enriched]
        p_data["has_signal_inputs"] = True
        p_data["refreshed_at"] = meta.get("timestamp")
        store.update_latest_list("portfolio", p_data)

    # 7. Automatically sync ranks from email article analyzer
    ratings_sync = None
    try:
        ratings_sync = sync_ratings_from_extractor()
    except Exception as exc:
        ratings_sync = {"synced": False, "error": str(exc)}

    live_alerts = generate_live_alerts(enriched)
    signals_data = [assess_holding(h).model_dump() for h in enriched if h.symbol != "CASH"]
    risk_data = calculate_risk(enriched).model_dump()
    summary_data = portfolio_summary()["data"]

    return envelope({
        "holdings": [h.model_dump(by_alias=True) for h in enriched],
        "alerts": [a.model_dump() for a in live_alerts],
        "signals": signals_data,
        "risk": risk_data,
        "summary": summary_data,
        "source": _portfolio_source(),
        "ratings_status": _ratings_status_payload(),
        "ratings_sync": ratings_sync,
        "meta": meta,
    })


@app.post("/api/v1/ratings/sync-auto")
def ratings_sync_auto() -> dict:
    """Automatically synchronizes all Seeking Alpha, Zacks, and Investing.com ratings
    from the local email article analyzer database into Atlas."""
    res = sync_ratings_from_extractor(force=True)
    status_payload = _ratings_status_payload()
    return envelope({
        **status_payload,
        "sync_details": res,
    })


@app.get("/api/v1/ratings/changes")
def ratings_changes() -> dict:
    """Return historical ratings upgrades, downgrades, and price target shifts from extractor runs."""
    shifts = extract_rating_shifts()
    return envelope({
        "count": len(shifts),
        "changes": shifts,
    })


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


@app.post("/api/v1/broker/alpaca/order")
async def broker_alpaca_order(payload: dict) -> dict:
    """Execute or simulate an order via Alpaca Paper Broker."""
    symbol = payload.get("symbol")
    qty = payload.get("qty") or payload.get("quantity")
    side = payload.get("side", "buy")
    order_type = payload.get("type", "market")
    time_in_force = payload.get("time_in_force", "day")
    limit_price = payload.get("limit_price")

    if not symbol or not qty:
        raise HTTPException(status_code=400, detail="symbol and qty are required")

    order_class = payload.get("order_class", "simple")
    take_profit = float(payload.get("take_profit_price")) if payload.get("take_profit_price") else None
    stop_loss = float(payload.get("stop_loss_price")) if payload.get("stop_loss_price") else None
    simulate = bool(payload.get("simulate", False))

    try:
        res = await alpaca_broker.place_order(
            symbol=symbol,
            qty=float(qty),
            side=side,
            order_type=order_type,
            time_in_force=time_in_force,
            limit_price=float(limit_price) if limit_price else None,
            order_class=order_class,
            take_profit_price=take_profit,
            stop_loss_price=stop_loss,
            simulate=simulate,
        )
        return envelope(res)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/v1/broker/alpaca/orders")
async def broker_alpaca_orders(status: str = "all", limit: int = 50) -> dict:
    """List recent orders from Alpaca."""
    orders = await alpaca_broker.get_orders(status=status, limit=limit)
    return envelope({"count": len(orders), "orders": orders})


@app.delete("/api/v1/broker/alpaca/orders/{order_id}")
async def broker_alpaca_cancel_order(order_id: str) -> dict:
    """Cancel an open order on Alpaca."""
    res = await alpaca_broker.cancel_order(order_id)
    return envelope(res)


@app.get("/api/v1/portfolio/rebalance")
def portfolio_rebalance(max_position: float = 12.0, max_sector: float = 30.0) -> dict:
    """Calculate recommended rebalancing trades based on model signal conviction and concentration constraints."""
    holdings = current_holdings()
    proposals = calculate_portfolio_rebalance(holdings, max_position_pct=max_position, max_sector_pct=max_sector)
    return envelope(proposals)


@app.post("/api/v1/portfolio/rebalance/execute")
async def portfolio_rebalance_execute(payload: dict) -> dict:
    """Execute selected rebalancing orders through Alpaca paper broker."""
    orders = payload.get("orders", [])
    if not orders:
        raise HTTPException(status_code=400, detail="No orders provided for execution")

    results = []
    for o in orders:
        try:
            trade_res = await alpaca_broker.place_order(
                symbol=o["symbol"],
                qty=float(o["quantity"]),
                side=o["side"],
                order_type="market",
                time_in_force="day",
            )
            results.append({"symbol": o["symbol"], "success": True, "details": trade_res})
        except Exception as exc:
            results.append({"symbol": o["symbol"], "success": False, "error": str(exc)})

    return envelope({
        "executed_count": sum(1 for r in results if r["success"]),
        "failed_count": sum(1 for r in results if not r["success"]),
        "results": results,
    })


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

