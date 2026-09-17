import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { api } from '../api/client'
import { resolveCompanyName } from '../data/companyNames'
import { getPriceTargets } from '../domain/ratings'
import { buildTickerRatings } from '../domain/ratings'
import { assessCandidateEntry } from '../domain/entryAnalysis'
import type { Holding, Quote, TickerRatings, UserAlert, WatchlistData, WatchlistItem } from '../types'

interface WatchlistEntryRadarProps {
  onSelectHolding: (holding: Holding) => void
  onOpenAlertPanel?: () => void
  existingHoldings?: Holding[]
  onAddUserAlert?: (alert: Omit<UserAlert, 'id' | 'createdAt' | 'status'>) => void
}

type FilterTab = 'all' | 'ready' | 'approaching' | 'strong_ratings' | 'high_upside'
type SortField = 'entry_score' | 'ratings' | 'upside' | 'rsi' | 'symbol' | 'change'

export function WatchlistEntryRadar({
  onSelectHolding,
  onOpenAlertPanel,
  existingHoldings = [],
  onAddUserAlert,
}: WatchlistEntryRadarProps) {
  const [watchlistData, setWatchlistData] = useState<WatchlistData | null>(null)
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [ratingsMap, setRatingsMap] = useState<Record<string, TickerRatings>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Quick-add state
  const [newSymbol, setNewSymbol] = useState('')
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Filters & Search
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('entry_score')
  const [sortAsc, setSortAsc] = useState(false)

  // Alert modal state
  const [alertModalTicker, setAlertModalTicker] = useState<string | null>(null)
  const [alertTargetPrice, setAlertTargetPrice] = useState<string>('')
  const [alertMetric, setAlertMetric] = useState<'PRICE' | 'RSI'>('PRICE')
  const [alertCondition, setAlertCondition] = useState<'BELOW' | 'ABOVE'>('BELOW')
  const [alertSuccessMsg, setAlertSuccessMsg] = useState<string | null>(null)

  // Initial load
  const loadWatchlist = async () => {
    try {
      setLoading(true)
      const data = await api.watchlist()
      setWatchlistData(data)
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWatchlist()
  }, [])

  const items: WatchlistItem[] = useMemo(() => watchlistData?.items ?? [], [watchlistData])

  // Fetch real-time quotes and ratings for all candidate symbols
  const fetchMarketAndRatings = async (symbols: string[]) => {
    if (symbols.length === 0) return
    setRefreshing(true)
    try {
      // 1. Fetch live quotes in batch
      const quotesRes = await api.marketQuotes(symbols).catch(() => ({} as Record<string, Quote>))
      setQuotes((prev) => ({ ...prev, ...quotesRes }))

      // 2. Build local seeded ratings and upgrade with backend ratings
      const newRatings: Record<string, TickerRatings> = {}
      for (const sym of symbols) {
        newRatings[sym] = buildTickerRatings(sym)
      }
      setRatingsMap((prev) => ({ ...prev, ...newRatings }))

      // Upgrade asynchronously
      Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const real = await api.ratings(sym)
            setRatingsMap((prev) => ({ ...prev, [sym]: real }))
          } catch {
            // Keep seeded
          }
        })
      )
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (items.length > 0) {
      const symbols = items.map((it) => it.symbol.toUpperCase())
      fetchMarketAndRatings(symbols)
    }
  }, [items])

  // Add symbol to watchlist
  const handleAddSymbol = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const sym = newSymbol.trim().toUpperCase()
    if (!sym) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await api.addWatchlistSymbol(sym, newNote.trim())
      setWatchlistData(res.watchlist)
      setNewSymbol('')
      setNewNote('')
      // Fetch quote & ratings immediately for newly added
      fetchMarketAndRatings([sym])
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add ticker')
    } finally {
      setAdding(false)
    }
  }

  // Remove symbol
  const handleRemoveSymbol = async (symbol: string) => {
    try {
      const res = await api.removeWatchlistSymbol(symbol)
      setWatchlistData(res.watchlist)
    } catch {
      //
    }
  }

  // Quick Preset Add
  const handleAddPreset = (sym: string) => {
    setNewSymbol(sym)
  }

  // Enriched Candidates with Entry Point Assessment
  const enrichedCandidates = useMemo(() => {
    return items.map((it) => {
      const sym = it.symbol.toUpperCase()
      const quote = quotes[sym]
      const ratings = ratingsMap[sym]
      const targets = getPriceTargets(sym)

      // Fallback holding if in existing book
      const existing = existingHoldings.find((h) => h.symbol.toUpperCase() === sym)

      const price = quote?.price ?? existing?.price ?? targets.saWallStreet ?? targets.zacks ?? 100
      const dayChangePct = quote?.dayChangePct ?? existing?.dayChange ?? 0
      const rsi = existing?.rsi ?? 50
      const aboveSma50 = existing?.aboveSma50 ?? true
      const aboveSma200 = existing?.aboveSma200 ?? true
      const macdBullish = existing?.macdBullish ?? true
      const relativeVolume = existing?.relativeVolume ?? 1.0
      const breakout20d = existing?.breakout20d ?? false

      const targetPrice = targets.saWallStreet || targets.zacks || null
      const upsidePct = targetPrice && price > 0 ? ((targetPrice - price) / price) * 100 : null

      const assessment = assessCandidateEntry({
        symbol: sym,
        name: it.name || resolveCompanyName(sym) || sym,
        sector: it.sector || 'Equities',
        price,
        dayChangePct,
        rsi,
        aboveSma50,
        aboveSma200,
        macdBullish,
        relativeVolume,
        breakout20d,
        ratingsConsensus: ratings?.consensus ?? null,
        ratingsConsensusLabel: ratings?.consensusLabel ?? null,
        targetPrice,
      })

      return {
        item: it,
        symbol: sym,
        name: it.name || resolveCompanyName(sym) || sym,
        sector: it.sector || 'Equities',
        price,
        dayChangePct,
        rsi,
        aboveSma50,
        aboveSma200,
        macdBullish,
        relativeVolume,
        breakout20d,
        ratings,
        targets,
        targetPrice,
        upsidePct,
        assessment,
      }
    })
  }, [items, quotes, ratingsMap, existingHoldings])

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    return enrichedCandidates
      .filter((c) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchSym = c.symbol.toLowerCase().includes(q)
          const matchName = c.name.toLowerCase().includes(q)
          const matchSector = c.sector.toLowerCase().includes(q)
          const matchNote = (c.item.note || '').toLowerCase().includes(q)
          if (!matchSym && !matchName && !matchSector && !matchNote) return false
        }

        // Tab filter
        if (filterTab === 'ready') {
          return c.assessment.score >= 80 || c.assessment.state === 'STRONG ENTRY'
        }
        if (filterTab === 'approaching') {
          return c.assessment.score >= 60 && c.assessment.score < 80
        }
        if (filterTab === 'strong_ratings') {
          return (c.ratings?.consensus ?? 0) >= 65
        }
        if (filterTab === 'high_upside') {
          return (c.upsidePct ?? 0) >= 15
        }
        return true
      })
      .sort((a, b) => {
        let diff = 0
        if (sortField === 'entry_score') {
          diff = b.assessment.score - a.assessment.score
        } else if (sortField === 'ratings') {
          diff = (b.ratings?.consensus ?? 0) - (a.ratings?.consensus ?? 0)
        } else if (sortField === 'upside') {
          diff = (b.upsidePct ?? -999) - (a.upsidePct ?? -999)
        } else if (sortField === 'rsi') {
          diff = a.rsi - b.rsi
        } else if (sortField === 'change') {
          diff = b.dayChangePct - a.dayChangePct
        } else if (sortField === 'symbol') {
          return sortAsc ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
        }
        return sortAsc ? -diff : diff
      })
  }, [enrichedCandidates, filterTab, searchQuery, sortField, sortAsc])

  // Summary Metrics
  const totalCount = enrichedCandidates.length
  const entryReadyCount = enrichedCandidates.filter((c) => c.assessment.score >= 80).length
  const approachingCount = enrichedCandidates.filter((c) => c.assessment.score >= 60 && c.assessment.score < 80).length
  const avgUpside = useMemo(() => {
    const valid = enrichedCandidates.map((c) => c.upsidePct).filter((u): u is number => u !== null && u > -50 && u < 300)
    if (valid.length === 0) return 0
    return Math.round((valid.reduce((sum, v) => sum + v, 0) / valid.length) * 10) / 10
  }, [enrichedCandidates])

  // Handle open drawer for candidate
  const handleSelectCandidate = (candidate: typeof enrichedCandidates[0]) => {
    const holding: Holding = {
      symbol: candidate.symbol,
      name: candidate.name,
      sector: candidate.sector,
      quantity: 0,
      price: candidate.price,
      avgCost: candidate.price,
      dayChange: candidate.dayChangePct,
      weight: 0,
      rsi: candidate.rsi,
      macdBullish: candidate.macdBullish,
      aboveSma50: candidate.aboveSma50,
      aboveSma200: candidate.aboveSma200,
      relativeVolume: candidate.relativeVolume,
      breakout20d: candidate.breakout20d,
      trendSlopePositive: true,
    }
    onSelectHolding(holding)
  }

  // Handle create alert
  const handleOpenAlertModal = (symbol: string, currentPrice: number, currentRsi: number) => {
    setAlertModalTicker(symbol)
    setAlertMetric('PRICE')
    setAlertCondition('BELOW')
    // Default target: 2% below current price for a dip entry
    setAlertTargetPrice((currentPrice * 0.98).toFixed(2))
    setAlertSuccessMsg(null)
  }

  const handleSaveAlert = () => {
    if (!alertModalTicker) return
    const val = parseFloat(alertTargetPrice)
    if (isNaN(val) || val <= 0) return

    if (onAddUserAlert) {
      onAddUserAlert({
        symbol: alertModalTicker,
        metric: alertMetric,
        condition: alertCondition,
        targetValue: val,
        severity: 'warning',
      })
    }
    setAlertSuccessMsg(`Entry alert armed for ${alertModalTicker} when ${alertMetric} is ${alertCondition} ${val}!`)
    setTimeout(() => {
      setAlertModalTicker(null)
      setAlertSuccessMsg(null)
    }, 1500)
  }

  return (
    <div className="watchlist-radar-container">
      {/* Header */}
      <div className="page-title-row">
        <div>
          <span className="eyebrow">PROSPECTIVE CANDIDATE RADAR</span>
          <h1>Watchlist &amp; Entry Radar</h1>
          <p>Analyze multi-source ratings, technical momentum, and 5-point criteria to trigger high-conviction entry point alerts before buying.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="secondary-button"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => fetchMarketAndRatings(items.map((it) => it.symbol.toUpperCase()))}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Quotes & Ranks'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="summary-grid" style={{ marginBottom: '20px' }}>
        <div className="summary-card">
          <span>TRACKED CANDIDATES</span>
          <strong>{totalCount}</strong>
          <small>Prospective tickers</small>
        </div>

        <div className="summary-card alert-summary-card" style={{ borderColor: entryReadyCount > 0 ? 'var(--green)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>ENTRY ALERTS ACTIVE</span>
            {entryReadyCount > 0 && <span className="live-dot" style={{ background: 'var(--green)' }} />}
          </div>
          <strong style={{ color: entryReadyCount > 0 ? 'var(--green)' : undefined }}>{entryReadyCount}</strong>
          <small>{entryReadyCount > 0 ? 'High-conviction buy setups (Score ≥ 80)' : 'Waiting for criteria'}</small>
        </div>

        <div className="summary-card">
          <span>APPROACHING ENTRY</span>
          <strong>{approachingCount}</strong>
          <small>Consolidating setups (Score 60–79)</small>
        </div>

        <div className="summary-card">
          <span>AVG TARGET UPSIDE</span>
          <strong style={{ color: avgUpside > 0 ? 'var(--green)' : undefined }}>
            {avgUpside > 0 ? `+${avgUpside}%` : `${avgUpside}%`}
          </strong>
          <small>Wall St consensus targets</small>
        </div>
      </div>

      {/* Quick Add Bar */}
      <div className="panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleAddSymbol} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
            <Search size={16} style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              className="quick-add-input"
              placeholder="Add ticker (e.g. PLTR, ARM, MSFT, AMD)..."
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--foreground)',
                fontSize: '13px',
                fontWeight: 600,
                width: '100%',
              }}
            />
          </div>
          <input
            type="text"
            placeholder="Entry thesis / note (optional)..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            style={{
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'var(--foreground)',
              fontSize: '12px',
              flex: '2 1 240px',
            }}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={adding || !newSymbol.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
          >
            <Plus size={16} />
            {adding ? 'Adding...' : 'Add to Radar'}
          </button>
        </form>

        {/* Popular Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Quick suggestions:</span>
          {['NVDA', 'CRM', 'CRDO', 'VRT', 'ANET', 'GOOGL', 'PLTR', 'AEM'].map((p) => (
            <button
              key={p}
              type="button"
              className="preset-chip"
              onClick={() => handleAddPreset(p)}
              style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px',
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              +{p}
            </button>
          ))}
          {addError && <span style={{ fontSize: '12px', color: 'var(--red)', marginLeft: '10px' }}>{addError}</span>}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`secondary-button ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All Candidates ({totalCount})
          </button>
          <button
            type="button"
            className={`secondary-button ${filterTab === 'ready' ? 'active' : ''}`}
            onClick={() => setFilterTab('ready')}
            style={{ color: filterTab === 'ready' ? 'var(--green)' : undefined }}
          >
            🟢 Entry Alert Active ({entryReadyCount})
          </button>
          <button
            type="button"
            className={`secondary-button ${filterTab === 'approaching' ? 'active' : ''}`}
            onClick={() => setFilterTab('approaching')}
          >
            🟡 Approaching ({approachingCount})
          </button>
          <button
            type="button"
            className={`secondary-button ${filterTab === 'strong_ratings' ? 'active' : ''}`}
            onClick={() => setFilterTab('strong_ratings')}
          >
            ⭐ Buy Ratings
          </button>
          <button
            type="button"
            className={`secondary-button ${filterTab === 'high_upside' ? 'active' : ''}`}
            onClick={() => setFilterTab('high_upside')}
          >
            🚀 High Upside (&gt;15%)
          </button>
        </div>

        {/* Sort selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Sort by:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: 'var(--foreground)',
              fontSize: '12px',
            }}
          >
            <option value="entry_score">Entry Point Readiness Score</option>
            <option value="ratings">Ratings Consensus</option>
            <option value="upside">Wall St Target Upside</option>
            <option value="rsi">RSI</option>
            <option value="change">Today % Change</option>
            <option value="symbol">Symbol</option>
          </select>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSortAsc(!sortAsc)}
            style={{ padding: '6px 10px', fontSize: '11px' }}
          >
            {sortAsc ? '▲ Asc' : '▼ Desc'}
          </button>
        </div>
      </div>

      {/* Candidates List / Table */}
      {filteredCandidates.length === 0 ? (
        <section className="panel empty-state" style={{ padding: '40px', textAlign: 'center' }}>
          <Database size={28} style={{ color: 'var(--muted)', marginBottom: '10px' }} />
          <h2>No matching candidate stocks</h2>
          <p>Try clearing your filter or add new candidate symbols above to evaluate entry criteria.</p>
        </section>
      ) : (
        <div className="radar-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredCandidates.map((candidate) => {
            const { assessment, ratings, targetPrice, upsidePct } = candidate
            const scoreColor =
              assessment.score >= 80 ? 'var(--green)' : assessment.score >= 60 ? 'var(--amber)' : 'var(--muted)'
            const isEntryReady = assessment.score >= 80

            return (
              <div
                key={candidate.symbol}
                className={`panel candidate-card ${isEntryReady ? 'entry-ready-card' : ''}`}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  borderLeft: `4px solid ${scoreColor}`,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Top Row: Symbol, Name, Price, Consensus, Entry Pill, Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {/* Symbol & Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                    <span className="asset-logo" style={{ width: '38px', height: '38px', fontSize: '16px' }}>
                      {candidate.symbol[0]}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '16px', letterSpacing: '0.5px' }}>{candidate.symbol}</strong>
                        <span className="sector-tag" style={{ fontSize: '11px', padding: '2px 6px' }}>
                          {candidate.sector}
                        </span>
                      </div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>{candidate.name}</small>
                    </div>
                  </div>

                  {/* Price & Today Change */}
                  <div style={{ textAlign: 'right', minWidth: '110px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>${candidate.price.toFixed(2)}</div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: candidate.dayChangePct >= 0 ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      {candidate.dayChangePct >= 0 ? `+${candidate.dayChangePct.toFixed(2)}%` : `${candidate.dayChangePct.toFixed(2)}%`}
                    </span>
                  </div>

                  {/* Ratings Consensus Badge */}
                  <div style={{ minWidth: '150px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>
                      Ratings Consensus
                    </span>
                    {ratings?.consensus ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className={`rating-label ${ratings.consensus >= 60 ? 'bullish' : 'neutral'}`}
                          style={{ fontSize: '12px', padding: '2px 8px', fontWeight: 700 }}
                        >
                          {ratings.consensusLabel} ({ratings.consensus})
                        </span>
                        <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
                          {ratings.ratings.length} sources
                        </small>
                      </div>
                    ) : (
                      <small style={{ color: 'var(--muted)' }}>Pending ratings</small>
                    )}
                  </div>

                  {/* Wall St Target & Upside */}
                  <div style={{ minWidth: '130px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>
                      Wall St Target
                    </span>
                    {targetPrice ? (
                      <div>
                        <strong style={{ fontSize: '13px' }}>${targetPrice.toFixed(2)}</strong>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            marginLeft: '6px',
                            color: (upsidePct ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                          }}
                        >
                          {(upsidePct ?? 0) >= 0 ? `+${(upsidePct ?? 0).toFixed(1)}%` : `${(upsidePct ?? 0).toFixed(1)}%`}
                        </span>
                      </div>
                    ) : (
                      <small style={{ color: 'var(--muted)' }}>—</small>
                    )}
                  </div>

                  {/* Entry Point Readiness Meter */}
                  <div style={{ minWidth: '150px', textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>
                      Entry Readiness
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <strong style={{ fontSize: '18px', color: scoreColor }}>{assessment.score}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>/ 100</span>
                      <span
                        className={`status-pill ${
                          assessment.state === 'STRONG ENTRY'
                            ? 'active'
                            : assessment.state === 'ENTRY'
                            ? 'active'
                            : assessment.state === 'APPROACHING'
                            ? 'warning'
                            : 'neutral'
                        }`}
                        style={{ fontSize: '10px', padding: '2px 8px', textTransform: 'uppercase' }}
                      >
                        {assessment.state}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => handleSelectCandidate(candidate)}
                    >
                      <Sparkles size={13} />
                      Review Setup
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      title="Arm Entry Alert"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      onClick={() => handleOpenAlertModal(candidate.symbol, candidate.price, candidate.rsi)}
                    >
                      <Bell size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Remove from Radar"
                      style={{ padding: '6px', color: 'var(--muted)' }}
                      onClick={() => handleRemoveSymbol(candidate.symbol)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Second Row: 5-Point Entry Criteria Checklist */}
                <div
                  style={{
                    background: 'var(--surface-hover)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                      Entry Criteria:
                    </span>

                    {/* Criteria 1: Ratings */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: assessment.criteria.ratingBullish ? 'var(--green)' : 'var(--muted)',
                      }}
                      title={assessment.components.ratings.detail}
                    >
                      {assessment.criteria.ratingBullish ? <CheckCircle2 size={13} /> : <span style={{ opacity: 0.5 }}>○</span>}
                      Ratings Bullish (≥65)
                    </span>

                    {/* Criteria 2: RSI Buy-Zone */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: assessment.criteria.rsiInBuyZone ? 'var(--green)' : 'var(--muted)',
                      }}
                      title={assessment.components.momentum.detail}
                    >
                      {assessment.criteria.rsiInBuyZone ? <CheckCircle2 size={13} /> : <span style={{ opacity: 0.5 }}>○</span>}
                      RSI Buy-Zone (38–58) [RSI: {candidate.rsi.toFixed(0)}]
                    </span>

                    {/* Criteria 3: Trend Support */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: assessment.criteria.trendAligned ? 'var(--green)' : 'var(--muted)',
                      }}
                      title={assessment.components.trend.detail}
                    >
                      {assessment.criteria.trendAligned ? <CheckCircle2 size={13} /> : <span style={{ opacity: 0.5 }}>○</span>}
                      Above 200 SMA
                    </span>

                    {/* Criteria 4: Volume / Breakout */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: assessment.criteria.volumeActive ? 'var(--green)' : 'var(--muted)',
                      }}
                      title={assessment.components.setup.detail}
                    >
                      {assessment.criteria.volumeActive ? <CheckCircle2 size={13} /> : <span style={{ opacity: 0.5 }}>○</span>}
                      Volume Active (≥1.0x)
                    </span>

                    {/* Criteria 5: Target Upside */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: assessment.criteria.upsideAttractive ? 'var(--green)' : 'var(--muted)',
                      }}
                      title={assessment.components.upside.detail}
                    >
                      {assessment.criteria.upsideAttractive ? <CheckCircle2 size={13} /> : <span style={{ opacity: 0.5 }}>○</span>}
                      Target Upside ≥15%
                    </span>
                  </div>

                  {/* Note / Fact snippet */}
                  {candidate.item.note && (
                    <span style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--muted)' }}>
                      Note: "{candidate.item.note}"
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Arm Alert Modal */}
      {alertModalTicker && (
        <div className="modal-backdrop" onClick={() => setAlertModalTicker(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '420px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: 'var(--green)' }} />
                <h3 style={{ margin: 0 }}>Arm Entry Alert: {alertModalTicker}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setAlertModalTicker(null)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
              Set an alert condition to be notified automatically when {alertModalTicker} triggers your entry trigger.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Alert Metric:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`secondary-button ${alertMetric === 'PRICE' ? 'active' : ''}`}
                    onClick={() => setAlertMetric('PRICE')}
                    style={{ flex: 1 }}
                  >
                    Price ($)
                  </button>
                  <button
                    type="button"
                    className={`secondary-button ${alertMetric === 'RSI' ? 'active' : ''}`}
                    onClick={() => {
                      setAlertMetric('RSI')
                      setAlertTargetPrice('45')
                      setAlertCondition('BELOW')
                    }}
                    style={{ flex: 1 }}
                  >
                    RSI Dip
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Condition:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`secondary-button ${alertCondition === 'BELOW' ? 'active' : ''}`}
                    onClick={() => setAlertCondition('BELOW')}
                    style={{ flex: 1 }}
                  >
                    At or Below (Dip Entry)
                  </button>
                  <button
                    type="button"
                    className={`secondary-button ${alertCondition === 'ABOVE' ? 'active' : ''}`}
                    onClick={() => setAlertCondition('ABOVE')}
                    style={{ flex: 1 }}
                  >
                    At or Above (Breakout)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Target Value:
                </label>
                <input
                  type="number"
                  step="any"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--foreground)',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {alertSuccessMsg && (
              <div style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '14px', fontWeight: 600 }}>
                ✓ {alertSuccessMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="secondary-button" onClick={() => setAlertModalTicker(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSaveAlert}>
                Arm Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
