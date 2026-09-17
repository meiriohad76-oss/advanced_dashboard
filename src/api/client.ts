import type {
  AlertItem,
  BrokerAlpacaStatus,
  BrokerAlpacaSyncResult,
  Holding,
  MarketStatus,
  PortfolioSource,
  Quote,
  Rating,
  RatingsStatus,
  TickerRatings,
  WatchlistData,
} from '../types'

export interface DemoState {
  scenario_active: boolean
  source?: PortfolioSource
  holdings: Holding[]
  alerts: AlertItem[]
}

export interface MarketRefreshResponse {
  holdings: Holding[]
  alerts: AlertItem[]
  signals: unknown[]
  risk: Record<string, unknown>
  summary: Record<string, unknown>
  source?: PortfolioSource
  meta: {
    updated_count: number
    total_symbols: number
    provider: string
    timestamp: string
    iso_timestamp: string
  }
}

async function upload<T>(path: string, file: File): Promise<T> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(path, { method: 'POST', body })
  if (!response.ok) {
    let detail = `Atlas API returned ${response.status}`
    try { const j = await response.json(); if (j?.detail) detail = String(j.detail) } catch { /* keep default */ }
    throw new Error(detail)
  }
  return ((await response.json()) as { data: T }).data
}

interface Envelope<T> {
  data: T
  meta: { timestamp: string; request_id: string }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) throw new Error(`Atlas API returned ${response.status}`)
  return ((await response.json()) as Envelope<T>).data
}

// The API returns snake_case Rating fields; the UI uses camelCase (see types.ts).
interface ApiRating {
  source: Rating['source']; display: string; value_native: string; label: string
  normalized: number; native_scale: string; as_of: string; url?: string
}
interface ApiTickerRatings {
  symbol: string; ratings: ApiRating[]; consensus: number | null; consensus_label: string | null
}

function mapTickerRatings(data: ApiTickerRatings): TickerRatings {
  return {
    symbol: data.symbol,
    ratings: data.ratings.map((r): Rating => ({
      source: r.source, display: r.display, valueNative: r.value_native, label: r.label,
      normalized: r.normalized, nativeScale: r.native_scale, asOf: r.as_of, url: r.url,
    })),
    consensus: data.consensus,
    consensusLabel: data.consensus_label,
  }
}

export const api = {
  health: () => request<{ status: string; mode: string }>('/api/v1/system/health'),
  state: () => request<DemoState>('/api/v1/demo/state'),
  scenario: (active: boolean) => request<DemoState>(`/api/v1/demo/scenario/${active ? 'activate' : 'reset'}`, { method: 'POST' }),
  ask: (question: string) => request<{ answer: string; grounding: string[]; generated_numbers: boolean }>('/api/v1/assistant/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  ratings: (symbol: string) => request<ApiTickerRatings>(`/api/v1/signals/${symbol}/ratings`).then(mapTickerRatings),
  ratingsStatus: () => request<RatingsStatus>('/api/v1/ratings/status'),
  importRatings: () => request<RatingsStatus>('/api/v1/ratings/import', { method: 'POST' }),
  portfolioSource: () => request<PortfolioSource>('/api/v1/portfolio/source'),
  importPortfolio: (file: File) => upload<PortfolioSource>('/api/v1/portfolio/import', file),
  resetPortfolio: () => request<PortfolioSource>('/api/v1/portfolio/reset', { method: 'POST' }),
  getSavedPortfolios: () =>
    request<{ portfolios: import('../types').SavedPortfolioItem[]; total_saved: number; active_id: number | null }>('/api/v1/portfolios/saved'),
  activateSavedPortfolio: (id: number) =>
    request<DemoState>(`/api/v1/portfolios/saved/${id}/activate`, { method: 'POST' }),
  renameSavedPortfolio: (id: number, name: string) =>
    request<{ id: number; name: string; renamed: boolean }>(`/api/v1/portfolios/saved/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteSavedPortfolio: (id: number) =>
    request<{ deleted_id: number; status: string }>(`/api/v1/portfolios/saved/${id}`, { method: 'DELETE' }),
  watchlist: () => request<WatchlistData>('/api/v1/watchlist'),
  addWatchlistSymbol: (symbol: string, note?: string, name?: string, sector?: string) =>
    request<{ item: import('../types').WatchlistItem; watchlist: WatchlistData }>('/api/v1/watchlist/items', {
      method: 'POST',
      body: JSON.stringify({ symbol, note, name, sector }),
    }),
  removeWatchlistSymbol: (symbol: string) =>
    request<{ symbol: string; removed: boolean; watchlist: WatchlistData }>(`/api/v1/watchlist/items/${encodeURIComponent(symbol)}`, {
      method: 'DELETE',
    }),
  importWatchlist: (file: File) => upload<WatchlistData>('/api/v1/watchlist/import', file),
  resetWatchlist: () => request<WatchlistData>('/api/v1/watchlist/reset', { method: 'POST' }),
  pollRatings: (url?: string) => request<RatingsStatus>(`/api/v1/ratings/poll${url ? `?url=${encodeURIComponent(url)}` : ''}`, { method: 'POST' }),
  testAlert: (webhookUrl?: string) => request<{ status: string; http_code?: number; reason?: string }>('/api/v1/alerts/test', { method: 'POST', body: JSON.stringify({ webhook_url: webhookUrl }) }),
  dispatchAlerts: (webhookUrl?: string) => request<{ triggered_count: number; dispatches: Array<{ status: string }> }>('/api/v1/alerts/dispatch', { method: 'POST', body: JSON.stringify({ webhook_url: webhookUrl }) }),
  marketStatus: () => request<MarketStatus>('/api/v1/market/status'),
  marketQuote: (symbol: string) => request<Quote>(`/api/v1/market/quote/${encodeURIComponent(symbol)}`),
  marketQuotes: (symbols: string[]) => request<Record<string, Quote>>('/api/v1/market/quotes', { method: 'POST', body: JSON.stringify({ symbols }) }),
  marketRefresh: () => request<MarketRefreshResponse>('/api/v1/market/refresh', { method: 'POST' }),
  marketBars: (symbol: string, range = '6mo', interval = '1d') =>
    request<import('../components/CandleChart').BarsResponse>(
      `/api/v1/market/bars/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
    ),
  syncAutoRatings: () => request<RatingsStatus>('/api/v1/ratings/sync-auto', { method: 'POST' }),
  ensureExtractorRunning: () =>
    request<{ status: string; url: string; already_running?: boolean }>('/api/v1/ratings/extractor/ensure', { method: 'POST' }),
  ratingsChanges: () => request<{ count: number; changes: import('../types').RatingShiftItem[] }>('/api/v1/ratings/changes'),
  notificationSettings: () => request<import('../types').NotificationSettings>('/api/v1/notifications/settings'),
  saveNotificationSettings: (settings: Partial<import('../types').NotificationSettings>) =>
    request<import('../types').NotificationSettings>('/api/v1/notifications/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  testNotifications: () => request<import('../types').NotificationTestResult>('/api/v1/notifications/test', { method: 'POST' }),
  schedulerStatus: () => request<{
    enabled: boolean
    interval_seconds: number
    interval_minutes: number
    last_checked: string | null
    last_sync: string | null
    last_status: string
    runs_completed: number
    new_records_detected: number
    analyzer_db_detected: boolean
  }>('/api/v1/scheduler/status'),
  toggleScheduler: (enabled?: boolean) =>
    request<{ enabled: boolean }>('/api/v1/scheduler/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  brokerAlpacaStatus: () => request<BrokerAlpacaStatus>('/api/v1/broker/alpaca/status'),
  brokerAlpacaSync: () => request<BrokerAlpacaSyncResult>('/api/v1/broker/alpaca/sync', { method: 'POST' }),
  placeBrokerOrder: (order: { symbol: string; quantity: number; side: 'buy' | 'sell'; type?: string; limit_price?: number }) =>
    request<Record<string, unknown>>('/api/v1/broker/alpaca/order', {
      method: 'POST',
      body: JSON.stringify(order),
    }),
  portfolioRebalance: (maxPosition = 12.0, maxSector = 30.0) =>
    request<import('../types').RebalanceResponse>(
      `/api/v1/portfolio/rebalance?max_position=${encodeURIComponent(maxPosition)}&max_sector=${encodeURIComponent(maxSector)}`
    ),
  executeRebalance: (orders: Array<{ symbol: string; quantity: number; side: string }>) =>
    request<{ executed_count: number; failed_count: number; results: unknown[] }>('/api/v1/portfolio/rebalance/execute', {
      method: 'POST',
      body: JSON.stringify({ orders }),
    }),
  correlationMatrix: (maxSymbols = 10) =>
    request<import('../types').CorrelationMatrixResponse>(`/api/v1/analytics/correlation?max_symbols=${encodeURIComponent(maxSymbols)}`),
  benchmarkComparison: (range = '1y') =>
    request<import('../types').BenchmarkComparisonResponse>(`/api/v1/analytics/benchmark-comparison?range=${encodeURIComponent(range)}`),
  catalystsEarnings: () =>
    request<import('../types').EarningsCalendarResponse>('/api/v1/catalysts/earnings'),
  catalystsDividends: () =>
    request<import('../types').DividendData>('/api/v1/catalysts/dividends'),
  briefingDaily: () =>
    request<import('../types').DailyBriefing>('/api/v1/briefing/daily'),
  briefingDispatch: (token?: string, chatId?: string) =>
    request<{ sent: boolean; message_id?: number; error?: string }>('/api/v1/briefing/dispatch', {
      method: 'POST',
      body: JSON.stringify({ telegram_token: token, telegram_chat_id: chatId }),
    }),
  analyticsBacktest: (params: import('../types').BacktestParams) =>
    request<import('../types').BacktestResult>('/api/v1/analytics/backtest', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  telegramSendTradePrompt: (params: {
    symbol: string
    qty: number
    side: 'buy' | 'sell'
    price?: number
    take_profit_price?: number
    stop_loss_price?: number
  }) =>
    request<Record<string, unknown>>('/api/v1/notifications/telegram/send-trade-prompt', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
}

