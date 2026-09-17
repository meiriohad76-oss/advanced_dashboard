export type SignalState = 'NO SETUP' | 'WATCH' | 'APPROACHING' | 'ENTRY' | 'STRONG ENTRY'

export interface Holding {
  symbol: string
  name: string
  sector: string
  quantity: number
  price: number
  avgCost: number
  dayChange: number
  weight: number
  rsi: number
  macdBullish: boolean
  aboveSma50: boolean
  aboveSma200: boolean
  relativeVolume: number
  breakout20d: boolean
  trendSlopePositive: boolean
  hasSignalInputs?: boolean
  returnsHistory?: number[]
  score?: number
  state?: SignalState
}

export interface PortfolioSource {
  source: 'uploaded' | 'seed' | 'alpaca' | 'live'
  mode?: 'live' | 'uploaded' | 'demo'
  name: string | null
  imported_at: string | null
  last_refreshed?: string | null
  provider?: string | null
  count: number
  has_signal_inputs: boolean
  id?: number | null
  scenario_active?: boolean
  portfolio_value?: number
  cash?: number
  warnings?: string[]
}

export interface SavedPortfolioItem {
  id: number
  name: string
  imported_at: string
  count: number
  total_value: number
  is_active: boolean
}

export interface Quote {
  symbol: string
  price: number
  prevClose?: number | null
  dayChangePct?: number | null
  bid?: number | null
  ask?: number | null
  volume?: number | null
  timestamp: string
  provider: string
}

export interface MarketProviderInfo {
  configured: boolean
  healthy: boolean
  provider_name: string
}

export interface MarketStatus {
  active_provider: 'alpaca' | 'yahoo' | 'none'
  alpaca: MarketProviderInfo
  yahoo: MarketProviderInfo
}

export interface BrokerAlpacaStatus {
  configured: boolean
  connected: boolean
  account_status: string
  portfolio_value: number
  cash: number
  buying_power: number
  currency: string
  last_synced?: string | null
  error?: string
}

export interface BrokerAlpacaSyncResult {
  success: boolean
  count: number
  holdings: Holding[]
  portfolio_value: number
  cash: number
  synced_at: string
  message: string
}

export interface WatchlistItem {
  symbol: string
  name?: string | null
  sector?: string | null
  note?: string | null
}

export interface WatchlistData {
  source: 'uploaded' | 'default' | 'empty' | 'created'
  name: string | null
  imported_at: string | null
  items: WatchlistItem[]
  count: number
  warnings?: string[]
}

export interface EntryCriteria {
  ratingBullish: boolean
  rsiInBuyZone: boolean
  trendAligned: boolean
  volumeActive: boolean
  upsideAttractive: boolean
}

export type EntrySignalState = 'STRONG ENTRY' | 'ENTRY' | 'APPROACHING' | 'WATCH' | 'WAIT FOR DIP' | 'NO SETUP'

export interface EntryAssessment {
  score: number
  state: EntrySignalState
  criteria: EntryCriteria
  facts: string[]
  components: {
    ratings: { score: number; max: number; detail: string }
    trend: { score: number; max: number; detail: string }
    momentum: { score: number; max: number; detail: string }
    setup: { score: number; max: number; detail: string }
    upside: { score: number; max: number; detail: string }
  }
}

export interface ScoreComponent {
  label: string
  score: number
  max: number
  facts: string[]
}

export interface SignalAssessment {
  score: number
  state: SignalState
  components: ScoreComponent[]
  facts: string[]
}

export interface FitFactor {
  label: string
  detail: string
  points: number
  breached: boolean
}

export interface PortfolioFit {
  symbol: string
  technicalScore: number
  fitScore: number
  concentrationAdjustment: number
  combinedScore: number
  combinedState: SignalState
  factors: FitFactor[]
  explanation: string[]
  correlationAvailable: boolean
}

export type RatingSourceKey = 'zacks' | 'sa_quant' | 'sa_analysts' | 'sa_wall_street' | 'investing'

export interface Rating {
  source: RatingSourceKey
  display: string
  valueNative: string
  label: string
  normalized: number
  nativeScale: string
  asOf: string
  url?: string
}

export interface TickerRatings {
  symbol: string
  ratings: Rating[]
  consensus: number | null
  consensusLabel: string | null
}

export interface RatingShiftItem {
  ticker: string
  provider: string
  field: string
  previous: string
  current: string
  direction: 'UPGRADE' | 'DOWNGRADE' | 'REVISION'
  date: string
  headline: string
}

export interface RatingsStatus {
  source: 'db' | 'feed' | 'seed'
  tickers: number
  extractor_url: string
  extracted_at: string | null
  age_days: number | null
  stale: boolean
  threshold_days: number
  imported_files?: number
  imported_rows?: number
  extractor_running?: boolean
}

export interface PriceTargets {
  saWallStreet?: number
  saHigh?: number
  saLow?: number
  zacks?: number
}

export interface UserAlert {
  id: string
  symbol: string
  metric: 'PRICE' | 'SMA20' | 'SMA50' | 'SMA150' | 'RSI' | 'MACD' | 'VOLUME' | 'STOP_LOSS'
  condition: 'ABOVE' | 'BELOW' | 'CROSS_ABOVE' | 'CROSS_BELOW'
  targetValue: number
  severity: 'info' | 'warning' | 'critical'
  status: 'ARMED' | 'TRIGGERED' | 'COOLDOWN'
  createdAt: string
}

export interface AlertItem {
  id: string
  symbol?: string
  title: string
  message: string
  status: 'TRIGGERED' | 'ARMED' | 'COOLDOWN'
  severity: 'info' | 'warning' | 'critical'
  time: string
  metric?: string
  targetValue?: number
}

export interface RiskSummary {
  largest_position: number
  top_five: number
  largest_sector: string
  sector_weight: number
  status: 'Balanced' | 'Elevated'
  portfolioBeta?: number
  var95Pct?: number
  var95Amount?: number
}

export interface NotificationSettings {
  telegram_token: string
  telegram_chat_id: string
  telegram_enabled: boolean
  webhook_url: string
  webhook_enabled: boolean
  min_severity: string
}

export interface NotificationTestResult {
  status: string
  settings: Record<string, string | boolean>
  results: {
    telegram?: { success?: boolean; error?: string; detail?: string }
    webhook?: { success?: boolean; error?: string; detail?: string }
  }
}

export interface RebalanceOrder {
  symbol: string
  name?: string
  sector?: string
  price: number
  current_quantity: number
  current_weight: number
  target_weight: number
  delta_weight: number
  side: 'buy' | 'sell'
  quantity: number
  estimated_amount: number
  score: number
  state: string
  reason: string
}

export interface RebalanceResponse {
  orders_count: number
  total_rebalance_amount: number
  portfolio_value: number
  orders: RebalanceOrder[]
}

export interface CorrelationMatrixResponse {
  symbols: string[]
  matrix: number[][]
  high_pairs: Array<{
    pair: [string, string]
    correlation: number
    risk: string
  }>
  sample_period?: string
}

export interface BenchmarkPoint {
  date: string
  portfolio: number
  spy: number
  qqq: number
}

export interface BenchmarkMetrics {
  portfolio_return: number
  spy_return: number
  qqq_return: number
  alpha: number
  beta: number
  sharpe: number
  max_drawdown: number
}

export interface BenchmarkComparisonResponse {
  timeframe: string
  series: BenchmarkPoint[]
  metrics: BenchmarkMetrics
}

// Catalysts (Earnings & Dividends)
export interface EarningsEvent {
  symbol: string
  name: string
  earnings_date: string
  days_until: number
  timing: 'BMO' | 'AMC' | 'Unspecified'
  eps_estimate: number | null
  last_reported_eps: number | null
  implied_move_pct: number
  is_high_risk: boolean
  position_value: number
  weight_pct: number
}

export interface EarningsSummary {
  total_upcoming: number
  this_week: number
  next_30_days: number
  high_risk_count: number
}

export interface EarningsCalendarResponse {
  events: EarningsEvent[]
  summary: EarningsSummary
}

export interface DividendSummary {
  total_annual_income: number
  average_monthly_income: number
  portfolio_yield_pct: number
  top_payer: string
  paying_positions_count: number
}

export interface MonthlyCashflow {
  month: string
  month_num: number
  amount: number
  tickers: string[]
}

export interface HoldingDividend {
  symbol: string
  name: string
  quantity: number
  price: number
  position_value: number
  yield_pct: number
  annual_dps: number
  annual_income: number
  monthly_income: number
  payout_frequency: string
  next_ex_date: string | null
}

export interface UpcomingExDate {
  symbol: string
  name: string
  ex_date: string
  days_to_ex: number
  payout_per_share: number
  estimated_cashflow: number
}

export interface DividendData {
  summary: DividendSummary
  monthly_cashflow: MonthlyCashflow[]
  holdings: HoldingDividend[]
  upcoming_ex_dates: UpcomingExDate[]
}

// Pre-Market Morning Briefing
export interface DailyBriefingPulse {
  total_value: number
  day_change_amount: number
  day_change_pct: number
  top_gainer?: { symbol: string; change: number } | null
  top_loser?: { symbol: string; change: number } | null
}

export interface DailyBriefingSetup {
  symbol: string
  name: string
  price: number
  score: number
  state: string
  rsi: number
  breakout: boolean
  weight: number
}

export interface DailyBriefing {
  date: string
  generated_at: string
  pulse: DailyBriefingPulse
  top_setups: DailyBriefingSetup[]
  catalysts: {
    earnings_soon: EarningsEvent[]
    dividends_soon: UpcomingExDate[]
  }
  sentiment: {
    ranks_count: number
    highlights: string[]
  }
  risk: {
    beta: number
    var_95: number
    executive_stance: string
  }
  telegram_markdown: string
}

// Backtest
export interface BacktestParams {
  symbol?: string
  entry_score?: number
  exit_score?: number
  lookback?: '6mo' | '1y' | '2y' | '3y'
  initial_capital?: number
  take_profit_pct?: number
  stop_loss_pct?: number
  max_holding_days?: number
  rsi_min?: number
  rsi_max?: number
}

export interface BacktestMetrics {
  final_equity: number
  benchmark_final_equity: number
  total_return_pct: number
  benchmark_return_pct: number
  alpha_pct: number
  cagr_pct: number
  sharpe_ratio: number
  max_drawdown_pct: number
  win_rate_pct: number
  profit_factor: number
  trades_count: number
  avg_trade_return_pct?: number
  avg_holding_days?: number
}

export interface BacktestTrade {
  symbol?: string
  entry_date: string
  exit_date: string
  duration_days: number
  return_pct: number
  entry_price?: number
  exit_price?: number
  entry_equity?: number
  exit_equity?: number
  win: boolean
  exit_reason?: 'TARGET' | 'STOP_LOSS' | 'TIME_STOP' | 'SIGNAL_EXIT' | 'OPEN_END' | string
  entry_score?: number
}

export interface BacktestCurvePoint {
  date: string
  portfolio: number
  benchmark: number
  drawdown_pct: number
  score: number
  in_position: boolean
  price?: number
}

export interface BacktestResult {
  parameters: {
    symbol?: string
    entry_score: number
    exit_score: number
    lookback: string
    trading_days: number
    initial_capital: number
    take_profit_pct?: number
    stop_loss_pct?: number
    max_holding_days?: number
    rsi_min?: number
    rsi_max?: number
  }
  metrics: BacktestMetrics
  trades: BacktestTrade[]
  equity_curve: BacktestCurvePoint[]
}

export interface SchedulerStatus {
  enabled: boolean
  active?: boolean
  interval_seconds: number
  interval_minutes: number
  last_checked: string | null
  last_sync: string | null
  last_run_timestamp?: string | null
  last_status: string
  runs_completed: number
  new_records_detected: number
  analyzer_db_detected: boolean
  market_session?: string
  next_scheduled_run?: string
  history?: Array<{
    timestamp: string
    status: string
    session?: string
    records_added?: number
    shifts_count?: number
    error?: string
  }>
}



