# Smart Portfolio Management Dashboard
## Production-Grade Software Specification for Raspberry Pi 5

**Document version:** 1.0  
**Date:** 2026-09-09  
**Target platform:** Raspberry Pi 5 (8 GB recommended)  
**Deployment model:** Self-hosted, Docker Compose, Cloudflare Tunnel + Cloudflare Access  
**Target recurring data cost:** $0/month initially; hard ceiling of $20/month unless explicitly approved  
**Primary use case:** Personal portfolio monitoring, technical analysis, watchlist entry-signal detection, alerts, and portfolio risk analytics  
**Trading scope:** Decision-support only in V1/V2; no automated brokerage order execution

---

# 1. Executive Summary

This document specifies a production-grade, self-hosted smart portfolio management dashboard designed to run continuously on a Raspberry Pi 5.

The system will:

1. Track one or more investment portfolios.
2. Maintain a complete transaction ledger and cost basis.
3. Calculate portfolio performance and benchmark-relative performance.
4. Maintain watchlists.
5. Collect market data from multiple providers through a provider abstraction layer.
6. Calculate technical indicators locally.
7. Detect technical setups and entry triggers.
8. Assign configurable entry/setup scores to watchlist securities.
9. Create and manage price, technical, portfolio, and compound alerts.
10. Send notifications through the dashboard, Telegram, and optionally email.
11. Track portfolio risk, drawdowns, concentration, volatility, correlations, and benchmark exposure.
12. Provide market-regime context using macroeconomic and market data.
13. Store enough historical data locally to reduce dependence on third-party APIs.
14. Be securely accessible from outside the home network through Cloudflare Tunnel and Cloudflare Access.
15. Operate initially at approximately $0/month in recurring data-service costs.

The architecture deliberately separates:

- market-data acquisition,
- normalized market data,
- portfolio accounting,
- indicator calculation,
- signal generation,
- alert evaluation,
- notification delivery,
- API/backend logic,
- and user interface.

This makes the application resilient to market-data provider changes and allows components to evolve independently.

---

# 2. Goals

## 2.1 Primary Goals

The first production version must provide:

- accurate portfolio accounting;
- reliable historical and current pricing;
- daily and intraday portfolio valuation;
- benchmark comparison;
- configurable watchlists;
- locally calculated technical indicators;
- rules-based entry detection;
- alerts with state and cooldown management;
- responsive browser UI suitable for desktop and iPad;
- secure remote access;
- persistence across reboots;
- automated recovery after power/network interruptions;
- operational monitoring and data-quality checks.

## 2.2 Secondary Goals

The architecture should make it easy to add:

- fundamental analysis;
- SEC financial statement data;
- macro regime analysis;
- portfolio optimization;
- advanced signal scoring;
- news/event enrichment;
- AI-generated explanations of signals;
- broker synchronization;
- mobile push notifications;
- backtesting;
- multiple users.

## 2.3 Non-Goals for V1

The following are explicitly out of scope for the first release:

- automated trade execution;
- high-frequency trading;
- tick-by-tick strategy execution;
- options analytics;
- futures trading;
- crypto trading;
- social/community features;
- public multi-tenant SaaS deployment;
- machine-learning price prediction.

---

# 3. Key Design Principles

## 3.1 Source Independence

Application business logic must never call a specific market-data provider directly.

Bad:

```python
price = alpaca.get_latest_quote("AAPL")
```

Correct:

```python
price = market_data.get_latest_price("AAPL")
```

The provider layer decides where the data comes from.

## 3.2 Local Calculation

Technical indicators should be calculated locally from normalized OHLCV data whenever practical.

Reasons:

- avoids vendor lock-in;
- reduces API consumption;
- provides reproducibility;
- allows custom calculations;
- makes backtesting easier;
- improves resilience when APIs are temporarily unavailable.

## 3.3 Transaction Ledger as Source of Truth

Current holdings must be derived from immutable portfolio transactions rather than manually stored as the only source of truth.

The ledger must support:

- BUY;
- SELL;
- DIVIDEND;
- CASH_DEPOSIT;
- CASH_WITHDRAWAL;
- FEE;
- SPLIT;
- TRANSFER_IN;
- TRANSFER_OUT.

## 3.4 Idempotent Background Processing

All scheduled jobs must be safe to execute more than once.

Example:

Downloading the same daily AAPL candle twice must update/ignore the existing record instead of inserting a duplicate.

## 3.5 Fail Gracefully

The system must distinguish between:

- "no signal";
- "no market data";
- "stale market data";
- "provider unavailable";
- "calculation failed".

A missing price must never silently become zero.

## 3.6 Security Before Exposure

The Raspberry Pi must not expose application ports directly to the Internet.

Remote access path:

```text
User Browser
    |
    v
Cloudflare
    |
    v
Cloudflare Access Authentication
    |
    v
Cloudflare Tunnel
    |
    v
Reverse Proxy / Frontend
    |
    v
FastAPI
```

## 3.7 Explainable Signals

Every technical signal must include a human-readable explanation.

Example:

```text
CRDO Entry Score: 86/100

+10 Price above 200-day SMA
+10 50-day SMA above 200-day SMA
+10 MACD bullish
+8  RSI = 57
+10 Relative volume = 1.42x
+10 Breakout above 20-day high
...
```

A score without an explanation is not acceptable.

---

# 4. Target Hardware

Recommended:

```text
Raspberry Pi 5
RAM:            8 GB
Storage:        NVMe SSD strongly recommended
OS:             Raspberry Pi OS 64-bit / Debian-based 64-bit OS
Architecture:   ARM64
Network:        Ethernet preferred
Power:          official/stable PSU
Cooling:        active cooling recommended
```

An SD card may be used for initial development, but production PostgreSQL should preferably run on an SSD/NVMe device.

Suggested storage:

```text
Minimum: 128 GB
Recommended: 256 GB+
```

---

# 5. Technology Stack

## 5.1 Backend

```text
Language:           Python 3.12+
Framework:          FastAPI
ASGI Server:        Uvicorn
ORM:                SQLAlchemy 2.x
Migrations:         Alembic
Validation:         Pydantic
HTTP client:        httpx
Scheduler:          APScheduler
Data processing:    pandas + NumPy
Technical analysis: custom indicator module; optional maintained TA library
Caching:            Redis
```

Celery is not required initially.

A lightweight APScheduler + worker process is preferable for Raspberry Pi V1.

Celery can be introduced if task volume becomes large.

## 5.2 Frontend

```text
React
TypeScript
Vite
TanStack Query
TradingView Lightweight Charts
React Router
CSS framework: Tailwind CSS or equivalent
```

## 5.3 Database

Primary:

```text
PostgreSQL
```

Optional future optimization:

```text
TimescaleDB
```

V1 should not require TimescaleDB.

Standard PostgreSQL is sufficient for the intended workload.

## 5.4 Infrastructure

```text
Docker
Docker Compose
Cloudflare Tunnel
Cloudflare Access
```

Optional reverse proxy:

```text
Caddy or Nginx
```

A reverse proxy is optional if the frontend container handles static assets and Cloudflare Tunnel points directly to it.

---

# 6. External Data Sources

The system must use a provider abstraction because free-plan limitations and pricing can change.

## 6.1 Alpaca Market Data

Recommended role:

- primary current US equity/ETF market data;
- historical OHLCV;
- limited real-time monitoring.

At the time this specification was prepared, Alpaca Basic advertises:

- $0 plan;
- US stocks and ETFs;
- real-time IEX equities feed;
- up to 30 WebSocket symbol subscriptions;
- historical data from 2016;
- recent historical-data restriction on the free tier;
- approximately 200 historical API requests/minute.

Important:

IEX is not the complete consolidated US market feed.

Therefore:

- use it for practical real-time monitoring and signal triggering;
- label live data source clearly;
- do not claim that IEX-only quotes equal full consolidated NBBO;
- use delayed/historical consolidated data where available for validation.

Official source:

https://docs.alpaca.markets/

## 6.2 Massive

Recommended role on free tier:

- secondary provider;
- end-of-day backup;
- reference data;
- corporate actions;
- validation.

At the time this specification was prepared, Massive Stocks Basic advertises:

- $0/month;
- 5 API calls/minute;
- two years of historical data;
- all US stock tickers;
- end-of-day data;
- reference data;
- corporate actions;
- technical indicator endpoints;
- minute aggregate endpoint availability subject to plan restrictions.

The free plan should **not be considered the primary live-feed dependency**.

Official source:

https://massive.com/pricing?product=stocks

The next stock plan is currently above the project's $20/month limit, so the system must not depend on it.

## 6.3 SEC EDGAR

Role:

- company filing metadata;
- XBRL financial data;
- future fundamental engine.

SEC `data.sec.gov` endpoints provide JSON APIs for filing history and XBRL data without API authentication.

The application must identify itself properly in HTTP headers and comply with SEC fair-access policies.

Official source:

https://www.sec.gov/search-filings/edgar-application-programming-interfaces

## 6.4 FRED

Role:

- macroeconomic time series;
- market regime dashboard.

Potential series:

- Fed Funds Rate;
- 2-year Treasury;
- 10-year Treasury;
- yield spreads;
- CPI;
- unemployment;
- credit spreads;
- selected financial-condition indicators.

FRED API requires an API key.

Official source:

https://fred.stlouisfed.org/docs/api/fred/

## 6.5 Optional Fallback Provider

A non-critical unofficial source may be implemented as a fallback adapter, but:

- it must never be the sole source for portfolio accounting;
- failures must be observable;
- provider name must be stored with imported data;
- values should be validated against a trusted source.

---

# 7. Monthly Cost Policy

The default production configuration must remain:

```text
Market data:          $0
Database:             $0
Backend:              $0
Frontend:             $0
Cloudflare Tunnel:    $0 for required capability
Notifications:        $0
FRED:                 $0
SEC:                  $0
```

Target:

```text
Recurring project data/API cost = $0/month
```

Hard policy:

```text
Do not activate any paid data subscription above $20/month
without an explicit architecture change and user approval.
```

The application should contain a configuration section:

```yaml
budget:
  monthly_external_services_usd: 0
  hard_limit_usd: 20
```

---

# 8. High-Level Architecture

```text
+---------------------------------------------------------------------+
|                           CLIENT DEVICES                             |
|                  Desktop / iPad / Mobile Browser                     |
+----------------------------------+----------------------------------+
                                   |
                                   v
+---------------------------------------------------------------------+
|                          CLOUDFLARE                                  |
|                                                                     |
|  DNS -> Access -> Authentication -> Tunnel                           |
+----------------------------------+----------------------------------+
                                   |
                                   v
+---------------------------------------------------------------------+
|                        RASPBERRY PI 5                                |
|                                                                     |
|  +------------------+                                               |
|  | Frontend         |                                               |
|  | React/TypeScript |                                               |
|  +---------+--------+                                               |
|            |                                                        |
|            v                                                        |
|  +------------------+                                               |
|  | FastAPI API      |                                               |
|  +----+--------+----+                                               |
|       |        |                                                    |
|       |        +----------------------+                             |
|       v                               v                             |
|  +----------+                  +-------------+                      |
|  | Redis    |                  | PostgreSQL  |                      |
|  +----------+                  +-------------+                      |
|       ^                               ^                             |
|       |                               |                             |
|       +---------------+---------------+                             |
|                       |                                             |
|                 +-----+------+                                      |
|                 | Worker /   |                                      |
|                 | Scheduler  |                                      |
|                 +-----+------+                                      |
|                       |                                             |
|       +---------------+------------------------------+              |
|       |               |              |               |              |
|       v               v              v               v              |
|   Market Data     Indicators       Signals         Alerts           |
|     Service         Engine          Engine          Engine           |
+-------+---------------+--------------+---------------+--------------+
        |
        v
+---------------------------------------------------------------------+
|                       EXTERNAL DATA                                  |
|          Alpaca | Massive | FRED | SEC EDGAR                        |
+---------------------------------------------------------------------+
```

---

# 9. Repository Structure

Recommended monorepo:

```text
smart-portfolio/
|
|-- README.md
|-- docker-compose.yml
|-- docker-compose.prod.yml
|-- .env.example
|-- .gitignore
|-- Makefile
|
|-- backend/
|   |-- Dockerfile
|   |-- pyproject.toml
|   |
|   `-- app/
|       |-- main.py
|       |-- config.py
|       |-- logging.py
|       |
|       |-- api/
|       |   |-- dependencies.py
|       |   `-- v1/
|       |       |-- router.py
|       |       |-- portfolios.py
|       |       |-- transactions.py
|       |       |-- positions.py
|       |       |-- watchlists.py
|       |       |-- market.py
|       |       |-- indicators.py
|       |       |-- signals.py
|       |       |-- alerts.py
|       |       |-- analytics.py
|       |       `-- system.py
|       |
|       |-- core/
|       |   |-- exceptions.py
|       |   |-- enums.py
|       |   `-- time.py
|       |
|       |-- db/
|       |   |-- base.py
|       |   |-- session.py
|       |   `-- models/
|       |
|       |-- schemas/
|       |
|       |-- repositories/
|       |
|       |-- services/
|       |   |-- portfolio/
|       |   |-- market_data/
|       |   |-- indicators/
|       |   |-- signals/
|       |   |-- alerts/
|       |   |-- analytics/
|       |   |-- fundamentals/
|       |   `-- notifications/
|       |
|       |-- providers/
|       |   |-- base.py
|       |   |-- alpaca/
|       |   |-- massive/
|       |   |-- fred/
|       |   `-- sec/
|       |
|       |-- workers/
|       |   |-- scheduler.py
|       |   |-- market_jobs.py
|       |   |-- signal_jobs.py
|       |   |-- alert_jobs.py
|       |   `-- maintenance_jobs.py
|       |
|       `-- tests/
|
|-- frontend/
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   |-- vite.config.ts
|   `-- src/
|       |-- api/
|       |-- components/
|       |-- features/
|       |-- hooks/
|       |-- layouts/
|       |-- pages/
|       |-- types/
|       `-- utils/
|
|-- infra/
|   |-- cloudflare/
|   |-- postgres/
|   `-- scripts/
|
|-- docs/
|   |-- architecture.md
|   |-- api.md
|   |-- alerts.md
|   `-- operations.md
|
`-- data/
    `-- backups/
```

---

# 10. Environment Configuration

Example `.env.example`:

```dotenv
APP_ENV=production
APP_NAME=smart-portfolio
APP_TIMEZONE=Asia/Jerusalem

POSTGRES_DB=portfolio
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=CHANGE_ME
DATABASE_URL=postgresql+psycopg://portfolio:CHANGE_ME@postgres:5432/portfolio

REDIS_URL=redis://redis:6379/0

ALPACA_API_KEY=
ALPACA_API_SECRET=

MASSIVE_API_KEY=

FRED_API_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SEC_USER_AGENT="SmartPortfolio contact@example.com"

LOG_LEVEL=INFO

MARKET_PROVIDER_PRIMARY=alpaca
MARKET_PROVIDER_SECONDARY=massive

MONTHLY_API_BUDGET_USD=0
HARD_MONTHLY_API_BUDGET_USD=20
```

Secrets must not be committed to Git.

Production secrets should be stored with restrictive filesystem permissions or Docker secrets where practical.

---

# 11. Domain Model

Core entities:

```text
User
Portfolio
Account
Security
Transaction
Position
CashBalance
PriceBar
CorporateAction
Watchlist
WatchlistItem
IndicatorValue
SignalDefinition
SignalEvent
AlertRule
AlertEvent
Notification
PortfolioSnapshot
Benchmark
MacroSeries
MacroObservation
ProviderHealth
JobExecution
```

---

# 12. Database Schema

The exact implementation may evolve through Alembic migrations.

## 12.1 users

```text
id                  UUID PK
email               VARCHAR UNIQUE
display_name        VARCHAR
timezone            VARCHAR
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Single-user V1 may still create a user record to avoid a future schema migration.

## 12.2 portfolios

```text
id                  UUID PK
user_id             UUID FK users
name                VARCHAR
base_currency       CHAR(3)
benchmark_symbol    VARCHAR
is_active           BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## 12.3 accounts

```text
id                  UUID PK
portfolio_id        UUID FK
name                VARCHAR
broker_name         VARCHAR NULL
account_type        VARCHAR NULL
base_currency       CHAR(3)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## 12.4 securities

```text
id                  UUID PK
symbol              VARCHAR
exchange            VARCHAR NULL
name                VARCHAR NULL
security_type       VARCHAR
currency            CHAR(3)
sector              VARCHAR NULL
industry            VARCHAR NULL
cik                 VARCHAR NULL
is_active           BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Unique index:

```text
(symbol, exchange)
```

For V1 US equities, symbol alone may generally identify a security, but the schema should not assume this globally.

## 12.5 transactions

```text
id                  UUID PK
account_id          UUID FK
security_id         UUID FK NULL
transaction_type    ENUM
trade_date          DATE
settlement_date     DATE NULL
quantity            NUMERIC NULL
price               NUMERIC NULL
gross_amount        NUMERIC NULL
fees                NUMERIC DEFAULT 0
taxes               NUMERIC DEFAULT 0
currency            CHAR(3)
external_id         VARCHAR NULL
notes               TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Transactions should generally be append-only.

Corrections should preferably use:

- reversal transactions;
- or an audit log.

## 12.6 positions

This is a derived/cache table.

```text
id                  UUID PK
account_id          UUID FK
security_id         UUID FK
quantity            NUMERIC
average_cost        NUMERIC
cost_basis          NUMERIC
realized_pnl        NUMERIC
last_rebuilt_at     TIMESTAMPTZ
```

Unique:

```text
(account_id, security_id)
```

## 12.7 price_bars

```text
security_id         UUID FK
timeframe           ENUM
timestamp           TIMESTAMPTZ
open                NUMERIC
high                NUMERIC
low                 NUMERIC
close               NUMERIC
adjusted_close      NUMERIC NULL
volume              BIGINT NULL
vwap                NUMERIC NULL
provider            VARCHAR
is_adjusted          BOOLEAN
ingested_at         TIMESTAMPTZ
```

Primary/unique key:

```text
(security_id, timeframe, timestamp, provider)
```

Timeframes:

```text
1m
5m
15m
1h
1d
1w
```

V1 should store primarily:

```text
1m or 5m for watched/current symbols
1d for all tracked symbols
```

Do not unnecessarily retain every one-minute candle forever.

## 12.8 latest_quotes

```text
security_id         UUID PK
timestamp           TIMESTAMPTZ
price               NUMERIC
bid                 NUMERIC NULL
ask                 NUMERIC NULL
source               VARCHAR
market_session       VARCHAR
updated_at           TIMESTAMPTZ
```

Redis may hold faster transient quote values, while PostgreSQL stores periodic snapshots.

## 12.9 corporate_actions

```text
id                  UUID PK
security_id         UUID FK
action_type         ENUM
ex_date             DATE
record_date         DATE NULL
pay_date            DATE NULL
ratio               NUMERIC NULL
cash_amount         NUMERIC NULL
currency            CHAR(3) NULL
provider             VARCHAR
provider_id          VARCHAR NULL
created_at           TIMESTAMPTZ
```

## 12.10 portfolio_snapshots

```text
portfolio_id        UUID FK
timestamp           TIMESTAMPTZ
market_value        NUMERIC
cash_value          NUMERIC
total_value         NUMERIC
cost_basis          NUMERIC
unrealized_pnl      NUMERIC
realized_pnl        NUMERIC
day_pnl             NUMERIC
day_return          NUMERIC
source_quality      VARCHAR
created_at          TIMESTAMPTZ
```

## 12.11 watchlists

```text
id                  UUID PK
user_id             UUID FK
name                VARCHAR
description         TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## 12.12 watchlist_items

```text
id                  UUID PK
watchlist_id        UUID FK
security_id         UUID FK
target_entry_price  NUMERIC NULL
target_exit_price   NUMERIC NULL
notes               TEXT NULL
priority            INTEGER DEFAULT 0
entry_model_id      UUID NULL
added_at            TIMESTAMPTZ
```

## 12.13 indicator_values

Recommended fields:

```text
security_id         UUID FK
timeframe           ENUM
timestamp           TIMESTAMPTZ
indicator_key       VARCHAR
params_hash         VARCHAR
value               JSONB
calculated_at       TIMESTAMPTZ
```

Example value:

```json
{
  "value": 57.31
}
```

MACD:

```json
{
  "macd": 1.34,
  "signal": 1.11,
  "histogram": 0.23
}
```

## 12.14 signal_definitions

```text
id                  UUID PK
name                VARCHAR
version             INTEGER
description         TEXT
configuration       JSONB
is_active           BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## 12.15 signal_events

```text
id                  UUID PK
signal_definition_id UUID FK
security_id         UUID FK
timestamp           TIMESTAMPTZ
score               NUMERIC NULL
severity            ENUM
explanation         JSONB
input_snapshot      JSONB
created_at          TIMESTAMPTZ
```

## 12.16 alert_rules

```text
id                  UUID PK
user_id             UUID FK
security_id         UUID FK NULL
portfolio_id        UUID FK NULL
name                VARCHAR
description         TEXT NULL
rule_json           JSONB
state               ENUM
cooldown_seconds    INTEGER
last_triggered_at   TIMESTAMPTZ NULL
enabled             BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## 12.17 alert_events

```text
id                  UUID PK
alert_rule_id       UUID FK
security_id         UUID FK NULL
triggered_at        TIMESTAMPTZ
resolved_at         TIMESTAMPTZ NULL
status              ENUM
trigger_snapshot    JSONB
message             TEXT
acknowledged_at     TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
```

## 12.18 notifications

```text
id                  UUID PK
alert_event_id      UUID FK NULL
channel             ENUM
destination         VARCHAR
status              ENUM
attempt_count       INTEGER
sent_at             TIMESTAMPTZ NULL
error_message       TEXT NULL
created_at          TIMESTAMPTZ
```

## 12.19 provider_health

```text
provider            VARCHAR PK
status              ENUM
last_success_at     TIMESTAMPTZ
last_error_at       TIMESTAMPTZ NULL
last_error          TEXT NULL
latency_ms          INTEGER NULL
rate_limit_remaining INTEGER NULL
updated_at          TIMESTAMPTZ
```

## 12.20 job_executions

```text
id                  UUID PK
job_name            VARCHAR
started_at          TIMESTAMPTZ
finished_at         TIMESTAMPTZ NULL
status              ENUM
records_processed   INTEGER DEFAULT 0
error_message       TEXT NULL
metadata            JSONB NULL
```

---

# 13. Market Data Provider Interface

All market providers implement a common interface.

```python
from abc import ABC, abstractmethod

class MarketDataProvider(ABC):

    @abstractmethod
    async def get_quote(self, symbol: str):
        pass

    @abstractmethod
    async def get_bars(
        self,
        symbol: str,
        timeframe: str,
        start,
        end,
    ):
        pass

    @abstractmethod
    async def get_reference(self, symbol: str):
        pass

    @abstractmethod
    async def get_corporate_actions(
        self,
        symbol: str,
        start,
        end,
    ):
        pass

    @abstractmethod
    async def healthcheck(self):
        pass
```

A normalized DTO should be returned regardless of provider.

Example:

```python
class PriceBar:
    symbol: str
    timestamp: datetime
    timeframe: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int | None
    provider: str
```

---

# 14. Provider Routing

Provider routing must be configurable.

Example:

```yaml
market_data:
  quote:
    primary: alpaca
    fallback: null

  intraday:
    primary: alpaca
    fallback: null

  daily:
    primary: alpaca
    fallback: massive

  corporate_actions:
    primary: massive
    fallback: alpaca

  reference:
    primary: massive
    fallback: alpaca
```

Routing logic:

```text
request
   |
   v
primary provider
   |
 success? ---- yes ---> normalize ---> validate ---> return
   |
   no
   |
fallback enabled?
   |
   yes
   |
   v
fallback provider
```

Every fallback event should be logged.

---

# 15. Data Quality

Market data is financial infrastructure.

The application must explicitly assess quality.

## 15.1 Freshness

Example limits:

```text
Real-time quote during market hours:
WARN after 2 minutes
STALE after 5 minutes

Daily bars:
WARN if previous market day missing after scheduled ingestion

Macro data:
series-specific
```

## 15.2 OHLC Validation

Reject/quarantine data where:

```text
high < low
open > high
open < low
close > high
close < low
negative volume
invalid timestamp
```

## 15.3 Duplicate Detection

Upsert on:

```text
security + timeframe + timestamp + provider
```

## 15.4 Cross-Provider Validation

For daily bars available from two sources:

```text
abs(close_A - close_B) / close_A
```

If difference exceeds threshold, record a reconciliation warning.

Default threshold suggestion:

```text
0.5%
```

Corporate actions may explain larger apparent differences.

## 15.5 Provider Quality State

UI indicator:

```text
DATA STATUS

Alpaca       Healthy
Massive      Healthy
FRED         Healthy
SEC          Healthy

Latest quote age: 8 sec
Daily bars current through: 2026-09-08
```

---

# 16. Market Calendar

Do not assume Monday-Friday equals a trading day.

The application must maintain/use a US market calendar supporting:

- holidays;
- early closes;
- daylight-saving changes;
- pre-market;
- regular session;
- after-hours.

All database timestamps should be UTC.

UI may display:

```text
America/New_York for market time
Asia/Jerusalem for user time
```

---

# 17. Background Job Schedule

Exact values are configurable.

## 17.1 Startup

At application startup:

```text
1. Validate database connection.
2. Validate Redis.
3. Run schema check.
4. Load market calendar.
5. Recover unfinished jobs.
6. Check provider health.
7. Rebuild stale positions if required.
8. Check data gaps.
9. Start scheduler.
```

## 17.2 Daily Jobs

Suggested:

```text
05:00 ET    refresh security/reference metadata if needed
06:00 ET    pre-market quote/watchlist refresh
09:25 ET    initialize market-day state
09:30 ET    enable regular-session monitoring
16:05 ET    stop regular-session high-frequency polling
16:20 ET    ingest final daily bars
16:30 ET    calculate daily indicators
16:35 ET    evaluate daily signals
16:40 ET    snapshot portfolios
17:00 ET    update corporate actions
18:00 ET    provider reconciliation
18:30 ET    database maintenance
```

Times should be tied to the market calendar and `America/New_York`.

## 17.3 Intraday Loop

For portfolio + watchlist symbols:

```text
every 1 minute or 5 minutes
```

The actual interval should respect:

- provider limits;
- watchlist size;
- real-time subscription limits;
- Raspberry Pi load.

Prefer WebSocket subscriptions when available.

## 17.4 Macro Update

```text
once per day
```

or according to release cadence.

## 17.5 SEC Update

```text
once or twice daily for tracked companies
```

Do not aggressively poll SEC.

---

# 18. Portfolio Accounting Engine

The portfolio engine consumes transactions.

## 18.1 Position Quantity

```text
quantity =
sum(BUY quantities)
- sum(SELL quantities)
+ transfers
+ split adjustments
```

## 18.2 Cost Basis

V1 configuration should support at least:

```text
AVERAGE_COST
```

Future:

```text
FIFO
LIFO
SPECIFIC_LOT
```

The chosen method must be stored with the portfolio/account.

## 18.3 Market Value

```text
market_value = quantity * latest_valid_price
```

## 18.4 Unrealized P/L

```text
unrealized_pnl = market_value - open_cost_basis
```

## 18.5 Realized P/L

Derived from closed quantities according to cost-basis method.

## 18.6 Daily P/L

For an unchanged quantity:

```text
day_pnl = quantity * (current_price - prior_close)
```

Transactions during the current day require cash-flow-aware treatment.

## 18.7 Total Return

Must account for:

- realized gains;
- unrealized gains;
- dividends;
- fees;
- deposits;
- withdrawals.

## 18.8 Time-Weighted Return

Required for meaningful manager-style performance.

Process:

```text
split return series around external cash flows
calculate subperiod returns
geometrically link subperiods
```

## 18.9 Money-Weighted Return

Support:

```text
XIRR
```

for investor-specific cash-flow return.

---

# 19. Benchmark Engine

Default supported benchmark securities:

```text
SPY
QQQ
SCHD
```

Users may select another liquid ETF.

Benchmark comparison must normalize both portfolio and benchmark to:

```text
100 at selected start date
```

Example:

```text
Portfolio    117.4
SPY          112.9
QQQ          119.1
```

Metrics:

- cumulative return;
- annualized return;
- relative return;
- volatility;
- beta;
- correlation;
- maximum drawdown;
- tracking error;
- Sharpe ratio where appropriate.

---

# 20. Technical Indicator Engine

Indicators are calculated from normalized price data.

## 20.1 Trend

V1:

```text
SMA 20
SMA 50
SMA 100
SMA 150
SMA 200

EMA 9
EMA 21
EMA 50
```

## 20.2 Momentum

```text
RSI 14
MACD 12/26/9
Rate of Change
Stochastic oscillator
```

## 20.3 Volatility

```text
ATR 14
Bollinger Bands 20/2
rolling standard deviation
```

## 20.4 Volume

```text
Average volume 20
Relative volume
OBV
```

## 20.5 Price Structure

```text
20-day high
20-day low
52-week high
52-week low
distance from high
distance from SMA 50
distance from SMA 200
recent swing high
recent swing low
```

---

# 21. Indicator Calculation Rules

## 21.1 Determinism

For identical input candles and parameters, output must be identical.

## 21.2 Warm-Up Period

An SMA200 calculation requires enough preceding observations.

The system must not present an incomplete indicator as valid.

Example:

```text
SMA200 status = INSUFFICIENT_HISTORY
```

rather than:

```text
SMA200 = 0
```

## 21.3 Recalculation

Daily indicator job:

```text
only recalculate affected trailing window when possible
```

For simplicity V1 may recalculate full recent windows because the workload is small.

---

# 22. Watchlist Model

Each watchlist item should show:

```text
Symbol
Company
Price
Daily %
Volume
Relative Volume
RSI
MACD state
50 SMA
200 SMA
Distance from 50 SMA
Distance from 52-week high
Entry Score
Signal State
Last Trigger
Notes
```

States:

```text
NO_SETUP
WATCH
APPROACHING
ENTRY
STRONG_ENTRY
INVALIDATED
```

These labels are analytical categories, not guarantees of investment success.

---

# 23. Entry Scoring Engine

The scoring engine must be configurable and versioned.

Do not hardcode business logic into UI components.

Example model:

```yaml
name: default_swing_entry
version: 1

score:
  max: 100

components:

  trend:
    weight: 30
    rules:
      - condition: price > sma_200
        points: 10

      - condition: sma_50 > sma_200
        points: 10

      - condition: price > sma_50
        points: 5

      - condition: sma_50_slope > 0
        points: 5

  momentum:
    weight: 25
    rules:
      - condition: rsi_14 >= 45 and rsi_14 <= 65
        points: 10

      - condition: macd > macd_signal
        points: 10

      - condition: rsi_14 > rsi_14_prev_5
        points: 5

  setup:
    weight: 25
    rules:
      - condition: abs(price - sma_50) / sma_50 <= 0.03
        points: 10

      - condition: close > high_20_prev
        points: 10

      - condition: distance_to_support <= 0.10
        points: 5

  volume:
    weight: 20
    rules:
      - condition: relative_volume >= 1.3
        points: 10

      - condition: obv_slope > 0
        points: 10
```

---

# 24. Score Classification

Suggested defaults:

```text
0-49      NO_SETUP
50-64     WATCH
65-79     APPROACHING
80-89     ENTRY
90-100    STRONG_ENTRY
```

Thresholds must be configurable.

---

# 25. Portfolio-Aware Signal Adjustment

A key differentiator is evaluating an opportunity in portfolio context.

Example:

```text
Raw CRDO Entry Score                 88

Portfolio context:
Semiconductor exposure              19%
Technology exposure                 34%
CRDO correlation with portfolio     0.73

Concentration adjustment            -7

Portfolio-aware score               81
```

This should be a separate score, not silently modify the raw technical score.

UI must show:

```text
Technical Score
Portfolio Fit Score
Combined Score
```

V1 may initially calculate only Technical Score.

Portfolio Fit belongs in V2.

---

# 26. Signal Events

A score calculation is not automatically an event.

Generate an event when:

- score crosses a threshold;
- key condition becomes true;
- key condition becomes false;
- rank changes materially.

Example:

```text
CRDO
score 78 -> 84
state APPROACHING -> ENTRY
```

Store the entire input snapshot so historical signal behavior can be audited later.

---

# 27. Alert Rule Engine

Alerts require a small domain-specific rule format.

Example:

```json
{
  "all": [
    {
      "field": "price",
      "operator": ">",
      "value": 150
    },
    {
      "field": "rsi_14",
      "operator": "<",
      "value": 65
    },
    {
      "field": "macd",
      "operator": ">",
      "field_ref": "macd_signal"
    }
  ]
}
```

Supported logical operators:

```text
all
any
not
```

Supported comparison operators:

```text
>
>=
<
<=
==
!=
crosses_above
crosses_below
between
percent_above
percent_below
```

---

# 28. Alert Types

## 28.1 Price Alerts

Examples:

```text
AAPL > 220
AAPL < 190
AAPL moves +5% today
AAPL falls 8% from 30-day high
```

## 28.2 Technical Alerts

Examples:

```text
RSI crosses below 30
RSI crosses above 50
MACD crosses above signal
price crosses above SMA50
SMA50 crosses above SMA200
relative volume exceeds 1.5
```

## 28.3 Compound Alerts

Example:

```text
price > SMA200
AND
RSI between 45 and 65
AND
MACD bullish
AND
relative volume > 1.2
```

## 28.4 Portfolio Alerts

Examples:

```text
single position > 10% of portfolio
technology sector > 35%
portfolio drawdown > 8%
cash < 3%
daily loss > 2%
```

## 28.5 Data/Operational Alerts

Examples:

```text
market data stale
provider unavailable
daily bar missing
database backup failed
disk usage > 80%
```

---

# 29. Alert State Machine

Required:

```text
              condition true
ARMED ------------------------------> TRIGGERED
  ^                                      |
  |                                      |
  |                              notification sent
  |                                      |
  |                                      v
  |                                  COOLDOWN
  |                                      |
  |                         cooldown expires AND
  |                           reset condition true
  +--------------------------------------+
```

Possible states:

```text
ARMED
TRIGGERED
COOLDOWN
DISABLED
ERROR
```

An alert must not fire every polling cycle.

---

# 30. Alert Hysteresis

For noisy thresholds, allow reset rules.

Example:

```text
Trigger:
RSI crosses below 30

Re-arm:
RSI > 35
```

This avoids repeated alerts around 30.

---

# 31. Notification Channels

V1:

```text
Dashboard
Telegram
```

Optional:

```text
Email
```

Notification payload example:

```text
WATCHLIST SIGNAL

CRDO
Entry score: 78 -> 84
State: ENTRY

Price: $143.20

+ Above SMA50
+ Above SMA200
+ MACD bullish
+ RSI: 58.2
+ Relative volume: 1.42x

Trigger:
Breakout above 20-day high

Data:
Alpaca / 2026-09-09 10:42 ET
```

---

# 32. Notification Delivery Requirements

Every notification must be persisted before delivery.

Status:

```text
PENDING
SENT
FAILED
RETRY
```

Retry policy:

```text
attempt 1 immediately
attempt 2 after 30 sec
attempt 3 after 2 min
attempt 4 after 10 min
```

Do not retry indefinitely.

---

# 33. Market Regime Engine

V2 feature.

Potential inputs:

```text
SPY vs SMA200
QQQ vs SMA200
market breadth if available
10Y Treasury yield
2Y Treasury yield
2Y/10Y curve
credit spread series
volatility proxy
Fed Funds Rate
```

Possible output:

```text
RISK_ON
NEUTRAL
RISK_OFF
```

The engine must explain why.

Example:

```text
Market Regime: NEUTRAL

Positive:
+ SPY above 200DMA
+ QQQ above 200DMA

Negative:
- credit spreads widening
- 10Y yield rising rapidly
```

---

# 34. Risk Analytics

Required V1/V1.5 metrics:

```text
position concentration
top-5 concentration
sector concentration
daily volatility
rolling 30-day volatility
maximum drawdown
current drawdown
beta vs benchmark
correlation vs benchmark
holding correlations
```

V2:

```text
Sharpe ratio
Sortino ratio
tracking error
information ratio
historical VaR
expected shortfall
factor approximations
```

---

# 35. Maximum Drawdown

Calculate:

```text
running_peak = cumulative max(portfolio_value)

drawdown =
(portfolio_value - running_peak) / running_peak
```

Store:

```text
current drawdown
maximum drawdown
drawdown start date
trough date
recovery date
```

---

# 36. Concentration Risk

Examples:

```text
Largest holding:             12.4%
Top 5 holdings:              41.7%
Technology:                  33.2%
Semiconductors:              18.5%
```

Thresholds configurable:

```yaml
risk_limits:
  max_single_position: 0.12
  max_top5: 0.50
  max_sector: 0.35
```

Trigger dashboard warning when exceeded.

---

# 37. Correlation Engine

Use daily returns.

Minimum observations:

```text
60 trading days
```

Preferred:

```text
126 or 252 trading days
```

Correlation matrix should be computed on demand or periodically, not on every page request.

Cache results in Redis or PostgreSQL.

---

# 38. Fundamental Data Engine

V2/V3.

SEC XBRL-derived metrics may include:

```text
revenue
net income
EPS
operating income
cash
debt
operating cash flow
capex
free cash flow
gross margin
operating margin
revenue growth
EPS growth
```

Do not assume every issuer uses identical XBRL concepts.

A mapping/normalization layer is required.

---

# 39. Frontend Information Architecture

Primary navigation:

```text
Overview
Portfolio
Watchlists
Signals
Alerts
Analytics
Market
Settings
System
```

---

# 40. Overview Page

Widgets:

```text
Portfolio value
Daily P/L
Total P/L
YTD return
Portfolio vs benchmark chart
Allocation
Top movers
Recent alerts
Top watchlist signals
Market regime
Data health
```

Example:

```text
+-----------------------------------------------------+
| PORTFOLIO VALUE                    $684,320          |
| Today                              +0.63%            |
| YTD                                +8.84%            |
+-----------------------------------------------------+

+--------------------------+--------------------------+
| Performance              | Allocation               |
| chart                    | donut                    |
+--------------------------+--------------------------+

+--------------------------+--------------------------+
| Top Signals              | Alerts                   |
+--------------------------+--------------------------+
```

---

# 41. Portfolio Page

Columns:

```text
Symbol
Name
Quantity
Price
Market Value
Weight
Average Cost
Cost Basis
Today %
Today P/L
Unrealized P/L
Total Return
RSI
Trend
Signal Score
```

Features:

- sorting;
- filtering;
- CSV export;
- responsive layout;
- click row -> position detail.

---

# 42. Position Detail Page

Sections:

```text
Header
Price chart
Portfolio position
Performance
Technical indicators
Signal history
Transactions
Alerts
Risk contribution
Fundamentals (future)
```

Chart overlays:

```text
SMA20
SMA50
SMA200
volume
```

Lower panels:

```text
RSI
MACD
```

---

# 43. Watchlist Page

Columns:

```text
Symbol
Price
Daily %
RSI
MACD
SMA50 status
SMA200 status
Rel Volume
52W Distance
Entry Score
State
Last Signal
```

Filters:

```text
score >= X
state
sector
RSI range
above/below SMA
recent trigger
```

Sorting by `Entry Score` should be a core workflow.

---

# 44. Signal Center

Primary purpose:

Rank current setups.

Example:

```text
1. CRDO       91   STRONG_ENTRY
2. VRT        88   ENTRY
3. ANET       84   ENTRY
4. TSM        77   APPROACHING
5. ASML       72   APPROACHING
```

Each signal opens an explanation drawer.

Signal history:

```text
timestamp
symbol
old state
new state
old score
new score
reason
```

---

# 45. Alerts Page

Tabs:

```text
Active
Triggered
History
Templates
```

Create alert wizard:

```text
Step 1: security/portfolio
Step 2: condition
Step 3: reset/cooldown
Step 4: notification channel
Step 5: summary
```

---

# 46. Analytics Page

Sections:

```text
Performance
Drawdown
Risk
Correlation
Concentration
Benchmark comparison
Sector exposure
Security contribution
```

---

# 47. Market Page

V2.

Widgets:

```text
SPY trend
QQQ trend
rates
yield curve
macro indicators
market regime
```

---

# 48. System Page

Important for self-hosted reliability.

Display:

```text
Backend version
Frontend version
Database health
Redis health
Disk usage
RAM
CPU temperature
Last backup
Scheduler status
Provider status
Last successful market-data update
Job failures
API-rate usage
```

---

# 49. API Design

Base:

```text
/api/v1
```

## 49.1 Portfolios

```text
GET    /api/v1/portfolios
POST   /api/v1/portfolios
GET    /api/v1/portfolios/{id}
PATCH  /api/v1/portfolios/{id}
```

## 49.2 Transactions

```text
GET    /api/v1/portfolios/{id}/transactions
POST   /api/v1/portfolios/{id}/transactions
GET    /api/v1/transactions/{id}
PATCH  /api/v1/transactions/{id}
DELETE /api/v1/transactions/{id}
```

Deletion should be audited.

## 49.3 Positions

```text
GET /api/v1/portfolios/{id}/positions
GET /api/v1/portfolios/{id}/positions/{symbol}
```

## 49.4 Performance

```text
GET /api/v1/portfolios/{id}/performance
```

Parameters:

```text
start
end
interval
benchmark
```

## 49.5 Watchlists

```text
GET    /api/v1/watchlists
POST   /api/v1/watchlists
GET    /api/v1/watchlists/{id}
PATCH  /api/v1/watchlists/{id}
DELETE /api/v1/watchlists/{id}

POST   /api/v1/watchlists/{id}/items
DELETE /api/v1/watchlists/{id}/items/{symbol}
```

## 49.6 Securities

```text
GET /api/v1/securities/search?q=
GET /api/v1/securities/{symbol}
```

## 49.7 Market Data

```text
GET /api/v1/market/{symbol}/quote
GET /api/v1/market/{symbol}/bars
```

## 49.8 Indicators

```text
GET /api/v1/market/{symbol}/indicators
```

## 49.9 Signals

```text
GET /api/v1/signals
GET /api/v1/signals/{symbol}
GET /api/v1/signals/{symbol}/history
```

## 49.10 Alerts

```text
GET    /api/v1/alerts
POST   /api/v1/alerts
GET    /api/v1/alerts/{id}
PATCH  /api/v1/alerts/{id}
DELETE /api/v1/alerts/{id}

POST   /api/v1/alerts/{id}/acknowledge
POST   /api/v1/alerts/{id}/disable
POST   /api/v1/alerts/{id}/enable
```

## 49.11 Analytics

```text
GET /api/v1/analytics/risk
GET /api/v1/analytics/correlation
GET /api/v1/analytics/drawdown
GET /api/v1/analytics/concentration
```

## 49.12 System

```text
GET /api/v1/system/health
GET /api/v1/system/providers
GET /api/v1/system/jobs
GET /api/v1/system/data-status
```

---

# 50. API Response Envelope

Recommended:

```json
{
  "data": {},
  "meta": {
    "timestamp": "2026-09-09T14:02:12Z",
    "request_id": "..."
  }
}
```

Errors:

```json
{
  "error": {
    "code": "MARKET_DATA_STALE",
    "message": "Latest quote is older than allowed freshness threshold.",
    "details": {}
  },
  "meta": {
    "request_id": "..."
  }
}
```

---

# 51. Authentication

Cloudflare Access should be the primary external access gate.

Application-level identity should still exist.

Recommended V1:

```text
Cloudflare Access
+
trusted authenticated email/header
+
application session
```

Do not trust arbitrary identity headers unless requests can only reach the app through the protected tunnel path.

Prefer Cloudflare Access token validation.

---

# 52. Cloudflare Deployment

Cloudflare Tunnel uses `cloudflared`.

ARM64 builds and Docker images are available.

The tunnel should create outbound-only connections.

No router port forwarding should be required.

Official documentation:

https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/

Recommended domain:

```text
portfolio.example.com
```

Cloudflare Access policy:

```text
DENY by default
ALLOW only configured user identity
```

Where possible:

- require MFA at identity provider;
- set reasonable session lifetime;
- enable Access token validation.

---

# 53. Docker Compose Topology

Production services:

```yaml
services:

  frontend:
    build: ./frontend
    restart: unless-stopped

  api:
    build: ./backend
    restart: unless-stopped
    depends_on:
      - postgres
      - redis

  worker:
    build: ./backend
    command: python -m app.workers.scheduler
    restart: unless-stopped
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared
    restart: unless-stopped
```

Pin image versions in production rather than using floating `latest` tags.

---

# 54. Raspberry Pi Resource Budget

Target steady-state:

```text
PostgreSQL     ~ several hundred MB RAM
Redis          < 100 MB for this workload
FastAPI        ~ 100-300 MB
Worker         ~ 200-700 MB depending on pandas operations
Frontend       negligible after serving static build
cloudflared    low
OS             remaining
```

Avoid loading the full historical dataset into memory.

Process symbols in batches.

---

# 55. Caching Strategy

Redis cache candidates:

```text
latest quote
portfolio summary
watchlist ranking
indicator summary
provider rate state
market session state
```

Suggested TTL:

```text
quote                       30-120 sec
portfolio summary           30 sec
watchlist score             1-5 min
daily indicator summary     until next calculation
reference data              24h+
```

PostgreSQL remains authoritative.

---

# 56. Rate Limit Management

Each provider adapter should expose rate-limit awareness.

Implement:

```text
token bucket or simple request budget
retry-after support
exponential backoff
jitter
```

Massive free plan constraint is particularly important because of its low request rate.

Batch operations where provider APIs permit.

Do not poll unchanged metadata repeatedly.

---

# 57. Data Retention

Suggested:

```text
Daily bars:          permanent
5-minute bars:       2 years
1-minute bars:       90-180 days
quotes:              do not persist every quote indefinitely
signal events:       permanent
alert events:        permanent
portfolio snapshots: permanent
job logs:            90 days
```

Retention should be configurable.

---

# 58. Backups

Minimum:

```text
nightly PostgreSQL dump
```

Retention:

```text
7 daily
4 weekly
6 monthly
```

Backup location should preferably not be only on the same physical disk.

V1 options:

- local secondary USB;
- encrypted NAS destination;
- manually synchronized encrypted backup.

Backups must be tested through periodic restore drills.

---

# 59. Logging

Use structured JSON logging.

Each record should include where applicable:

```text
timestamp
level
service
request_id
job_id
symbol
portfolio_id
provider
event
message
duration_ms
```

Never log:

```text
API secrets
Cloudflare credentials
Telegram token
database password
```

---

# 60. Metrics and Health

Minimum application health:

```text
/api/v1/system/health
```

Return:

```json
{
  "status": "healthy",
  "database": "healthy",
  "redis": "healthy",
  "scheduler": "healthy",
  "providers": {
    "alpaca": "healthy",
    "massive": "healthy"
  }
}
```

Health must distinguish degraded from unavailable.

---

# 61. Data Gap Detection

Daily job:

For each tracked symbol:

```text
expected trading dates
MINUS
stored daily bars
```

Any missing date becomes a data repair job.

Intraday gaps should be detected only during relevant sessions.

---

# 62. Error Handling

Provider exceptions should map to domain errors:

```text
ProviderRateLimited
ProviderAuthenticationFailed
ProviderUnavailable
DataNotFound
DataStale
InvalidMarketData
```

UI should never display raw Python stack traces.

---

# 63. Testing Strategy

## 63.1 Unit Tests

Required for:

```text
cost basis
position reconstruction
TWR
XIRR
drawdown
technical indicators
signal scoring
alert condition evaluation
alert state machine
data normalization
```

## 63.2 Golden Dataset Tests

Use known OHLCV samples and expected indicator values.

Example:

```text
input.csv
expected_indicators.json
```

This prevents accidental changes after refactoring.

## 63.3 Provider Contract Tests

Each adapter must be tested against recorded provider responses.

Do not require live APIs for every CI run.

## 63.4 Integration Tests

Test:

```text
transaction -> position
price -> portfolio value
bar ingestion -> indicators
indicators -> signal
signal -> alert
alert -> notification
```

## 63.5 End-to-End Tests

Critical flows:

```text
create portfolio
add transaction
add watchlist item
create alert
view signal
```

---

# 64. Financial Calculation Validation

Before V1 is considered reliable, compare at least a sample of:

```text
position quantities
cost basis
market value
daily gain
total gain
portfolio return
```

against an external broker/account statement or manually verified spreadsheet.

Tolerance must be defined.

Example:

```text
share quantity: exact
currency amounts: <= $0.01 where appropriate
return differences: explainable by timing/price source
```

---

# 65. Corporate Actions

Splits and dividends are a major correctness requirement.

The system must not simply overwrite historical prices without understanding adjustment status.

Store:

```text
raw price
adjustment state
corporate action
```

Clearly define whether indicators are calculated from:

```text
split-adjusted bars
```

Recommended:

Use adjusted historical series for long-horizon technical calculations where available and consistently documented.

---

# 66. Time Zones

Database:

```text
UTC
```

Market logic:

```text
America/New_York
```

User display:

```text
Asia/Jerusalem
```

Do not encode market open as a fixed UTC hour because US daylight-saving rules shift relative to Israel.

---

# 67. Currency

V1 focus:

```text
USD securities
```

Database must still store currency.

Future support:

```text
ILS
EUR
GBP
```

A future FX provider can normalize portfolio base currency.

Do not pretend mixed-currency returns are accurate until FX normalization exists.

---

# 68. Security Requirements

Minimum:

1. No public inbound Pi ports.
2. Cloudflare Access in front of dashboard.
3. HTTPS only externally.
4. Secrets excluded from Git.
5. Database not exposed outside Docker/private host network.
6. Redis not exposed outside Docker/private host network.
7. Least-privilege DB user.
8. Dependency updates.
9. Container restart policies.
10. Audit log for portfolio edits and alert changes.
11. CSRF protection if cookie-authenticated state-changing endpoints are used.
12. CORS locked to dashboard origin.
13. Secure cookies.
14. Rate limit sensitive API routes.

---

# 69. Audit Log

Recommended table:

```text
audit_events

id
user_id
timestamp
action
entity_type
entity_id
before JSONB
after JSONB
request_id
```

Audit:

```text
transaction creation/edit/deletion
portfolio settings
alert rule changes
watchlist changes
security-sensitive settings
```

---

# 70. UI Design Principles

The dashboard should prioritize:

```text
answer first
details on demand
```

Good:

```text
CRDO
ENTRY 86
MACD bullish
RSI 58
+1.42x volume
```

Then expand for details.

Avoid overwhelming the overview page with every technical indicator.

---

# 71. Responsive Design

Primary devices:

```text
Desktop browser
iPad landscape
iPad portrait
Mobile browser
```

Tables should convert to cards or horizontally scroll on small screens.

Important actions must not depend on hover.

---

# 72. Charting

Use interactive financial charts.

Required:

```text
candlestick
volume
SMA overlays
crosshair
time range selector
```

Ranges:

```text
1D
5D
1M
3M
6M
YTD
1Y
3Y
5Y
MAX
```

Intraday availability depends on stored/provider history.

---

# 73. Smart Explanation Layer

V2/V3.

The system can generate deterministic text explanations without an LLM.

Example:

```text
Why CRDO is ranked highly:

- Price is above both 50-day and 200-day averages.
- The 50-day average is rising.
- RSI is 58, inside the configured momentum range.
- MACD crossed above its signal line two sessions ago.
- Today's relative volume is 1.42x.
- Price has broken the prior 20-day high.
```

This should be the default explanation layer.

An optional local LLM may later summarize these facts, but the LLM must not be the source of the calculations.

---

# 74. Optional Local AI Layer

Future, optional.

A small local model may consume structured JSON such as:

```json
{
  "symbol": "CRDO",
  "technical_score": 86,
  "rsi": 58.2,
  "macd_state": "bullish",
  "relative_volume": 1.42,
  "price_vs_sma50_pct": 3.1
}
```

and produce a natural-language summary.

Guardrail:

```text
LLM explanation != trading calculation
```

All calculations must come from deterministic engines.

---

# 75. V1 Feature Scope

V1 should be deployable and useful.

## MUST HAVE

### Infrastructure

- Docker Compose
- PostgreSQL
- Redis
- FastAPI
- React
- Cloudflare Tunnel
- Cloudflare Access

### Portfolio

- portfolio creation
- transaction entry
- current positions
- cost basis
- market value
- daily P/L
- unrealized P/L
- total return
- historical snapshots
- benchmark comparison

### Market Data

- Alpaca adapter
- Massive adapter
- daily OHLCV
- current quote
- data quality/freshness
- provider health

### Technical Analysis

- SMA20
- SMA50
- SMA200
- EMA9
- EMA21
- RSI14
- MACD
- ATR
- Bollinger Bands
- 20-day high
- 52-week high
- relative volume

### Watchlists

- create watchlist
- add/remove symbols
- table
- ranking
- technical score

### Signals

- default entry score
- score explanation
- state transitions
- history

### Alerts

- price rules
- indicator rules
- compound rules
- cooldown
- dashboard notification
- Telegram notification
- alert history

### Analytics

- allocation
- concentration
- drawdown
- volatility
- portfolio vs benchmark

### Operations

- health page
- job history
- backups
- logs
- data-gap detection

---

# 76. V1.5 Scope

After V1 proves stable:

- TWR;
- XIRR;
- correlation matrix;
- sector exposure;
- better portfolio attribution;
- alert templates;
- CSV transaction import;
- additional chart overlays;
- market-calendar improvements;
- external backup target;
- portfolio risk rules.

---

# 77. V2 Scope

- FRED macro dashboard;
- market regime model;
- SEC fundamentals;
- portfolio-aware entry score;
- risk contribution;
- watchlist portfolios/tags;
- advanced signal models;
- backtesting;
- strategy version comparison;
- dividend analytics;
- multiple benchmarks.

---

# 78. V3 Scope

Potential:

- broker read-only synchronization;
- advanced fundamental ranking;
- local AI explanation assistant;
- natural-language alert creation;
- news/event integration;
- factor analytics;
- tax-lot analytics.

Automated trade execution should remain a separate project with a much stricter safety, testing, and authorization architecture.

---

# 79. Implementation Milestones

## Milestone 0 — Repository and Pi

Deliverables:

```text
Git repository
Docker installed
Compose skeleton
PostgreSQL healthy
Redis healthy
FastAPI health endpoint
React page
Cloudflare access working
```

Acceptance:

```text
https://portfolio.example.com
```

opens only after Cloudflare authentication.

## Milestone 1 — Market Data

Deliverables:

```text
Security table
Alpaca adapter
Massive adapter
daily bars
latest quote
provider health
gap detector
```

Acceptance:

For 10 sample tickers:

```text
latest quote visible
1 year daily chart visible
missing-data check passes
```

## Milestone 2 — Portfolio Accounting

Deliverables:

```text
portfolio
accounts
transactions
position rebuild
P/L
portfolio snapshot
```

Acceptance:

Manually verified sample transactions match expected holdings/cost basis.

## Milestone 3 — Dashboard

Deliverables:

```text
Overview
Portfolio
Position detail
Performance chart
Allocation
```

## Milestone 4 — Technical Engine

Deliverables:

```text
indicators
indicator tests
technical panels
```

Acceptance:

Indicator values checked against trusted reference calculations.

## Milestone 5 — Watchlist + Signals

Deliverables:

```text
watchlists
score engine
score explanation
signal history
ranking
```

## Milestone 6 — Alerts

Deliverables:

```text
rule engine
state machine
Telegram
alert UI
```

## Milestone 7 — Risk

Deliverables:

```text
drawdown
volatility
concentration
benchmark analytics
```

## Milestone 8 — Production Hardening

Deliverables:

```text
backup
restore test
logging
job monitoring
data reconciliation
security review
documentation
```

---

# 80. V1 Acceptance Criteria

V1 is complete only if all are true.

## Portfolio

- [ ] transaction ledger reconstructs holdings correctly
- [ ] cost basis validated
- [ ] daily P/L validated
- [ ] current market value validated
- [ ] benchmark chart works

## Market Data

- [ ] provider abstraction works
- [ ] Alpaca is not referenced directly by portfolio engine
- [ ] missing bars detected
- [ ] stale quote identified
- [ ] provider outage does not crash dashboard

## Technical

- [ ] indicators have unit/golden tests
- [ ] insufficient history handled correctly
- [ ] signals show explanations
- [ ] score versions are stored

## Alerts

- [ ] threshold alert triggers once
- [ ] cooldown prevents repeated notifications
- [ ] re-arm works
- [ ] failed Telegram delivery is persisted/retried

## Infrastructure

- [ ] Pi reboot recovers automatically
- [ ] containers restart
- [ ] database persists
- [ ] no router inbound port forwarding
- [ ] Cloudflare Access protects application
- [ ] backup completes
- [ ] restore has been tested

---

# 81. Initial Default Watchlist Strategy

The following is a technical-scoring template, not financial advice.

Trend:

```text
30 points
```

Momentum:

```text
25 points
```

Setup:

```text
25 points
```

Volume:

```text
20 points
```

Initial thresholds:

```text
NO_SETUP       < 50
WATCH          50-64
APPROACHING    65-79
ENTRY          80-89
STRONG_ENTRY   >= 90
```

The dashboard must allow future strategies to coexist.

Example:

```text
default_swing_v1
pullback_v1
breakout_v1
trend_following_v1
```

Do not overwrite historical strategy definitions.

---

# 82. Example Alert Definitions

## 82.1 Moving Average Recovery

```yaml
name: Recover SMA50

all:
  - crosses_above:
      left: close
      right: sma_50

  - condition:
      left: close
      operator: ">"
      right: sma_200

cooldown: 24h
```

## 82.2 Pullback Setup

```yaml
name: Pullback to SMA50

all:

  - condition:
      left: close
      operator: ">"
      right: sma_200

  - percent_distance:
      left: close
      right: sma_50
      max_abs: 0.03

  - between:
      field: rsi_14
      min: 40
      max: 60
```

## 82.3 Breakout

```yaml
name: 20D Breakout + Volume

all:

  - condition:
      left: close
      operator: ">"
      right: previous_20d_high

  - condition:
      left: relative_volume
      operator: ">="
      value: 1.5
```

---

# 83. Example Signal Record

```json
{
  "symbol": "CRDO",
  "timestamp": "2026-09-09T14:42:00Z",
  "model": "default_swing_v1",
  "score": 86,
  "state": "ENTRY",
  "components": {
    "trend": {
      "score": 30,
      "max": 30
    },
    "momentum": {
      "score": 21,
      "max": 25
    },
    "setup": {
      "score": 20,
      "max": 25
    },
    "volume": {
      "score": 15,
      "max": 20
    }
  },
  "facts": {
    "price": 143.2,
    "sma_50": 137.42,
    "sma_200": 119.81,
    "rsi_14": 58.2,
    "relative_volume": 1.42
  }
}
```

---

# 84. Example Portfolio Summary API

```json
{
  "data": {
    "portfolio_id": "uuid",
    "base_currency": "USD",
    "market_value": 684320.00,
    "cash": 31200.00,
    "total_value": 715520.00,
    "day_pnl": 4272.00,
    "day_return": 0.0063,
    "unrealized_pnl": 81244.00,
    "ytd_return": 0.0884,
    "benchmark": {
      "symbol": "SPY",
      "ytd_return": 0.0712,
      "relative_return": 0.0172
    },
    "data_quality": {
      "status": "healthy",
      "latest_price_age_seconds": 18
    }
  }
}
```

---

# 85. Performance Considerations

Expected scale:

```text
portfolio holdings:        < 100
watchlist symbols:         < 500
daily candles:             millions at most over long life
intraday active symbols:   tens to low hundreds
users:                      1 initially
```

This is easily compatible with PostgreSQL on a Pi if indexing and retention are sensible.

Indexes:

```text
price_bars(security_id, timeframe, timestamp DESC)
signal_events(security_id, timestamp DESC)
alert_events(alert_rule_id, triggered_at DESC)
transactions(account_id, trade_date)
portfolio_snapshots(portfolio_id, timestamp DESC)
```

---

# 86. Graceful Degradation

If Alpaca current data fails:

```text
Dashboard still opens.
Historical data remains available.
Portfolio shows last known price with STALE marker.
Signal engine does not claim fresh intraday triggers.
Alert system suppresses freshness-dependent alerts.
Provider health becomes DEGRADED.
```

This behavior is mandatory.

---

# 87. API Budget Guard

Maintain daily counters.

Example:

```text
provider_requests

provider
date
endpoint_class
requests
errors
```

Dashboard:

```text
API USAGE

Alpaca       4,218 today
Massive         47 today
FRED             3 today
SEC             12 today
```

A provider adapter should prevent accidental rate storms.

---

# 88. Upgrade Decision Policy

Do not pay for a data provider just because one screen would be slightly fresher.

A paid upgrade is justified only if:

1. a required use case cannot be reliably implemented with current free data;
2. the limitation materially harms the dashboard;
3. no acceptable free source exists;
4. monthly cost remains <= $20.

Because current commonly considered US-stock upgrades exceed this budget, architecture should optimize around free feeds unless the budget policy changes.

---

# 89. Definition of "Smart"

The dashboard should not merely display data.

It should answer:

```text
What changed?
Why did it matter?
Does it affect my portfolio?
Is a watchlist setup approaching?
What rule fired?
How strong is the setup?
What portfolio risk would the new position add?
Is the underlying data fresh?
```

Example:

```text
CRDO moved from APPROACHING to ENTRY.

Reason:
- price closed above previous 20-day high
- MACD remains bullish
- RSI increased from 52 to 58
- relative volume rose to 1.42x

Technical score:
78 -> 86

Portfolio context:
Semiconductor exposure is already elevated.

Data status:
Current.
```

That is the product vision.

---

# 90. Recommended First Coding Order

Use this exact order:

```text
01 infrastructure
02 database schema
03 security master
04 market provider abstraction
05 Alpaca provider
06 daily bar ingestion
07 latest quote service
08 Massive backup provider
09 data validation
10 transaction ledger
11 position engine
12 portfolio valuation
13 portfolio snapshots
14 frontend overview
15 position pages
16 indicator engine
17 watchlists
18 signal engine
19 alert rule engine
20 Telegram notifications
21 risk analytics
22 operations/health
23 backup/restore
24 production hardening
```

Do not build the AI layer before the deterministic engines are stable.

---

# 91. Development Standards

Backend:

```text
type hints required
Pydantic schemas at API boundaries
repository/service separation
async HTTP calls
database migrations
structured logs
tests for financial calculations
```

Frontend:

```text
strict TypeScript
API types
reusable components
error/loading states
responsive design
no business calculations in UI
```

Infrastructure:

```text
version-pinned images
health checks
restart policies
persistent volumes
documented restore process
```

---

# 92. Coding Conventions

Python:

```text
ruff
black or ruff formatter
pytest
mypy/pyright optional but recommended
```

TypeScript:

```text
eslint
prettier
vitest
```

Commit convention optional:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

---

# 93. Definition of Done per Feature

A feature is not complete until:

- [ ] backend implemented
- [ ] validation implemented
- [ ] relevant UI implemented
- [ ] loading state implemented
- [ ] failure state implemented
- [ ] tests added
- [ ] logs added
- [ ] documentation updated
- [ ] mobile/iPad behavior checked
- [ ] security implications reviewed

---

# 94. Important Accuracy Rules

The application must never:

1. treat a stale quote as live without marking it;
2. turn missing data into zero;
3. calculate indicators on insufficient history without marking them invalid;
4. silently mix adjusted and unadjusted time series;
5. calculate mixed-currency portfolio totals without FX conversion;
6. claim IEX-only data represents the full consolidated market;
7. fire the same alert repeatedly without cooldown/re-arm logic;
8. let a provider-specific object leak into portfolio business logic;
9. use an LLM-generated number in portfolio/accounting calculations;
10. delete transaction history without auditability.

---

# 95. Operational Runbook

## After Pi reboot

Docker should automatically restore:

```text
postgres
redis
api
worker
frontend
cloudflared
```

Check:

```text
System -> Health
```

Expected:

```text
Database      healthy
Redis         healthy
Worker        healthy
Tunnel        connected
Alpaca        healthy
Massive       healthy
```

## Provider failure

1. Mark provider degraded.
2. Stop freshness-dependent signals if necessary.
3. Attempt configured fallback.
4. Record incident.
5. Notify only if outage exceeds configured duration.

## Database failure

1. Stop writes.
2. Dashboard enters degraded mode.
3. Do not reconstruct state from Redis.
4. Restore DB service.
5. Validate migration/version.
6. Verify latest snapshot.

---

# 96. Backup Restore Procedure

At minimum, document:

```text
1 stop API and worker
2 provision empty PostgreSQL database
3 restore latest pg_dump
4 run schema/version check
5 run consistency checks
6 rebuild derived positions
7 restart application
8 compare portfolio summary to pre-backup snapshot
```

A backup that has never been restored is not considered verified.

---

# 97. Future Broker Integration

If broker integration is later implemented, start as:

```text
READ ONLY
```

Functions:

```text
import transactions
reconcile positions
import cash balance
```

The broker should not become the only local history.

Local normalized transaction history remains important.

Order placement requires a separate design review.

---

# 98. Sources / Current Service Constraints

These URLs should be re-checked before implementation because provider plans can change.

## Alpaca

Market Data API documentation:

https://docs.alpaca.markets/us/docs/about-market-data-api

Relevant current constraints used in this design:

- Basic plan is free.
- Equities real-time coverage is IEX on Basic.
- WebSocket symbol count is limited on Basic.
- Historical data is available from 2016.
- Recent historical data has a free-tier restriction.
- API call limits apply.

## Massive

Stocks pricing:

https://massive.com/pricing?product=stocks

Relevant current constraints used in this design:

- Stocks Basic is free.
- Five API calls/minute.
- Two years of history.
- End-of-day market data.
- Reference data.
- Corporate actions.
- Paid Stocks Starter currently exceeds the project's $20/month ceiling.

## SEC EDGAR

https://www.sec.gov/search-filings/edgar-application-programming-interfaces

Relevant:

- `data.sec.gov` REST APIs.
- Filing/submission history.
- XBRL financial statement data.
- No API key required for these public data APIs.

## FRED

https://fred.stlouisfed.org/docs/api/fred/

Relevant:

- macroeconomic data API;
- API key required.

## Cloudflare Tunnel

https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/

Downloads:

https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/

Relevant:

- `cloudflared` creates outbound-only connections;
- ARM/ARM64 builds are available;
- Docker deployment is available.

## Cloudflare Access

https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/

Relevant:

- Access can protect a self-hosted application before traffic reaches the origin;
- Access applications are deny-by-default unless an allow policy matches;
- Access token validation should be enabled at the origin/tunnel layer.

---

# 99. Final Recommended V1 Architecture

```text
Raspberry Pi 5
|
|-- Docker Compose
|
|-- frontend
|   `-- React + TypeScript
|
|-- api
|   `-- FastAPI
|
|-- worker
|   |-- APScheduler
|   |-- data ingestion
|   |-- indicators
|   |-- signals
|   `-- alerts
|
|-- PostgreSQL
|
|-- Redis
|
`-- cloudflared
```

Data:

```text
Alpaca
   |
   +--> current market data
   +--> historical prices

Massive
   |
   +--> EOD/reference backup
   +--> corporate actions

FRED
   |
   `--> macro context

SEC
   |
   `--> fundamentals
```

Decision pipeline:

```text
MARKET DATA
    |
    v
NORMALIZATION
    |
    v
LOCAL DATABASE
    |
    +------------------------+
    |                        |
    v                        v
PORTFOLIO ENGINE       INDICATOR ENGINE
    |                        |
    |                        v
    |                   SIGNAL ENGINE
    |                        |
    +------------+-----------+
                 |
                 v
          ALERT ENGINE
                 |
          +------+------+
          |             |
          v             v
      DASHBOARD      TELEGRAM
```

The most important architectural rule is:

> **Market-data providers supply facts. Deterministic local engines perform portfolio accounting, technical calculations, scoring, and alert decisions.**

This preserves auditability, portability, and long-term control of the system.

---

# 100. Next Implementation Artifact

After this specification, the recommended next artifact is a repository bootstrap containing:

```text
docker-compose.yml
.env.example
PostgreSQL schema/Alembic baseline
FastAPI application skeleton
market provider interface
Alpaca adapter skeleton
Massive adapter skeleton
scheduler skeleton
React application shell
health endpoint
Cloudflare deployment notes
pytest setup
```

That repository skeleton should follow this document as its implementation contract.
