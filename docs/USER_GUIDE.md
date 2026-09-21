# Atlas Portfolio & Entry Radar — User Guide

Welcome to the **Atlas Advanced Portfolio & Entry Radar Dashboard**. This guide explains the core layout, features, and everyday workflows of your dashboard.

---

## 1. Quick Start & Navigation

The navigation bar at the top allows you to switch between primary workspaces:

| Tab | Purpose |
|---|---|
| **Portfolio** | Complete inventory of your current holdings, real-time market pricing, daily change, unrealized P&L, sector heatmap, and rebalancing tools. |
| **Signal Center** | Objective ranking (0–100) of your current holdings based on technical momentum, trend strength, and portfolio fit. |
| **Watchlist & Entry Radar** | Prospective candidate stocks, multi-source external ratings consensus, 5-point buy setup validation, and entry alerts. |
| **Analytics & Risk** | Portfolio risk breakdown (Beta, Value-at-Risk, Sector Caps), Correlation Matrix, Benchmark comparison (vs. SPY/QQQ), and Strategy Backtesting. |
| **Catalysts** | Upcoming earnings releases and dividend schedules with forward yields and safety grades. |
| **Alerts** | Central hub for armed price/RSI/risk triggers, trigger audit history, and Telegram push notification settings. |

---

## 2. Portfolio View

### Table & Heatmap
- **Table Mode**: Shows Asset, Price, Shares, Avg Cost, Market Value, Weight %, **Today %** (single-day price move), **Unrealized % / $**, Signal State, and Score.
- **Heatmap Mode**: Visual treemap sized by position weight and colored by daily performance (+/-).
- **Sort by Any Column**: Click any column header (e.g. *Today*, *Weight*, *Score*) to toggle ascending/descending order.

### Action Toolbar
- **⚡ Refresh All Data**: Fetches latest real-time market prices, recalculates all technical indicators (RSI, SMAs, MACD), and updates portfolio values.
- **Scale / Rebalance & Trade**: Opens the portfolio rebalancing modal to trim overweight positions and reallocate into high-conviction signals within position and sector limits.
- **Export CSV**: Downloads the full active book into an Excel-ready `.csv` file.
- **Portfolio Selector / Switcher**: In the header or settings, switch between uploaded portfolios (e.g. *AHAD portfolio 17092026.xlsx*), custom spreadsheets, or live Alpaca sync.

---

## 3. Watchlist & Entry Radar

The **Watchlist & Entry Radar** is your command center for prospective stocks before taking a position.

### The 5-Point Entry Setup Criteria
Every candidate stock is scored against 5 institutional entry rules:
1. **Ratings Consensus $\ge 65$**: Strong Buy / Buy consensus across Seeking Alpha Quant, SA Wall Street, Zacks Rank, and Investing.com.
2. **RSI Buy-Zone ($38 \le \text{RSI} \le 58$)**: Not overbought, entering positive momentum from consolidation.
3. **MA Trend Structure**: Price $>$ 50-day SMA, and 50-day SMA $>$ 200-day SMA with positive trend slope.
4. **Volume Confirmation**: Relative Volume $\ge 1.0\times$ (20-day average volume).
5. **Target Upside $\ge 15\%$**: Meaningful room to run toward the Wall Street consensus price target.

### Candidate Cards
- **Review Setup**: Opens the detailed setup analysis drawer showing exact scores, price targets, and component breakdowns.
- **🔔 Arm Trigger**: Sets an automated price or RSI alert (e.g., alert me if price dips to $95.00 for an entry).
- **🧪 Backtest**: Launches the empirical 5-point strategy backtester pre-populated with that ticker.
- **Quick Add Bar**: Type any ticker symbol + optional thesis note to add it immediately to your radar.

### Automated Sync & Market Status
- In the top-right header, the **Auto-Sync** badge indicates the market session phase (`Pre-Market`, `Regular Hours`, `After-Hours`) and next scheduled sync.
- Click **Sync Now** to immediately pull ratings shifts from the article analyzer and update quotes.

---

## 4. Signal Center (0–100 Scoring)

The Signal Center answers: *"Which positions in my book are strongest, and which need attention?"*

- **Scoring Mechanics**:
  - **Base Technical Score (0–100)**: Evaluates RSI momentum, moving average alignments, MACD crossovers, and breakout volume.
  - **Portfolio Fit Adjuster**: Applies a penalty if adding/holding the stock exceeds single-position limits (20%) or sector limits (35%), or a bonus if it diversifies the book.
- **Status Pills**:
  - `STRONG ENTRY` / `ENTRY`: Setup is fully aligned for buying or holding.
  - `APPROACHING`: Setup is consolidating and nearing trigger conditions.
  - `NEUTRAL` / `TAKE PROFIT`: Target reached or momentum cooling.

---

## 5. 5-Point Strategy Backtester

Test how the 5-point entry criteria would have performed historically on any ticker before committing capital.

### How to Run a Backtest
1. Click **🧪 Backtest Criteria** in the Watchlist tab header, or **🧪 Backtest** on any candidate card.
2. Select or enter a ticker (e.g., `NVDA`, `PLTR`, `CRM`, `ARM`, `SPY`).
3. Adjust your parameters:
   - **Entry Score Threshold** (default: `75`): Minimum score required to trigger a buy.
   - **Take-Profit %** (default: `+15%`): Target gain to exit position.
   - **Stop-Loss %** (default: `-5%`): Protective stop-loss threshold.
   - **Time Stop** (default: `20 days`): Maximum holding period if target/stop is not reached.
   - **Lookback Period** (`6mo`, `1y`, `2y`, `3y`).
4. Click **Run Backtest**:
   - Review **Total Return %** vs. **SPY Benchmark Return %**, **Alpha %**, **Sharpe Ratio**, **Win Rate %**, and **Max Drawdown %**.
   - Inspect the interactive equity curve chart and the trade ledger table with exact entry/exit dates and exit reasons (`TARGET`, `STOP_LOSS`, `TIME_STOP`, `SIGNAL_EXIT`).

---

## 6. Alerts & Notifications

### Creating Custom Alerts
1. Click **+ Create Custom Alert** on the Alerts page or click the **🔔 bell icon** on any stock.
2. Select your condition:
   - **Price Alert**: Trigger when Price goes `ABOVE` or `BELOW` a target value.
   - **RSI Alert**: Trigger when RSI goes `ABOVE` (overbought) or `BELOW` (oversold dip).
   - **Risk Alert**: Portfolio drawdown or sector concentration cap.
3. Once armed, the system checks conditions every cycle and flags triggers in green (`TRIGGERED`).

### Telegram Push Notifications
- Connect your Telegram bot in the Notifications settings to receive live alerts and trade dispatch prompts directly on your mobile device.
