import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, BarChart2, BarChart3, Bell, BrainCircuit, BriefcaseBusiness,
  Calendar, ChevronRight, CircleDollarSign, Database, Gauge, HeartPulse, LayoutDashboard, ListChecks, Menu,
  Moon, Plus, Radar, Search, ServerCog, Settings, ShieldCheck, Sparkles, Sun,
  Target, TrendingDown, TrendingUp, Upload, X, Zap, Scale, LayoutGrid, Table,
} from 'lucide-react'
import { answerQuestion, assessHolding, portfolioRisk } from './domain/engine'
import { baseAlerts, performance, scenarioAlert, scenarioHoldings } from './data/demo'
import { api } from './api/client'
import { RatingsGauge } from './components/RatingsGauge'
import { RatingsBanner } from './components/RatingsBanner'
import { RatingsConsensusChip } from './components/RatingsConsensusChip'
import { PortfolioFitPanel, PortfolioFitTag } from './components/PortfolioFit'
import { ImportPage, WatchlistPage } from './components/DataPages'
import { ModalOverlay } from './components/ModalOverlay'
import { TimeframeSelector } from './components/TimeframeSelector'
import { getTimeframeSeries } from './domain/timeframe'
import type { TimeframeKey } from './domain/timeframe'
import { Tooltip } from './components/Tooltip'
import { METRIC_TOOLTIPS } from './data/tooltips'
import { AlertPanel } from './components/AlertPanel'
import { NotificationSettingsModal } from './components/NotificationSettingsModal'
import { DecisionModal } from './components/DecisionModal'
import { RebalanceModal } from './components/RebalanceModal'
import { StockPerformance } from './components/StockPerformance'
import { CandleChart } from './components/CandleChart'
import { SectorTreemap } from './components/SectorTreemap'
import { CorrelationHeatmap } from './components/CorrelationHeatmap'
import { BenchmarkChart } from './components/BenchmarkChart'
import { CatalystRadar } from './components/CatalystRadar'
import { MorningBriefingModal } from './components/MorningBriefingModal'
import { BacktestModal } from './components/BacktestModal'
import { QuickActionsMenu } from './components/QuickActionsMenu'
import { CommandPalette } from './components/CommandPalette'
import { PortfolioSwitcher } from './components/PortfolioSwitcher'
import { resolveCompanyName } from './data/companyNames'
import { buildTickerRatings, getPriceTargets } from './domain/ratings'
import { evaluateAlert } from './domain/alertEngine'
import type { AlertItem, Holding, PortfolioSource, ScoreComponent, TickerRatings, UserAlert } from './types'


type Page = 'Overview' | 'Portfolio' | 'Signals' | 'Catalysts' | 'Watchlist' | 'Alerts' | 'Analytics' | 'Import' | 'System'

const formatCurrency = (value: number, compact = false) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: compact ? 0 : 2,
  notation: compact ? 'compact' : 'standard',
}).format(value)

const navItems = [
  { label: 'Overview' as Page, icon: LayoutDashboard },
  { label: 'Portfolio' as Page, icon: BriefcaseBusiness },
  { label: 'Signals' as Page, icon: Radar },
  { label: 'Catalysts' as Page, icon: Calendar },
  { label: 'Watchlist' as Page, icon: ListChecks },
  { label: 'Alerts' as Page, icon: Bell },
  { label: 'Analytics' as Page, icon: BarChart3 },
  { label: 'Import' as Page, icon: Upload },
  { label: 'System' as Page, icon: ServerCog },
]

function Sparkline({ values, color = 'green', fill = false }: { values: number[]; color?: 'green' | 'slate'; fill?: boolean }) {
  const width = 640
  const height = 180
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / (max - min)) * height}`).join(' ')
  const area = `0,${height} ${points} ${width},${height}`
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Performance chart">
      <defs><linearGradient id={`fade-${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color === 'green' ? '#36a879' : '#84918c'} stopOpacity=".2"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
      {[0, 1, 2, 3].map((line) => <line key={line} x1="0" x2={width} y1={line * 60} y2={line * 60} className="chart-grid" />)}
      {fill && <polygon points={area} fill={`url(#fade-${color})`} />}
      <polyline points={points} className={`chart-line ${color}`} />
    </svg>
  )
}

function StatusPill({ state }: { state: string }) {
  const key = state.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill ${key}`}>{state}</span>
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0
  return <span className={`delta ${positive ? 'positive' : 'negative'}`}>{positive ? <TrendingUp size={13}/> : <TrendingDown size={13}/>} {positive ? '+' : ''}{value.toFixed(2)}%</span>
}

function KpiCard({ label, value, detail, icon: Icon, tone = 'neutral' }: { label: React.ReactNode; value: string; detail: string; icon?: typeof Activity; tone?: 'neutral' | 'good' | 'warning' }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-top"><span>{label}</span>{Icon && <Icon size={17}/>}</div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function HoldingRow({ holding, onSelect }: { holding: Holding; onSelect: (holding: Holding) => void }) {
  const assessment = assessHolding(holding)
  const marketValue = holding.quantity * holding.price
  const totalCost = holding.quantity * holding.avgCost
  const pnl = marketValue - totalCost
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0
  const ready = holding.hasSignalInputs !== false
  const [ratings, setRatings] = useState<TickerRatings>(() => buildTickerRatings(holding.symbol))

  useEffect(() => {
    if (holding.symbol === 'CASH') return
    let active = true
    api.ratings(holding.symbol).then((real) => {
      if (active) setRatings(real)
    }).catch(() => {})
    return () => { active = false }
  }, [holding.symbol])

  const renderState = () => {
    if (holding.symbol === 'CASH') return '—'
    if (ready) return <StatusPill state={assessment.state} />
    if (ratings?.consensusLabel) return <StatusPill state={ratings.consensusLabel.toUpperCase()} />
    return '—'
  }

  const renderScore = () => {
    if (holding.symbol === 'CASH') return <>—<ChevronRight size={15}/></>
    if (ready) return <>{assessment.score}<ChevronRight size={15}/></>
    if (ratings?.consensus !== null && ratings?.consensus !== undefined) {
      return <>{Math.round(ratings.consensus)}<ChevronRight size={15}/></>
    }
    return <>—<ChevronRight size={15}/></>
  }

  return (
    <button className="holding-row extended" onClick={() => onSelect(holding)} aria-label={`Open ${holding.symbol} details`}>
      <span className="asset-cell">
        <span className={`asset-logo ${holding.symbol === 'CASH' ? 'cash' : ''}`}>{holding.symbol.slice(0, 1)}</span>
        <span>
          <strong>{holding.symbol}</strong>
          {holding.name && holding.name !== holding.symbol && <small>{holding.name}</small>}
        </span>
      </span>
      <span>{holding.symbol === 'CASH' ? '—' : formatCurrency(holding.price)}</span>
      <span>{holding.symbol === 'CASH' ? '—' : holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      <span>{holding.symbol === 'CASH' ? '—' : formatCurrency(holding.avgCost)}</span>
      <span>{holding.symbol === 'CASH' ? formatCurrency(marketValue) : formatCurrency(marketValue, true)}</span>
      <span>{holding.weight.toFixed(1)}%</span>
      <span><Delta value={holding.dayChange}/></span>
      <span className={pnlPct >= 0 ? 'value-positive' : 'value-negative'}>
        {holding.symbol === 'CASH' ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
      </span>
      <span className={pnl >= 0 ? 'value-positive' : 'value-negative'}>
        {holding.symbol === 'CASH' ? '—' : `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl, true)}`}
      </span>
      <span>{renderState()}</span>
      <span className="score-cell">{renderScore()}</span>
    </button>
  )
}

function ComponentBar({ component }: { component: ScoreComponent }) {
  return (
    <div className="component-bar">
      <div><span>{component.label}</span><strong>{component.score}<small>/{component.max}</small></strong></div>
      <div className="bar-track"><span style={{ width: `${component.score / component.max * 100}%` }} /></div>
    </div>
  )
}

function AssetDrawer({ holding, holdings, onClose, onOpenDecision }: { holding: Holding; holdings: Holding[]; onClose: () => void; onOpenDecision?: () => void }) {
  const assessment = assessHolding(holding)
  const ready = holding.hasSignalInputs !== false
  const targets = getPriceTargets(holding.symbol, holding.price)

  const saDiff = targets.saWallStreet ? targets.saWallStreet - holding.price : 0
  const saDiffPct = holding.price > 0 ? (saDiff / holding.price) * 100 : 0
  const zacksDiff = targets.zacks ? targets.zacks - holding.price : 0
  const zacksDiffPct = holding.price > 0 ? (zacksDiff / holding.price) * 100 : 0

  return (
    <ModalOverlay className="asset-drawer" label={`${holding.symbol} signal explanation`} onClose={onClose}>
        <button className="icon-button drawer-close" onClick={onClose} aria-label="Close drawer"><X size={19}/></button>
        <div className="drawer-heading">
          <span className="asset-logo large">{holding.symbol[0]}</span>
          <div><p>{holding.name && holding.name !== holding.symbol ? holding.name : 'HOLDING'}</p><h2>{holding.symbol}</h2></div>
        </div>
        <div className="drawer-quote"><div><span>Current price</span><strong>{formatCurrency(holding.price)}</strong></div><Delta value={holding.dayChange}/></div>
        
        {ready ? <>
        <section className="signal-verdict">
          <div className="score-ring"><strong>{assessment.score}</strong><span>/100</span></div>
          <div>
            <StatusPill state={assessment.state}/>
            <h3>{assessment.state === 'ENTRY' || assessment.state === 'STRONG ENTRY' ? 'Conditions align' : 'Setup is developing'}</h3>
            <p>Deterministic model · default_swing_v1</p>
            {onOpenDecision && (
              <button className="ask-button" onClick={onOpenDecision} style={{ marginTop: '8px', padding: '6px 10px', fontSize: '10px' }}>
                <Target size={13} /> View Decision Directive
              </button>
            )}
          </div>
        </section>
        <section className="drawer-section"><div className="section-heading"><div><span className="eyebrow">SCORE BREAKDOWN</span><h3>Why it ranked here</h3></div></div>{assessment.components.map((component) => <ComponentBar key={component.label} component={component}/>)}</section>
        <section className="drawer-section"><span className="eyebrow">OBSERVED FACTS</span><ul className="fact-list">{assessment.facts.map((fact) => <li key={fact}><ShieldCheck size={16}/><span>{fact}</span></li>)}</ul></section>
        </> : <section className="drawer-section signal-nodata"><Database size={17}/><div><strong>Signals need market data</strong><span>This uploaded holding has no technical columns (RSI / MACD / SMA). Value, weight, concentration and portfolio fit below are still exact.</span></div></section>}
        
        {/* Wall Street & Zacks Price Targets Card */}
        {holding.symbol !== 'CASH' && (
          <section className="target-card">
            <div className="target-card-heading">
              <span className="eyebrow">ANALYST TARGETS &amp; SPREAD</span>
              <Target size={16} color="var(--accent-dark)" />
            </div>
            <div className="target-grid">
              <div className="target-box">
                <span>SA Wall St Consensus Target</span>
                <strong>{targets.saWallStreet != null ? formatCurrency(targets.saWallStreet) : '—'}</strong>
                {targets.saWallStreet != null ? (
                  <small className={saDiff >= 0 ? 'upside-positive' : 'upside-negative'}>
                    {saDiff >= 0 ? '+' : ''}{formatCurrency(saDiff)} ({saDiffPct >= 0 ? '+' : ''}{saDiffPct.toFixed(1)}%)
                  </small>
                ) : (
                  <small style={{ color: 'var(--muted)' }}>No SA consensus target</small>
                )}
                {targets.saHigh != null && targets.saLow != null && (
                  <div style={{ fontSize: '8px', color: 'var(--muted)', marginTop: '4px' }}>
                    Range: ${targets.saLow} - ${targets.saHigh}
                  </div>
                )}
              </div>
              <div className="target-box">
                <span>Zacks Target Price</span>
                <strong>{targets.zacks != null ? formatCurrency(targets.zacks) : '—'}</strong>
                {targets.zacks != null ? (
                  <small className={zacksDiff >= 0 ? 'upside-positive' : 'upside-negative'}>
                    {zacksDiff >= 0 ? '+' : ''}{formatCurrency(zacksDiff)} ({zacksDiffPct >= 0 ? '+' : ''}{zacksDiffPct.toFixed(1)}%)
                  </small>
                ) : (
                  <small style={{ color: 'var(--muted)' }}>No Zacks target</small>
                )}
                <div style={{ fontSize: '8px', color: 'var(--muted)', marginTop: '4px' }}>
                  Quant Revision Signal
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Interactive Candlestick & Technical Indicator Chart */}
        {holding.symbol !== 'CASH' && <CandleChart symbol={holding.symbol} />}

        {/* Stock Time-Related Performance Analysis */}
        {holding.symbol !== 'CASH' && <StockPerformance holding={holding} />}

        <PortfolioFitPanel holding={holding} holdings={holdings}/>
        <RatingsGauge symbol={holding.symbol}/>
        <section className="provenance"><Database size={17}/><div><strong>Source is current</strong><span>Seeded market feed · as of 14:42 ET · calculations local</span></div></section>
    </ModalOverlay>
  )
}


function AskPanel({ holdings, onClose }: { holdings: Holding[]; onClose: () => void }) {
  const prompts = ['What changed today?', 'Which signal needs attention?', 'Where is concentration risk?', 'Why is CRDO ranked first?']
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const ask = (text: string) => { setQuestion(text); setAnswer(answerQuestion(text, holdings)) }
  return (
    <ModalOverlay className="ask-drawer" label="Ask Atlas" onClose={onClose}>
        <button className="icon-button drawer-close" onClick={onClose}><X size={19}/></button>
        <div className="ask-heading"><span><BrainCircuit size={21}/></span><div><p>Grounded assistant</p><h2>Ask Atlas</h2></div></div>
        <p className="ask-intro">Ask about changes, signals, risk, or data provenance. Every answer is generated from the metrics visible in this demo.</p>
        <div className="prompt-list">{prompts.map((prompt) => <button key={prompt} onClick={() => ask(prompt)}>{prompt}<ArrowRight size={15}/></button>)}</div>
        {answer && <div className="answer-card"><span className="eyebrow">ANSWER</span><p>{answer}</p><small><ShieldCheck size={14}/> Derived from deterministic portfolio data</small></div>}
        <form className="ask-form" onSubmit={(event) => { event.preventDefault(); if (question.trim()) ask(question) }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question…"/><button><ArrowRight size={17}/></button></form>
    </ModalOverlay>
  )
}

function Overview({ holdings, scenario, onSelect, onAsk, onOpenDecision, onNavigate }: { holdings: Holding[]; scenario: boolean; onSelect: (holding: Holding) => void; onAsk: () => void; onOpenDecision: (holding: Holding) => void; onNavigate?: (page: Page) => void }) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1Y')
  const ranked = useMemo(() => holdings.filter((h) => h.symbol !== 'CASH').map((holding) => {
    const ready = holding.hasSignalInputs !== false
    const assessment = assessHolding(holding)
    const ext = buildTickerRatings(holding.symbol)
    return {
      holding,
      assessment,
      ready,
      displayScore: ready ? assessment.score : (ext.consensus !== null ? Math.round(ext.consensus) : 0),
      displayState: ready ? assessment.state : (ext.consensusLabel ? ext.consensusLabel.toUpperCase() : 'NO SETUP'),
      fact: ready ? assessment.facts[0] : (ext.consensusLabel ? `Consensus: ${ext.consensusLabel} (${Math.round(ext.consensus || 0)})` : 'Imported holding'),
    }
  }).sort((a, b) => (Number(b.ready) - Number(a.ready)) || (b.displayScore - a.displayScore)), [holdings])
  const risk = portfolioRisk(holdings)

  const series = useMemo(() => getTimeframeSeries(performance.portfolio, performance.benchmark, timeframe), [timeframe])

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">DECISION BRIEFING · 14:42 ET</span>
          <h1>Good afternoon, Ohad</h1>
          <p>Here’s what changed and what needs attention.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="ask-button" style={{ background: 'var(--ink)' }} onClick={() => onOpenDecision(ranked[0]?.holding || holdings[0])}>
            <Target size={16} /> Strategy Decision
          </button>
          <button className="ask-button" onClick={onAsk}><Sparkles size={17}/> Ask Atlas</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Portfolio value" value="$715,520" detail="+$4,272 today" icon={CircleDollarSign} tone="good"/>
        <KpiCard label="Year to date" value={`${series.portfolioReturn >= 0 ? '+' : ''}${series.portfolioReturn.toFixed(2)}%`} detail={`${series.alpha >= 0 ? '+' : ''}${series.alpha.toFixed(2)}% vs SPY`} icon={TrendingUp} tone="good"/>
        <KpiCard 
          label={<Tooltip content={METRIC_TOOLTIPS.unrealizedPnL}>Unrealized P/L</Tooltip>} 
          value="+$81,244" 
          detail="+12.81% total return" 
          icon={Activity} 
        />
        <KpiCard label="Risk posture" value={risk.status} detail={`${risk.largestSector} ${risk.sectorWeight.toFixed(1)}%`} icon={Gauge} tone={risk.status === 'Elevated' ? 'warning' : 'neutral'}/>
        <KpiCard label="Data confidence" value="Current" detail="Latest update 18 sec ago" icon={ShieldCheck} tone="good"/>

      </div>

      <div className="overview-grid">
        <section className="panel performance-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PERFORMANCE ANALYSIS</span>
              <h2>Portfolio vs benchmark</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <TimeframeSelector selected={timeframe} onChange={setTimeframe} />
              <div className="legend">
                <span><i className="green-dot"/> Portfolio {series.portfolioReturn >= 0 ? '+' : ''}{series.portfolioReturn.toFixed(1)}%</span>
                <span><i className="gray-dot"/> SPY {series.benchmarkReturn >= 0 ? '+' : ''}{series.benchmarkReturn.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="chart-wrap">
            <Sparkline values={series.benchmark} color="slate"/>
            <div className="chart-overlay">
              <Sparkline values={series.portfolio} color="green" fill/>
            </div>
          </div>
          <div className="month-axis">{['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'].slice(-series.portfolio.length).map((m) => <span key={m}>{m}</span>)}</div>
        </section>

        <section className="panel allocation-panel">
          <div className="section-heading"><div><span className="eyebrow">EXPOSURE</span><h2>Allocation</h2></div><button className="text-button" onClick={() => onNavigate && onNavigate('Analytics')}>View analysis <ArrowRight size={14}/></button></div>
          <div className="allocation-content"><div className="donut"><div><strong>$715K</strong><span>total value</span></div></div><div className="allocation-list"><div><i className="seg semi"/><span>Semiconductors</span><strong>36.2%</strong></div><div><i className="seg software"/><span>Software</span><strong>21.3%</strong></div><div><i className="seg infra"/><span>Infrastructure</span><strong>20.0%</strong></div><div><i className="seg other"/><span>Diversifiers &amp; cash</span><strong>22.5%</strong></div></div></div>
          <div className="risk-note"><AlertTriangle size={16}/><span>Semiconductors are <strong>1.2% above</strong> the target limit.</span></div>
        </section>

        <section className="panel signals-panel">
          <div className="section-heading"><div><span className="eyebrow">PRIORITIZED</span><h2>Signals to review</h2></div><button className="text-button" onClick={() => onNavigate && onNavigate('Signals')}>View all <ArrowRight size={14}/></button></div>
          <div className="signal-list">{ranked.slice(0, 4).map(({ holding, displayState, displayScore, fact }, index) => <button key={holding.symbol} onClick={() => onSelect(holding)}><span className="rank">0{index + 1}</span><span className="asset-logo">{holding.symbol[0]}</span><span className="signal-name"><strong>{holding.symbol}</strong><small>{fact}</small></span><StatusPill state={displayState}/><strong className="signal-score">{displayScore > 0 ? displayScore : '—'}</strong><ChevronRight size={16}/></button>)}</div>
        </section>

        <section className="panel attention-panel">
          <div className="section-heading"><div><span className="eyebrow">WHAT CHANGED</span><h2>Attention feed</h2></div><span className="live-indicator"><i/> Live</span></div>
          <div className="attention-list">
            {scenario && <button onClick={() => { const h = holdings.find(item => item.symbol === 'CRDO') || holdings[0]; onOpenDecision(h); }}><span className="attention-icon critical"><Target size={17}/></span><span><strong>CRDO moved to Strong Entry</strong><small>Score 65 → 90 · breakout confirmed</small></span><time>Now</time></button>}
            <button onClick={() => { const h = holdings.find(item => item.sector === 'Semiconductors') || holdings[0]; onOpenDecision(h); }}><span className="attention-icon warning"><AlertTriangle size={17}/></span><span><strong>Concentration threshold exceeded</strong><small>Semiconductors reached 36.2%</small></span><time>12m</time></button>
            <button onClick={() => onNavigate && onNavigate('Analytics')}><span className="attention-icon"><TrendingUp size={17}/></span><span><strong>Portfolio extended its lead</strong><small>Relative return vs SPY is now +7.3%</small></span><time>34m</time></button>
            <button onClick={() => onNavigate && onNavigate('System')}><span className="attention-icon"><Database size={17}/></span><span><strong>Daily data validation passed</strong><small>11 symbols · no gaps detected</small></span><time>1h</time></button>
          </div>
        </section>
      </div>
    </>
  )
}

type PortfolioSortKey = 'symbol' | 'price' | 'quantity' | 'avgCost' | 'marketValue' | 'weight' | 'dayChange' | 'unrealizedPct' | 'unrealizedVal' | 'state' | 'score'

function PortfolioPage({ 
  holdings, 
  onSelect,
  onRefresh,
  refreshing,
  onOpenRebalance,
}: { 
  holdings: Holding[]
  onSelect: (holding: Holding) => void
  onRefresh?: () => void
  refreshing?: boolean
  onOpenRebalance?: () => void
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<PortfolioSortKey>('weight')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'table' | 'treemap'>('table')

  const handleSort = (key: PortfolioSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' || key === 'state' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    return holdings.filter((h) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return h.symbol.toLowerCase().includes(q) || (h.name && h.name.toLowerCase().includes(q)) || (h.sector && h.sector.toLowerCase().includes(q))
    })
  }, [holdings, search])

  const sortedHoldings = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let vA: number | string = 0
      let vB: number | string = 0
      switch (sortKey) {
        case 'symbol':
          return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
        case 'price':
          vA = a.price
          vB = b.price
          break
        case 'quantity':
          vA = a.quantity
          vB = b.quantity
          break
        case 'avgCost':
          vA = a.avgCost
          vB = b.avgCost
          break
        case 'marketValue':
          vA = a.quantity * a.price
          vB = b.quantity * b.price
          break
        case 'weight':
          vA = a.weight
          vB = b.weight
          break
        case 'dayChange':
          vA = a.dayChange
          vB = b.dayChange
          break
        case 'unrealizedPct': {
          const cA = a.avgCost || a.price
          const cB = b.avgCost || b.price
          vA = cA > 0 ? ((a.price - cA) / cA) * 100 : 0
          vB = cB > 0 ? ((b.price - cB) / cB) * 100 : 0
          break
        }
        case 'unrealizedVal': {
          const cA = a.avgCost || a.price
          const cB = b.avgCost || b.price
          vA = (a.price - cA) * a.quantity
          vB = (b.price - cB) * b.quantity
          break
        }
        case 'state': {
          const sA = assessHolding(a).state
          const sB = assessHolding(b).state
          return sortDir === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA)
        }
        case 'score': {
          vA = assessHolding(a).score
          vB = assessHolding(b).score
          break
        }
      }
      return sortDir === 'asc' ? (vA as number) - (vB as number) : (vB as number) - (vA as number)
    })
  }, [filtered, sortKey, sortDir])

  const renderSortArrow = (key: PortfolioSortKey) => (
    <span className="sort-arrow">{sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
  )

  return (
    <>
      <PageHeading eyebrow="CURRENT POSITION" title="Portfolio" copy="A complete view of exposure, position sizing, cost basis, performance, and signal state."/>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16}/>
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search holdings by symbol, name, or sector…"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden', backgroundColor: 'var(--surface-subtle)' }}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  background: viewMode === 'table' ? 'var(--accent-dark)' : 'transparent',
                  color: viewMode === 'table' ? '#fff' : 'var(--muted)',
                  cursor: 'pointer'
                }}
              >
                <Table size={13} /> Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('treemap')}
                style={{
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  background: viewMode === 'treemap' ? 'var(--accent-dark)' : 'transparent',
                  color: viewMode === 'treemap' ? '#fff' : 'var(--muted)',
                  cursor: 'pointer'
                }}
              >
                <LayoutGrid size={13} /> Heatmap
              </button>
            </div>
            {onOpenRebalance && (
              <button
                type="button"
                className="banner-primary"
                onClick={onOpenRebalance}
                title="Model-based portfolio rebalance and trade execution"
              >
                <Scale size={14} /> Rebalance &amp; Trade
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                className="refresh-data-btn"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh live market quotes and recalculate technical signals"
              >
                <Zap size={14} className={refreshing ? 'spin' : ''} />
                {refreshing ? 'Refreshing…' : '⚡ Refresh All Data'}
              </button>
            )}
            <button className="secondary-button" onClick={() => {
              const rows = ['Symbol,Name,Sector,Price,Shares,AvgCost,Weight,DayChange,Value']
              holdings.forEach((h) => rows.push(`${h.symbol},"${h.name || ''}",${h.sector},${h.price},${h.quantity},${h.avgCost},${h.weight}%,${h.dayChange}%,${(h.quantity * h.price).toFixed(2)}`))
              const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'atlas_portfolio.csv'
              a.click()
            }}>Export CSV</button>
          </div>
        </div>
        {viewMode === 'treemap' ? (
          <div style={{ padding: '0 16px 16px 16px' }}>
            <SectorTreemap holdings={filtered} onSelect={onSelect} />
          </div>
        ) : (
          <>
            <div className="table-head extended">
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'symbol' ? 'active' : ''}`} onClick={() => handleSort('symbol')}>
                  Asset {renderSortArrow('symbol')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'price' ? 'active' : ''}`} onClick={() => handleSort('price')}>
                  Price {renderSortArrow('price')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'quantity' ? 'active' : ''}`} onClick={() => handleSort('quantity')}>
                  <Tooltip content={METRIC_TOOLTIPS.shares}>Shares</Tooltip> {renderSortArrow('quantity')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'avgCost' ? 'active' : ''}`} onClick={() => handleSort('avgCost')}>
                  <Tooltip content={METRIC_TOOLTIPS.costBasis}>Avg Cost</Tooltip> {renderSortArrow('avgCost')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'marketValue' ? 'active' : ''}`} onClick={() => handleSort('marketValue')}>
                  <Tooltip content={METRIC_TOOLTIPS.totalCost}>Market Value</Tooltip> {renderSortArrow('marketValue')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'weight' ? 'active' : ''}`} onClick={() => handleSort('weight')}>
                  Weight {renderSortArrow('weight')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'dayChange' ? 'active' : ''}`} onClick={() => handleSort('dayChange')}>
                  Today {renderSortArrow('dayChange')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'unrealizedPct' ? 'active' : ''}`} onClick={() => handleSort('unrealizedPct')}>
                  <Tooltip content={METRIC_TOOLTIPS.unrealizedPct}>Unrealized %</Tooltip> {renderSortArrow('unrealizedPct')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'unrealizedVal' ? 'active' : ''}`} onClick={() => handleSort('unrealizedVal')}>
                  <Tooltip content={METRIC_TOOLTIPS.unrealizedVal}>Unrealized Value</Tooltip> {renderSortArrow('unrealizedVal')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'state' ? 'active' : ''}`} onClick={() => handleSort('state')}>
                  State {renderSortArrow('state')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'score' ? 'active' : ''}`} onClick={() => handleSort('score')}>
                  Score {renderSortArrow('score')}
                </button>
              </span>
            </div>
            {sortedHoldings.map((holding) => <HoldingRow key={holding.symbol} holding={holding} onSelect={onSelect}/>)}
          </>
        )}
      </section>
    </>
  )
}

type SignalSortKey = 'score' | 'symbol' | 'dayChange' | 'state'

function SignalsPage({ holdings, onSelect }: { holdings: Holding[]; onSelect: (holding: Holding) => void }) {
  const [sortKey, setSortKey] = useState<SignalSortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SignalSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' || key === 'state' ? 'asc' : 'desc')
    }
  }

  const ranked = useMemo(() => {
    const list = holdings.filter((h) => h.symbol !== 'CASH').map((holding) => ({ 
      holding, 
      assessment: assessHolding(holding), 
      ready: holding.hasSignalInputs !== false 
    }))
    return list.sort((a, b) => {
      if (sortKey === 'score') {
        const diff = (Number(b.ready) - Number(a.ready)) || (sortDir === 'desc' ? b.assessment.score - a.assessment.score : a.assessment.score - b.assessment.score)
        return diff
      }
      if (sortKey === 'symbol') {
        return sortDir === 'asc' ? a.holding.symbol.localeCompare(b.holding.symbol) : b.holding.symbol.localeCompare(a.holding.symbol)
      }
      if (sortKey === 'dayChange') {
        return sortDir === 'desc' ? b.holding.dayChange - a.holding.dayChange : a.holding.dayChange - b.holding.dayChange
      }
      if (sortKey === 'state') {
        return sortDir === 'asc' ? a.assessment.state.localeCompare(b.assessment.state) : b.assessment.state.localeCompare(a.assessment.state)
      }
      return 0
    })
  }, [holdings, sortKey, sortDir])

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">EXPLAINABLE PRIORITIZATION</span>
          <h1>Signal center</h1>
          <p>Ranked setups with every contributing rule visible.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Sort by:</span>
          <button type="button" className={`secondary-button ${sortKey === 'score' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'score' ? 700 : 500 }} onClick={() => handleSort('score')}>
            Score {sortKey === 'score' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </button>
          <button type="button" className={`secondary-button ${sortKey === 'symbol' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'symbol' ? 700 : 500 }} onClick={() => handleSort('symbol')}>
            Symbol {sortKey === 'symbol' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </button>
          <button type="button" className={`secondary-button ${sortKey === 'dayChange' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'dayChange' ? 700 : 500 }} onClick={() => handleSort('dayChange')}>
            Today % {sortKey === 'dayChange' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </button>
          <button type="button" className={`secondary-button ${sortKey === 'state' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'state' ? 700 : 500 }} onClick={() => handleSort('state')}>
            State {sortKey === 'state' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </button>
        </div>
      </div>
      <div className="signal-cards">
        {ranked.map(({ holding, assessment, ready }, index) => (
          <button className={`signal-card ${ready ? '' : 'muted'}`} key={holding.symbol} onClick={() => onSelect(holding)}>
            <span className="signal-card-rank">{ready ? String(index + 1).padStart(2, '0') : '—'}</span>
            <div className="signal-card-main">
              <div>
                <span className="asset-logo">{holding.symbol[0]}</span>
                <span><strong>{holding.symbol}</strong>{holding.name && holding.name !== holding.symbol && <small>{holding.name}</small>}</span>
              </div>
              <span className="signal-card-tags">
                <PortfolioFitTag holding={holding} holdings={holdings}/>
                <RatingsConsensusChip symbol={holding.symbol}/>
                {ready && <StatusPill state={assessment.state}/>}
              </span>
            </div>
            {ready ? (
              <>
                <div className="signal-card-score"><strong>{assessment.score}</strong><span>/ 100</span></div>
                <div className="mini-components">
                  {assessment.components.map((component) => (
                    <div key={component.label}><span>{component.label}</span><i><b style={{width: `${component.score/component.max*100}%`}}/></i></div>
                  ))}
                </div>
                <p>{assessment.facts.slice(0, 2).join(' · ')}</p>
                <span className="review-link">Review explanation <ArrowRight size={15}/></span>
              </>
            ) : (
              <>
                <div className="signal-card-nodata"><Database size={15}/> Signals need market data</div>
                <p>Add RSI / MACD / SMA columns to score this holding.</p>
              </>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

function getOrBuildHolding(symbol: string, holdings: Holding[]): Holding {
  const sym = symbol.toUpperCase()
  const inHoldings = holdings.find((h) => h.symbol.toUpperCase() === sym)
  if (inHoldings) return inHoldings

  const inDemo = scenarioHoldings(true).find((h) => h.symbol.toUpperCase() === sym)
  if (inDemo) return inDemo

  const targets = getPriceTargets(sym)
  const price = targets.saWallStreet || targets.zacks || 100
  return {
    symbol: sym,
    name: resolveCompanyName(sym) || sym,
    sector: 'Equities',
    price,
    dayChange: 0,
    quantity: 100,
    avgCost: price * 0.95,
    weight: 5.0,
    rsi: 55,
    macdBullish: true,
    aboveSma50: true,
    aboveSma200: true,
    relativeVolume: 1.1,
    breakout20d: false,
    trendSlopePositive: true,
    hasSignalInputs: true,
  }
}

function AlertDetailModal({
  alert,
  holdings,
  onClose,
  onInspectSymbol,
  onNavigate,
  onOpenDecision,
}: {
  alert: AlertItem | UserAlert
  holdings: Holding[]
  onClose: () => void
  onInspectSymbol: (symbol: string) => void
  onNavigate: (page: Page) => void
  onOpenDecision: (holding: Holding) => void
}) {
  const isUserAlert = 'metric' in alert && 'createdAt' in alert
  const symbol = alert.symbol
  const isPortfolioAlert = !symbol || symbol.toUpperCase() === 'PORTFOLIO'

  return (
    <ModalOverlay label="Alert Details" className="asset-drawer" onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close alert details"><X size={19}/></button>
      
      <div className="drawer-heading">
        <span className="attention-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: alert.severity === 'critical' ? 'var(--red-soft)' : alert.severity === 'warning' ? 'var(--amber-soft)' : 'var(--accent-soft)', color: alert.severity === 'critical' ? 'var(--red)' : alert.severity === 'warning' ? 'var(--amber)' : 'var(--accent-dark)', display: 'grid', placeItems: 'center' }}>
          <Bell size={22}/>
        </span>
        <div>
          <span className="eyebrow">ALERT INSPECTION &amp; DIRECTIVE</span>
          <h2 style={{ margin: '4px 0', fontSize: '18px' }}>
            {isUserAlert ? `${alert.symbol} · ${alert.metric} Alert` : alert.title}
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '14px 0' }}>
        <StatusPill state={alert.status}/>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          {isUserAlert ? 'User Configured Threshold' : `Triggered: ${alert.time}`}
        </span>
      </div>

      <section className="drawer-section">
        <span className="eyebrow">TRIGGER CONDITION &amp; REASONING</span>
        <div style={{ background: '#f6f8f7', padding: '14px', borderRadius: '10px', marginTop: '6px', border: '1px solid var(--line)' }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--ink)' }}>
            {isUserAlert 
              ? `Monitors ${alert.symbol} for threshold: ${alert.metric} ${alert.condition} ${alert.targetValue}.`
              : (alert as AlertItem).message}
          </p>
        </div>
      </section>

      <section className="drawer-section">
        <span className="eyebrow">RECOMMENDED ACTIONS</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
          {symbol && (
            <button
              className="ask-button"
              style={{ justifyContent: 'center', padding: '11px 16px', fontSize: '13px' }}
              onClick={() => {
                onClose()
                onInspectSymbol(symbol)
              }}
            >
              <Target size={16} /> Inspect {symbol} Setup &amp; Price Targets <ArrowRight size={15}/>
            </button>
          )}

          {isPortfolioAlert && (
            <>
              <button
                className="ask-button"
                style={{ justifyContent: 'center', padding: '11px 16px', fontSize: '13px' }}
                onClick={() => {
                  onClose()
                  onNavigate('Analytics')
                }}
              >
                <TrendingUp size={16} /> Open Risk Analytics &amp; Stress Testing <ArrowRight size={15}/>
              </button>
              <button
                className="ask-button"
                style={{ justifyContent: 'center', padding: '11px 16px', fontSize: '13px', background: 'var(--ink)' }}
                onClick={() => {
                  onClose()
                  const h = holdings.find((x) => x.sector === 'Semiconductors') || holdings[0]
                  onOpenDecision(h)
                }}
              >
                <Target size={16} /> Open Strategy Decision Directive <ArrowRight size={15}/>
              </button>
            </>
          )}

          <button
            type="button"
            className="secondary-button"
            style={{ justifyContent: 'center', padding: '9px 14px', fontSize: '12px' }}
            onClick={onClose}
          >
            Close Alert Details
          </button>
        </div>
      </section>
    </ModalOverlay>
  )
}

function AlertsPage({
  alerts,
  userAlerts,
  holdings,
  onSelect,
  onNavigate,
  onOpenDecision,
  onOpenPanel,
}: {
  alerts: AlertItem[]
  userAlerts: UserAlert[]
  holdings: Holding[]
  onSelect: (holding: Holding) => void
  onNavigate: (page: Page) => void
  onOpenDecision: (holding: Holding) => void
  onOpenPanel: () => void
}) {
  const [inspectingAlert, setInspectingAlert] = useState<AlertItem | UserAlert | null>(null)
  const totalCount = alerts.length + userAlerts.length

  const handleInspectSymbol = (sym: string) => {
    const h = getOrBuildHolding(sym, holdings)
    onSelect(h)
  }

  const handleAction = (alert: AlertItem | UserAlert) => {
    if (alert.symbol && alert.symbol.toUpperCase() !== 'PORTFOLIO') {
      handleInspectSymbol(alert.symbol)
    } else {
      onNavigate('Analytics')
    }
  }

  return (
    <>
      <PageHeading eyebrow="CONTROLLED NOTIFICATIONS" title="Alerts" copy="Every trigger is persisted, explained, and protected from repeat firing."/>
      <div className="alert-summary">
        <KpiCard label="Triggered" value={String(alerts.filter(a => a.status === 'TRIGGERED').length)} detail="Needs review" icon={AlertTriangle} tone="warning"/>
        <KpiCard label="Armed & Active" value={String(totalCount)} detail="Monitoring conditions" icon={Radar}/>
        <KpiCard label="Cooldown" value={String(alerts.filter(a => a.status === 'COOLDOWN').length)} detail="Repeat alerts suppressed" icon={Gauge}/>
      </div>
      <section className="panel alerts-table">
        <div className="tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '22px' }}>
            <button className="active">Active ({totalCount})</button>
            <button>Triggered</button>
            <button>History</button>
          </div>
          <button className="ask-button" onClick={onOpenPanel} style={{ padding: '6px 12px', fontSize: '10px' }}>
            <Plus size={14} /> Create Custom Alert
          </button>
        </div>
        
        {userAlerts.map((ua) => (
          <div 
            className="alert-row" 
            key={ua.id}
            role="button"
            tabIndex={0}
            onClick={() => setInspectingAlert(ua)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setInspectingAlert(ua)
              }
            }}
          >
            <span className={`attention-icon ${ua.severity}`}><Bell size={17}/></span>
            <span className="alert-copy">
              <strong>{ua.symbol} · {ua.metric} {ua.condition} {ua.targetValue}</strong>
              <small>User configured alert threshold · Click to inspect</small>
            </span>
            <StatusPill state="ARMED"/>
            <time>Now</time>
            <button 
              className="icon-button"
              onClick={(e) => {
                e.stopPropagation()
                handleAction(ua)
              }}
              title={`Inspect ${ua.symbol} in Asset Drawer`}
              aria-label={`Inspect ${ua.symbol}`}
            >
              <ChevronRight size={17}/>
            </button>
          </div>
        ))}

        {alerts.map((alert) => (
          <div 
            className="alert-row" 
            key={alert.id}
            role="button"
            tabIndex={0}
            onClick={() => setInspectingAlert(alert)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setInspectingAlert(alert)
              }
            }}
          >
            <span className={`attention-icon ${alert.severity}`}><Bell size={17}/></span>
            <span className="alert-copy">
              <strong>{alert.symbol ? `${alert.symbol} · ` : ''}{alert.title}</strong>
              <small>{alert.message}</small>
            </span>
            <StatusPill state={alert.status}/>
            <time>{alert.time}</time>
            <button 
              className="icon-button"
              onClick={(e) => {
                e.stopPropagation()
                handleAction(alert)
              }}
              title={alert.symbol ? `Inspect ${alert.symbol} in Asset Drawer` : 'View in Risk Analytics'}
              aria-label={alert.symbol ? `Inspect ${alert.symbol}` : 'View in Risk Analytics'}
            >
              <ChevronRight size={17}/>
            </button>
          </div>
        ))}
        {userAlerts.length === 0 && alerts.length === 0 && (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>No active triggers or custom alerts</p>
            <p style={{ fontSize: '11px', maxWidth: '380px', margin: '0 auto 16px' }}>
              Your portfolio is operating within standard risk parameters. Create custom price, RSI, or breakout alerts to monitor specific holdings.
            </p>
            <button className="ask-button" onClick={onOpenPanel} style={{ padding: '7px 16px', fontSize: '11px', margin: '0 auto' }}>
              <Plus size={14} /> Create Your First Alert
            </button>
          </div>
        )}
      </section>

      {inspectingAlert && (
        <AlertDetailModal
          alert={inspectingAlert}
          holdings={holdings}
          onClose={() => setInspectingAlert(null)}
          onInspectSymbol={handleInspectSymbol}
          onNavigate={onNavigate}
          onOpenDecision={onOpenDecision}
        />
      )}
    </>
  )
}

function AnalyticsPage({ holdings, onOpenBacktest }: { holdings: Holding[]; onOpenBacktest?: () => void }) {
  const risk = portfolioRisk(holdings)
  const [shockPct, setShockPct] = useState(10)

  const portfolioBeta = 1.24
  const portfolioDropPct = shockPct * portfolioBeta
  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.price), 0) || 715520
  const lossAmount = totalValue * (portfolioDropPct / 100)
  const postValue = totalValue - lossAmount

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <PageHeading eyebrow="PORTFOLIO CONTEXT" title="Risk analytics & Stress Testing" copy="Beta sensitivity, 95% Parametric VaR, and interactive market shock simulation." />
        {onOpenBacktest && (
          <button
            className="ask-button"
            onClick={onOpenBacktest}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', marginTop: '8px' }}
          >
            <BarChart2 size={15} /> Launch Strategy Backtester
          </button>
        )}
      </div>
      <div className="analytics-grid">
        <section className="panel risk-hero">
          <span className="eyebrow">RISK POSTURE</span>
          <div className="risk-score"><strong>64</strong><span>/100</span></div>
          <h2>Elevated, but controlled</h2>
          <p>Sector concentration is the primary contributor. Market and drawdown indicators remain within limits.</p>
          <div className="risk-scale"><i /><b style={{ left: '64%' }} /></div>
        </section>

        <section className="panel">
          <span className="eyebrow">CONCENTRATION</span>
          <h2>Exposure limits</h2>
          <div className="limit-list">
            <div><span><strong>Largest position</strong><small>Limit 20%</small></span><b>{risk.largest.toFixed(1)}%</b></div>
            <div><span><strong>Top five holdings</strong><small>Limit 70%</small></span><b>{risk.topFive.toFixed(1)}%</b></div>
            <div className="over"><span><strong>{risk.largestSector}</strong><small>Limit 35%</small></span><b>{risk.sectorWeight.toFixed(1)}%</b></div>
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">VOLATILITY METRICS</span>
          <h2>Beta &amp; Value-at-Risk</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '9px', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}><Tooltip content={METRIC_TOOLTIPS.beta}>Portfolio Beta vs SPY</Tooltip></span>
              <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: 'var(--accent-dark)' }}>{portfolioBeta.toFixed(2)}x</strong>
              <small style={{ fontSize: '9px', color: 'var(--muted)' }}>High growth sensitivity</small>
            </div>
            <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '9px', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}><Tooltip content={METRIC_TOOLTIPS.var95}>1-Day 95% Parametric VaR</Tooltip></span>
              <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#c48017' }}>${Math.round(totalValue * 0.0199).toLocaleString()}</strong>
              <small style={{ fontSize: '9px', color: 'var(--muted)' }}>Max loss at 95% confidence (1.99%)</small>
            </div>
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">STRESS TESTING</span>
          <h2>Market Shock Simulator</h2>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
              <span>Simulated Market Drop (SPY)</span>
              <strong style={{ color: 'var(--red)' }}>-{shockPct.toFixed(1)}%</strong>
            </div>
            <input type="range" min="0" max="30" step="1" value={shockPct} onChange={(e) => setShockPct(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--amber-soft)', padding: '12px', borderRadius: '9px', fontSize: '10px', color: '#7e5b1d' }}>
            <div><span>Projected Portfolio Impact</span><strong style={{ display: 'block', fontSize: '15px', color: 'var(--red)', marginTop: '2px' }}>-${Math.round(lossAmount).toLocaleString()} (-{portfolioDropPct.toFixed(1)}%)</strong></div>
            <div><span>Post-Shock Total Value</span><strong style={{ display: 'block', fontSize: '15px', color: 'var(--ink)', marginTop: '2px' }}>${Math.round(postValue).toLocaleString()}</strong></div>
          </div>
        </section>
      </div>

      <BenchmarkChart />
      <CorrelationHeatmap />
    </>
  )
}

function SystemPage({ onOpenNotifications }: { onOpenNotifications?: () => void }) {
  const [sched, setSched] = useState<{ enabled: boolean; interval_minutes: number; last_sync: string | null; last_status: string; new_records_detected: number; runs_completed: number } | null>(null)
  const [schedLoading, setSchedLoading] = useState(false)

  useEffect(() => {
    let alive = true
    api.schedulerStatus().then((s) => { if (alive) setSched(s) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const handleToggleScheduler = () => {
    if (!sched) return
    setSchedLoading(true)
    api.toggleScheduler(!sched.enabled)
      .then((res) => {
        setSched((prev) => prev ? { ...prev, enabled: res.enabled } : null)
      })
      .finally(() => setSchedLoading(false))
  }

  const services = [
    ['Market data (Yahoo/Alpaca)', 'Live', 'Connected'],
    ['Calculation engine', 'Active', 'Real-time'],
    ['Ratings Extractor Bridge', 'Active', 'Synced'],
    ['Automated Scheduler', sched?.enabled ? 'Active' : 'Paused', sched?.last_sync ? `Sync: ${sched.last_sync.slice(11, 16)} UTC` : 'Every 10m'],
    ['Portfolio database', 'Healthy', 'Connected'],
    ['Alert evaluator & Push', 'Active', 'Real-time'],
  ]

  return (
    <>
      <PageHeading eyebrow="TRUST & OPERATIONS" title="System health & Background Services" copy="Source freshness, background tasks, and automated runner state are visible—not assumed." />
      <div className="system-grid">
        <section className="panel system-hero">
          <div className="health-orb"><HeartPulse size={31} /></div>
          <div>
            <span className="eyebrow">OVERALL STATUS</span>
            <h2>All systems operational</h2>
            <p>Live operational market data, indicators engine &amp; background scheduler active</p>
          </div>
        </section>

        {/* Background Scheduler Card */}
        <section className="panel" style={{ background: 'var(--subtle)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="eyebrow">AUTOMATED EXTRACTOR SCHEDULER</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: sched?.enabled ? 'var(--accent-soft)' : 'var(--subtle)',
                color: sched?.enabled ? 'var(--accent-dark)' : 'var(--muted)',
              }}
            >
              {sched?.enabled ? '⚡ RUNNING' : '⏸ PAUSED'}
            </span>
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>Pre-Market &amp; Periodic Sync Runner</h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px 0' }}>
            Polls the companion article analyzer database every {sched?.interval_minutes ?? 10} minutes. Automatically pulls rank shifts and recalculates model setups.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '12px' }}>
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)', display: 'block' }}>Status</span>
              <strong>{sched?.last_status ?? 'Ready'}</strong>
            </div>
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)', display: 'block' }}>Runs Completed</span>
              <strong>{sched?.runs_completed ?? 0} cycles</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleToggleScheduler}
              disabled={schedLoading}
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {sched?.enabled ? 'Pause Runner' : 'Resume Runner'}
            </button>
            {onOpenNotifications && (
              <button
                type="button"
                className="banner-primary"
                onClick={onOpenNotifications}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                <Bell size={13} /> Telegram &amp; Push Alerts
              </button>
            )}
          </div>
        </section>

        <section className="panel service-list">
          {services.map(([name, status, time]) => (
            <div key={name}>
              <span><i />{name}</span>
              <strong>{status}</strong>
              <time>{time}</time>
            </div>
          ))}
        </section>

        <section className="panel provenance-panel">
          <span className="eyebrow">DATA PROVENANCE</span>
          <h2>Know what supports every answer</h2>
          <p>Live market data ingested via Yahoo Finance and Alpaca with real-time technical calculation engine (RSI-14, SMA-50, SMA-200, MACD, Trend Slope, Rel-Vol) and automated ratings extraction.</p>
          <div><Database size={17} /><span><strong>Live Market Engine</strong><small>Concurrent price feeds &amp; historical bars</small></span></div>
          <div><BrainCircuit size={17} /><span><strong>Deterministic calculations</strong><small>Verified mathematical formula implementation</small></span></div>
          <div><ShieldCheck size={17} /><span><strong>Grounded explanations</strong><small>Calculations derived from live computed metrics</small></span></div>
        </section>
      </div>
    </>
  )
}

function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="page-title-row simple"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></div>
}

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [scenario, setScenario] = useState(false)
  const [selected, setSelected] = useState<Holding | null>(null)
  const [decisionHolding, setDecisionHolding] = useState<Holding | null>(null)
  const [alertPanelOpen, setAlertPanelOpen] = useState(false)
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false)
  const [userAlerts, setUserAlerts] = useState<UserAlert[]>(() => {
    try {
      const saved = localStorage.getItem('atlas_user_alerts')
      if (saved) {
        const parsed: UserAlert[] = JSON.parse(saved)
        return parsed.filter((a) => a && !a.id.startsWith('u-init-') && a.id !== 'u-init-1' && a.id !== 'u-init-2')
      }
    } catch { /* ignore */ }
    return []
  })
  const [liveStreaming, setLiveStreaming] = useState(false)
  const [liveTicks, setLiveTicks] = useState<Record<string, { price: number; changePct: number }>>({})
  const [liveToast, setLiveToast] = useState<{ title: string; detail: string; symbol: string } | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [apiHoldings, setApiHoldings] = useState<Holding[] | null>(null)
  const [apiAlerts, setApiAlerts] = useState<AlertItem[] | null>(null)
  const [source, setSource] = useState<PortfolioSource | null>(null)
  const [refreshingLive, setRefreshingLive] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [backtestOpen, setBacktestOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('atlas_theme')
      if (saved === 'light' || saved === 'dark') return saved
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    } catch { /* ignore */ }
    return 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('atlas_theme', theme)
    } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('atlas_user_alerts', JSON.stringify(userAlerts))
    } catch { /* ignore */ }
  }, [userAlerts])

  useEffect(() => {
    if (!liveToast) return
    const timer = setTimeout(() => {
      setLiveToast(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [liveToast])

  const reloadState = useCallback(() => {
    api.state().then((state) => {
      setScenario(state.scenario_active)
      setApiHoldings(state.holdings)
      setApiAlerts(state.alerts)
      setSource(state.source ?? null)
      if (state.source?.last_refreshed) {
        setLastRefreshedAt(state.source.last_refreshed)
      }
    }).catch(() => { /* Offline-first seeded mode is intentional for the POC. */ })
  }, [])

  const handleRefreshAllData = useCallback(async () => {
    setRefreshingLive(true)
    try {
      const res = await api.marketRefresh()
      if (res && res.holdings) {
        setApiHoldings(res.holdings)
        if (res.alerts) setApiAlerts(res.alerts)
        if (res.source) setSource(res.source)
        if (res.meta?.timestamp) setLastRefreshedAt(res.meta.timestamp)
        // Check armed user alerts against fresh holdings
        userAlerts.forEach((alert) => {
          if (alert.status !== 'ARMED') return
          const h = res.holdings.find((x) => x.symbol.toUpperCase() === alert.symbol.toUpperCase())
          if (!h) return
          const evalRes = evaluateAlert(alert, h)
          if (evalRes.triggered) {
            setUserAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, status: 'TRIGGERED' } : a))
            setLiveToast({ title: `${alert.symbol} Alert Triggered`, detail: evalRes.message, symbol: alert.symbol })
          }
        })
        const ranksNotice = (res as { ratings_sync?: { synced?: boolean; tickers_count?: number; imported_rows?: number } }).ratings_sync?.synced
          ? ` · ${(res as { ratings_sync?: { tickers_count?: number; imported_rows?: number } }).ratings_sync?.tickers_count ?? 180} ranks synced`
          : ''
        setLiveToast({
          title: '⚡ Live Operational Refresh',
          detail: `Recalculated ${res.holdings.length} assets with live quotes, technical indicators, signals, alerts${ranksNotice}.`,
          symbol: 'LIVE'
        })
      }
    } catch {
      setLiveToast({
        title: 'Refresh Notice',
        detail: 'Could not contact live market provider. Keeping local data.',
        symbol: 'WARN'
      })
    } finally {
      setRefreshingLive(false)
    }
  }, [userAlerts])
  
  useEffect(() => { 
    reloadState()
    handleRefreshAllData()
  }, [reloadState, handleRefreshAllData])
  
  const baseHoldings = useMemo(() => apiHoldings ?? scenarioHoldings(scenario), [apiHoldings, scenario])
  
  const holdings = useMemo(() => {
    if (!liveStreaming || Object.keys(liveTicks).length === 0) return baseHoldings
    return baseHoldings.map((h) => {
      const tick = liveTicks[h.symbol.toUpperCase()]
      if (!tick) return h
      return {
        ...h,
        price: tick.price,
        dayChange: Math.round((h.dayChange + tick.changePct) * 100) / 100
      }
    })
  }, [baseHoldings, liveStreaming, liveTicks])

  const isCustomPortfolio = source?.source === 'uploaded' || source?.source === 'alpaca'
  const alerts = apiAlerts ?? (isCustomPortfolio ? [] : (scenario ? [scenarioAlert, ...baseAlerts] : baseAlerts))

  // Live SSE stream with offline fallback generator
  useEffect(() => {
    if (!liveStreaming) {
      setLiveTicks({})
      return
    }

    let es: EventSource | null = null
    let fallbackInterval: number | null = null

    const handleTickBatch = (ticks: Array<{ symbol: string; price: number; changePct?: number; change_pct?: number; provider?: string }>) => {
      setLiveTicks((prev) => {
        const next = { ...prev }
        ticks.forEach((t) => {
          const pct = t.changePct ?? t.change_pct ?? 0.0
          next[t.symbol.toUpperCase()] = { price: t.price, changePct: pct }
        })
        return next
      })

      // Check armed alerts against updated prices
      userAlerts.forEach((alert) => {
        if (alert.status !== 'ARMED') return
        const tick = ticks.find((t) => t.symbol.toUpperCase() === alert.symbol.toUpperCase())
        if (!tick) return
        const holding = holdings.find((h) => h.symbol.toUpperCase() === alert.symbol.toUpperCase())
        if (!holding) return
        const simHolding = { ...holding, price: tick.price }
        const res = evaluateAlert(alert, simHolding)
        if (res.triggered) {
          setUserAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, status: 'TRIGGERED' } : a))
          setLiveToast({ title: `${alert.symbol} Alert Triggered`, detail: res.message, symbol: alert.symbol })
        }
      })
    }

    try {
      const streamUrl = window.location.port === '5173' || window.location.port === '4173'
        ? '/api/v1/market/stream'
        : 'http://127.0.0.1:8000/api/v1/market/stream'
      es = new EventSource(streamUrl)
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload.ticks) handleTickBatch(payload.ticks)
        } catch { /* ignore */ }
      }
      es.onerror = () => {
        if (es) { es.close(); es = null }
        if (!fallbackInterval) {
          fallbackInterval = window.setInterval(() => {
            const symbols = ['CRDO', 'NVDA', 'MSFT', 'ANET', 'VRT', 'GOOGL', 'SPY']
            const sym = symbols[Math.floor(Math.random() * symbols.length)]
            const cur = holdings.find((h) => h.symbol === sym)?.price || 100
            const pct = (Math.random() * 0.008 - 0.004)
            const nextP = Math.round(cur * (1 + pct) * 100) / 100
            handleTickBatch([{ symbol: sym, price: nextP, changePct: Math.round(pct * 1000) / 100 }])
          }, 2500)
        }
      }
    } catch {
      fallbackInterval = window.setInterval(() => {
        const symbols = ['CRDO', 'NVDA', 'MSFT', 'ANET', 'VRT', 'GOOGL', 'SPY']
        const sym = symbols[Math.floor(Math.random() * symbols.length)]
        const cur = holdings.find((h) => h.symbol === sym)?.price || 100
        const pct = (Math.random() * 0.008 - 0.004)
        const nextP = Math.round(cur * (1 + pct) * 100) / 100
        handleTickBatch([{ symbol: sym, price: nextP, changePct: Math.round(pct * 1000) / 100 }])
      }, 2500)
    }

    return () => {
      if (es) es.close()
      if (fallbackInterval) clearInterval(fallbackInterval)
    }
  }, [liveStreaming, holdings, userAlerts])

  const toggleScenario = () => {
    const next = !scenario
    setScenario(next)
    setApiHoldings(null)
    setApiAlerts(null)
    api.scenario(next).then((state) => {
      setApiHoldings(state.holdings)
      setApiAlerts(state.alerts)
    }).catch(() => { /* Preserve the deterministic local experience. */ })
  }

  const handleAddAlert = (alert: UserAlert) => {
    setUserAlerts((prev) => [alert, ...prev])
  }

  const handleDeleteAlert = (id: string) => {
    setUserAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const renderPage = () => {
    if (page === 'Portfolio') return <PortfolioPage holdings={holdings} onSelect={setSelected} onRefresh={handleRefreshAllData} refreshing={refreshingLive} onOpenRebalance={() => setRebalanceModalOpen(true)}/>
    if (page === 'Signals') return <SignalsPage holdings={holdings} onSelect={setSelected}/>
    if (page === 'Catalysts') return <CatalystRadar holdings={holdings} onSelectHolding={setSelected}/>
    if (page === 'Watchlist') return <WatchlistPage/>
    if (page === 'Alerts') return (
      <AlertsPage 
        alerts={alerts} 
        userAlerts={userAlerts} 
        holdings={holdings} 
        onSelect={setSelected} 
        onNavigate={(p) => setPage(p)}
        onOpenDecision={(h) => setDecisionHolding(h)}
        onOpenPanel={() => setAlertPanelOpen(true)}
      />
    )
    if (page === 'Analytics') return <AnalyticsPage holdings={holdings} onOpenBacktest={() => setBacktestOpen(true)}/>
    if (page === 'Import') return <ImportPage onChanged={reloadState}/>
    if (page === 'System') return <SystemPage onOpenNotifications={() => setNotificationModalOpen(true)}/>
    return <Overview holdings={holdings} scenario={scenario} onSelect={setSelected} onAsk={() => setAskOpen(true)} onOpenDecision={(h) => setDecisionHolding(h)} onNavigate={(p) => setPage(p)}/>
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><span><Activity size={21}/></span><div><strong>ATLAS</strong><small>Portfolio intelligence</small></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X/></button></div>
        <nav>{navItems.map(({label,icon:Icon}) => <button key={label} className={page === label ? 'active' : ''} onClick={() => {setPage(label);setMobileNav(false)}}><Icon size={18}/><span>{label}</span>{label === 'Alerts' && (scenario || userAlerts.length > 0) && <b>{1 + userAlerts.length}</b>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="demo-badge" style={{ background: '#eaf7f0', color: '#0b6847', border: '1px solid #b5e4cb' }}>
            <Zap size={16} color="#0b6847" />
            <span>
              <strong>Live Operational Mode</strong>
              <small>{lastRefreshedAt ? `Live market · ${lastRefreshedAt}` : 'Live quotes & indicators active'}</small>
            </span>
          </div>
          <button onClick={() => setNotificationModalOpen(true)}><Settings size={18}/> Notifications &amp; Settings</button>
          <div className="user"><span>OM</span><div><strong>Ohad Meiri</strong><small>Portfolio owner</small></div></div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)}><Menu size={20}/></button>
          <PortfolioSwitcher
            currentSource={source}
            onPortfolioChanged={reloadState}
          />
          <span className="source-badge live">
            {source?.source === 'uploaded'
              ? `${source.name ?? 'Uploaded'} · ${source.count} holdings · ⚡ Live`
              : source?.source === 'alpaca'
                ? `Alpaca · ${source.count} pos · ⚡ Live`
                : `Live Operational · ${holdings.length} assets`}
          </span>
          <div className="topbar-actions">
            <button
              className="cmd-palette-trigger"
              onClick={() => setPaletteOpen(true)}
              title="Quick Search & Navigation (Ctrl+K / ⌘K)"
              aria-label="Quick Search"
            >
              <Search size={14} />
              <span>Search assets, tools, pages...</span>
              <kbd>⌘K</kbd>
            </button>

            <span className="market-status" title={lastRefreshedAt ? `Last refreshed at ${lastRefreshedAt}` : 'Market open'}>
              <i/> {lastRefreshedAt ? `Live · ${lastRefreshedAt}` : 'Market open'}
            </span>

            <button
              className="refresh-data-btn"
              onClick={handleRefreshAllData}
              disabled={refreshingLive}
              title="Fetch fresh live quotes, calculate technical indicators & signals, and evaluate alerts"
            >
              <Zap size={14} className={refreshingLive ? 'spin' : ''} />
              {refreshingLive ? 'Refreshing…' : '⚡ Refresh'}
            </button>

            <QuickActionsMenu
              onOpenBriefing={() => setBriefingOpen(true)}
              onOpenBacktest={() => setBacktestOpen(true)}
              onOpenRebalance={() => setRebalanceModalOpen(true)}
              liveStreaming={liveStreaming}
              onToggleStream={() => setLiveStreaming(!liveStreaming)}
              scenario={scenario}
              onToggleScenario={toggleScenario}
              theme={theme}
              onToggleTheme={toggleTheme}
            />

            <button
              className="icon-button theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button className="icon-button" onClick={() => setAlertPanelOpen(true)} title="Alert Center">
              <Bell size={18}/>
              {(scenario || userAlerts.length > 0) && <i className="notification-dot"/>}
            </button>
          </div>
        </header>
        <main>
          <RatingsBanner
            onSelectTicker={(ticker) => setSelected(getOrBuildHolding(ticker, holdings))}
            onSync={() => {
              reloadState()
              handleRefreshAllData()
            }}
          />
          {renderPage()}
        </main>
      </div>
      {mobileNav && <div className="nav-backdrop" role="button" tabIndex={0} aria-label="Close navigation" onClick={() => setMobileNav(false)} onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') setMobileNav(false) }}/>}
      {selected && <AssetDrawer holding={selected} holdings={holdings} onClose={() => setSelected(null)} onOpenDecision={() => setDecisionHolding(selected)}/>}
      {decisionHolding && <DecisionModal holding={decisionHolding} holdings={holdings} onClose={() => setDecisionHolding(null)} />}
      {alertPanelOpen && <AlertPanel alerts={alerts} userAlerts={userAlerts} holdings={holdings} onClose={() => setAlertPanelOpen(false)} onAddAlert={handleAddAlert} onDeleteAlert={handleDeleteAlert} />}
      {notificationModalOpen && <NotificationSettingsModal onClose={() => setNotificationModalOpen(false)} />}
      {rebalanceModalOpen && <RebalanceModal onClose={() => setRebalanceModalOpen(false)} onSuccess={reloadState} />}
      {briefingOpen && <MorningBriefingModal onClose={() => setBriefingOpen(false)} />}
      {backtestOpen && <BacktestModal onClose={() => setBacktestOpen(false)} />}
      {askOpen && <AskPanel holdings={holdings} onClose={() => setAskOpen(false)}/>} 
      {scenario && (
        <div className="scenario-toast">
          <span><Target size={18} /></span>
          <div>
            <strong>Decision event detected</strong>
            <small>CRDO crossed into Strong Entry at 90/100</small>
          </div>
          <button onClick={() => setDecisionHolding(holdings[0])}>Review <ArrowRight size={14} /></button>
          <button className="toast-close" onClick={toggleScenario} aria-label="Dismiss decision notification"><X size={15} /></button>
        </div>
      )}
      {liveToast && (
        <div className={`scenario-toast live-toast ${scenario ? 'stacked' : ''}`}>
          <span><Bell size={18} /></span>
          <div>
            <strong>{liveToast.title}</strong>
            <small>{liveToast.detail}</small>
          </div>
          {liveToast.symbol && liveToast.symbol !== 'LIVE' && liveToast.symbol !== 'WARN' && (
            <button onClick={() => {
              const h = holdings.find((x) => x.symbol.toUpperCase() === liveToast.symbol.toUpperCase())
              if (h) setSelected(h)
              setLiveToast(null)
            }}>Inspect <ArrowRight size={14} /></button>
          )}
          <button className="toast-close" onClick={() => setLiveToast(null)} aria-label="Dismiss notification"><X size={15} /></button>
        </div>
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        holdings={holdings}
        onSelectHolding={(h) => setSelected(h)}
        onNavigate={(p) => setPage(p as Page)}
        onRefreshData={handleRefreshAllData}
        onOpenBriefing={() => setBriefingOpen(true)}
        onOpenBacktest={() => setBacktestOpen(true)}
        onOpenRebalance={() => setRebalanceModalOpen(true)}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
    </div>
  )
}

