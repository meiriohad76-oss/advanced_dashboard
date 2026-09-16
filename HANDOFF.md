# Atlas Portfolio Intelligence — Project Handoff Document

**Date**: September 15, 2026  
**Project**: Atlas Portfolio Intelligence Dashboard  
**Status**: All Core Features & Advanced Enhancements Implemented, QA Tested, and Verified (100% Test Pass Rate)

---

## 📋 EXECUTIVE SUMMARY

The **Atlas Portfolio Intelligence Dashboard** is a high-performance, explainable portfolio management and signal prioritization platform. It provides deterministic technical setup scoring, concentration risk analysis, stress testing, custom user alert engines, live market ticker streaming via Server-Sent Events (SSE), executive PDF report exporting, and external analyst ratings integration.

Both the **React Web Application** (`src/`) and the **Standalone Single-File Dashboard** ([`preview.html`](file:///d:/advanced%20dashboard/preview.html)) feature 100% feature and visual parity, supporting complete offline operations without network dependencies.

---

## ✅ COMPLETED FEATURES & USER REQUEST RESOLUTIONS

### 1. 10,582 SEC EDGAR Ticker & Global ETF Database
- **Complete Resolution Coverage**: Populated 10,582 stock, index, and ETF company names across:
  - [`backend/app/company_names.py`](file:///d:/advanced%20dashboard/backend/app/company_names.py)
  - [`src/data/companyNames.ts`](file:///d:/advanced%20dashboard/src/data/companyNames.ts)
  - [`preview.html`](file:///d:/advanced%20dashboard/preview.html)
- **Included Major ETFs**: 120+ global ETFs (`SPY`, `QQQ`, `QQQM`, `IVV`, `VOO`, `VTI`, `IWM`, `EEM`, `EFA`, `SCHD`, `XLK`, `XLF`, `XLE`, `XLV`, `XLY`, `XLC`, `XLI`, `XLB`, `XLU`, `XLRE`, `GLD`, `TLT`, `BIL`, `ARKK`, `SMH`, `SOXX`, `SOXL`, `SOXS`, `TQQQ`, `SQQQ`, `DIA`, `VUG`, `VTV`, `VYM`, `VNQ`, `BND`, `AGG`, `LQD`, `HYG`, `JEPI`, `JEPQ`, etc.).
- **0ms Instant Resolution**: Resolves company names instantly during CSV/Excel uploads offline.

### 2. Individual Stock Time-Related Performance Analysis (`1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`)
- **React Component**: [`StockPerformance.tsx`](file:///d:/advanced%20dashboard/src/components/StockPerformance.tsx) embedded in `AssetDrawer`.
- **Standalone Mirror**: `stockPerfHtml()` embedded in `openDrawer()` inside [`preview.html`](file:///d:/advanced%20dashboard/preview.html).
- **Functionality**: Renders asset returns curves, period percentage return, and relative Alpha calculation vs the SPY benchmark.

### 3. Custom User Alert Engine & Alert Center Modal
- **Live Alert Engine**: [`alertEngine.ts`](file:///d:/advanced%20dashboard/src/domain/alertEngine.ts) evaluates `PRICE`, `SMA20`, `SMA50`, `SMA150`, `RSI`, `MACD`, `VOLUME`, and `STOP_LOSS`.
- **Dynamic Form Contextualization**:
  - For Crossover & Trend Indicators (`MACD`, `SMA20`, `SMA50`, `SMA150`), numeric threshold inputs are automatically hidden/disabled (*"✓ Crossover event - No threshold number needed"*).
  - For Numeric Metrics (`PRICE`, `RSI`, `VOLUME`, `STOP_LOSS`), relevant threshold inputs, placeholders (`150.00`, `70`, `2.0`, `5.0`), and `required` constraints are shown.
- **Alert Center Panels**: [`AlertPanel.tsx`](file:///d:/advanced%20dashboard/src/components/AlertPanel.tsx) in React and `#alertModal` overlay in [`preview.html`](file:///d:/advanced%20dashboard/preview.html).

### 4. Interactive Strategy Decision Directive Modal
- **React Modal**: [`DecisionModal.tsx`](file:///d:/advanced%20dashboard/src/components/DecisionModal.tsx).
- **Standalone Overlay**: `#decisionModal` in [`preview.html`](file:///d:/advanced%20dashboard/preview.html).
- **Features**: Displays concrete action directives (`STRONG ENTRY · Rebalance Allocation`), score & rule rationales, before/after exposure simulation sliders, and an instant **Simulate & Apply Rebalance** action button.

### 5. Persistent LocalStorage Alert Synchronization
- **React State & LocalStorage**: User-created custom alerts persist across browser tab reloads in `src/App.tsx` (`atlas_user_alerts`).
- **Standalone Preview Parity**: `preview.html` automatically syncs user alerts to `localStorage` (`atlas_preview_user_alerts`).

### 6. Strategy Decision Executive PDF / Print Briefing Export
- **One-Click Export**: `Export PDF` button in [`DecisionModal.tsx`](file:///d:/advanced%20dashboard/src/components/DecisionModal.tsx) and in [`preview.html`](file:///d:/advanced%20dashboard/preview.html).
- **Print Optimization**: `@media print` stylesheets ensure clutter-free executive format with clean typography, confidential memorandum footers, and crisp tabular data suitable for boardroom briefings.

### 7. Real-Time Market SSE Ticker Streaming & Live Alert Engine
- **FastAPI SSE Endpoint**: `/api/v1/market/stream` emits real-time tick price fluctuations for active portfolio holdings via Server-Sent Events.
- **Header Live Stream Control**: Topbar toggle button (`🔴 Live Stream` / `⏸ Stream Paused`) in React & `preview.html`.
- **Real-Time Alert Triggering**: Automatically checks active armed user alerts against incoming price ticks and dispatches immediate notification toasts with inspection links when criteria are crossed.
- **Resilient Offline Fallback**: If backend connection is unavailable, seamlessly generates local market fluctuations so live streaming works 100% offline.

### 8. Analyst Target Spread Spectrum & External Ratings Gauges
- **Analyst Target Spectrum Card**: Renders Seeking Alpha Wall Street target range (Low, Target, High) and Zacks quant revision targets with computed upside/downside percentages and visual spectrum position bars.
- **Street Consensus Gauges**: Standardizes Zacks, SA Quant, SA Analysts, SA Wall St, and Investing.com ratings onto a 0–100 bullishness scale.

### 9. Interactive Tooltips & Position Sizing Columns
- **Hover/Tap Tooltips**: [`Tooltip.tsx`](file:///d:/advanced%20dashboard/src/components/Tooltip.tsx) explaining `Unrealized P&L`, `Shares`, `Avg Cost`, `Market Value`, `Beta`, `95% VaR`, `RSI`, `MACD`, `SMA`.
- **Portfolio Table**: Displays Quantity (Shares), Avg Cost (Cost Basis), Market Value, Weight %, Today's Change %, and Unrealized P&L ($ & %).

---

## 🛠️ ARCHITECTURE & TECH STACK

```
d:\advanced dashboard
├── HANDOFF.md                       # Project handoff document
├── preview.html                     # Standalone, zero-dependency offline dashboard
├── src/                             # React + Vite + TypeScript application
│   ├── App.tsx                      # Core React dashboard container & navigation
│   ├── styles.css                   # Glassmorphism design system & print styling
│   ├── components/
│   │   ├── AlertPanel.tsx           # Custom user alert creation & active feed modal
│   │   ├── DecisionModal.tsx        # Strategy directive action plan & PDF briefing export
│   │   ├── StockPerformance.tsx     # Individual asset timeframe performance component
│   │   ├── PortfolioFit.tsx         # Portfolio-aware signal adjustment panel
│   │   ├── RatingsGauge.tsx         # External ratings consensus meter
│   │   ├── TimeframeSelector.tsx    # Portfolio performance timeframe selector
│   │   └── Tooltip.tsx              # Interactive metric explanation tooltips
│   ├── data/
│   │   ├── companyNames.ts          # 10,582 ticker-to-company-name lookup directory
│   │   └── tooltips.ts              # Metric tooltip explanations dictionary
│   ├── domain/
│   │   ├── alertEngine.ts           # Live alert evaluation logic
│   │   ├── alertEngine.test.ts      # Unit tests for alert evaluation
│   │   ├── engine.ts                # Deterministic scoring engine (default_swing_v1)
│   │   ├── portfolioFit.ts          # Portfolio fit & concentration drag engine
│   │   ├── ratings.ts               # Ratings normalizer & target price provider
│   │   └── timeframe.ts             # Timeframe slicing & alpha return calculator
│   └── api/
│       └── client.ts                # FastAPI REST API client
├── backend/                         # FastAPI Python backend service
│   ├── data/atlas.db                # SQLite database for persistence
│   ├── app/
│   │   ├── main.py                  # API endpoints, SSE stream & routing
│   │   ├── store.py                 # SQLite database storage implementation
│   │   ├── imports.py               # Tabular CSV / Excel parsing module
│   │   ├── company_names.py         # 10,582 ticker backend database
│   │   ├── engine.py                # Python deterministic scoring engine
│   │   └── alerts.py                # Webhook alert dispatching module
│   └── tests/                       # Pytest test suite (55 tests)
└── scripts/
    └── update_names.py              # Script to synchronize 10,582 tickers across files
```

---

## 🧪 VERIFICATION & TESTING COMMANDS

To run the automated verification test suites:

### 1. Frontend Unit Tests (Vitest)
```bash
npm run test -- --run
```
*Pass Rate*: `23 / 23 passed (100%)`

### 2. Frontend Linter & Accessibility Audit (ESLint 9)
```bash
npm run lint
```
*Audit Result*: `0 errors, 0 warnings (100% clean)`

### 3. Backend Unit & API Tests (Pytest)
```bash
$env:PYTHONPATH="backend"; python -m pytest backend/tests
```
*Pass Rate*: `55 / 55 passed (100%)`

### 4. Production Vite Build
```bash
npm run build
```
*Build Result*: Clean production build with zero TypeScript or Vite errors.

---

## 🚀 HOW TO RUN THE APPLICATION

### Option A: Standalone Preview (No Server Required)
Open [`preview.html`](file:///d:/advanced%20dashboard/preview.html) directly in any browser for immediate offline testing.

### Option B: Local Development Web App
```bash
# Terminal 1: React Vite Frontend (http://localhost:5173)
npm run dev

# Terminal 2: Python FastAPI Backend (http://127.0.0.1:8000)
$env:PYTHONPATH="backend"; python -m uvicorn app.main:app --port 8000
```
