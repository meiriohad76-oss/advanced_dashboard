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
  scenario_active: boolean
  portfolio_value?: number
  cash?: number
  warnings?: string[]
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
  source: 'uploaded' | 'empty'
  name: string | null
  imported_at: string | null
  items: WatchlistItem[]
  count: number
  warnings?: string[]
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


