import React, { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  Database,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { InteractiveSparkline } from '../components/InteractiveSparkline'
import { TimeframeSelector } from '../components/TimeframeSelector'
import { Tooltip } from '../components/Tooltip'
import { performance } from '../data/demo'
import { METRIC_TOOLTIPS } from '../data/tooltips'
import { assessHolding, portfolioRisk } from '../domain/engine'
import { buildTickerRatings } from '../domain/ratings'
import { getTimeframeSeries, type TimeframeKey } from '../domain/timeframe'
import type { Holding } from '../types'

interface OverviewPageProps {
  holdings: Holding[]
  scenario: boolean
  onSelect: (holding: Holding) => void
  onAsk: () => void
  onOpenDecision: (holding: Holding) => void
  onNavigate?: (page: string) => void
}

function StatusPill({ state }: { state: string }) {
  const key = state.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill ${key}`}>{state}</span>
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: React.ReactNode
  value: string
  detail: string
  icon?: typeof Activity
  tone?: 'neutral' | 'good' | 'warning'
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-top">
        <span>{label}</span>
        {Icon && <Icon size={17} />}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function OverviewPage({
  holdings,
  scenario,
  onSelect,
  onAsk,
  onOpenDecision,
  onNavigate,
}: OverviewPageProps) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1Y')

  const ranked = useMemo(() => {
    return holdings
      .filter((h) => h.symbol !== 'CASH')
      .map((holding) => {
        const ready = holding.hasSignalInputs !== false
        const assessment = assessHolding(holding)
        const ext = buildTickerRatings(holding.symbol)
        return {
          holding,
          assessment,
          ready,
          displayScore: ready ? assessment.score : ext.consensus !== null ? Math.round(ext.consensus) : 0,
          displayState: ready
            ? assessment.state
            : ext.consensusLabel
              ? ext.consensusLabel.toUpperCase()
              : 'NO SETUP',
          fact: ready
            ? assessment.facts[0]
            : ext.consensusLabel
              ? `Consensus: ${ext.consensusLabel} (${Math.round(ext.consensus || 0)})`
              : 'Imported holding',
        }
      })
      .sort((a, b) => Number(b.ready) - Number(a.ready) || b.displayScore - a.displayScore)
  }, [holdings])

  const risk = portfolioRisk(holdings)
  const series = useMemo(
    () => getTimeframeSeries(performance.portfolio, performance.benchmark, timeframe),
    [timeframe]
  )

  const monthLabels = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].slice(
    -series.portfolio.length
  )

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">DECISION BRIEFING · INSTITUTIONAL</span>
          <h1>Good afternoon, Ohad</h1>
          <p>Here’s what changed and what needs attention across portfolio exposures.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="ask-button"
            style={{ background: 'var(--ink)' }}
            onClick={() => onOpenDecision(ranked[0]?.holding || holdings[0])}
          >
            <Target size={16} /> Strategy Decision
          </button>
          <button className="ask-button" onClick={onAsk}>
            <Sparkles size={17} /> Ask Atlas
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Portfolio value" value="$715,520" detail="+$4,272 today" icon={CircleDollarSign} tone="good" />
        <KpiCard
          label="Year to date"
          value={`${series.portfolioReturn >= 0 ? '+' : ''}${series.portfolioReturn.toFixed(2)}%`}
          detail={`${series.alpha >= 0 ? '+' : ''}${series.alpha.toFixed(2)}% vs SPY`}
          icon={TrendingUp}
          tone="good"
        />
        <KpiCard
          label={<Tooltip content={METRIC_TOOLTIPS.unrealizedPnL}>Unrealized P/L</Tooltip>}
          value="+$81,244"
          detail="+12.81% total return"
          icon={Activity}
        />
        <KpiCard
          label="Risk posture"
          value={risk.status}
          detail={`${risk.largestSector} ${risk.sectorWeight.toFixed(1)}%`}
          icon={Gauge}
          tone={risk.status === 'Elevated' ? 'warning' : 'neutral'}
        />
        <KpiCard label="Data confidence" value="Current" detail="Live market stream active" icon={ShieldCheck} tone="good" />
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
                <span>
                  <i className="green-dot" /> Portfolio {series.portfolioReturn >= 0 ? '+' : ''}
                  {series.portfolioReturn.toFixed(1)}%
                </span>
                <span>
                  <i className="gray-dot" /> SPY {series.benchmarkReturn >= 0 ? '+' : ''}
                  {series.benchmarkReturn.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          <div className="chart-wrap">
            <InteractiveSparkline
              values={series.portfolio}
              labels={monthLabels}
              color="green"
              fill
              formatValue={(val) => `Portfolio: $${(val * 1000).toLocaleString()}`}
            />
          </div>
          <div className="month-axis">
            {monthLabels.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </section>

        <section className="panel allocation-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPOSURE</span>
              <h2>Allocation</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate && onNavigate('Analytics')}>
              View analysis <ArrowRight size={14} />
            </button>
          </div>
          <div className="allocation-content">
            <div className="donut">
              <div>
                <strong>$715K</strong>
                <span>total value</span>
              </div>
            </div>
            <div className="allocation-list">
              <div>
                <i className="seg semi" />
                <span>Semiconductors</span>
                <strong>36.2%</strong>
              </div>
              <div>
                <i className="seg software" />
                <span>Software</span>
                <strong>21.3%</strong>
              </div>
              <div>
                <i className="seg infra" />
                <span>Infrastructure</span>
                <strong>20.0%</strong>
              </div>
              <div>
                <i className="seg other" />
                <span>Diversifiers &amp; cash</span>
                <strong>22.5%</strong>
              </div>
            </div>
          </div>
          <div className="risk-note">
            <AlertTriangle size={16} />
            <span>
              Semiconductors are <strong>1.2% above</strong> the target limit.
            </span>
          </div>
        </section>

        <section className="panel signals-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PRIORITIZED</span>
              <h2>Signals to review</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate && onNavigate('Signals')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="signal-list">
            {ranked.slice(0, 4).map(({ holding, displayState, displayScore, fact }, index) => (
              <button key={holding.symbol} onClick={() => onSelect(holding)}>
                <span className="rank">0{index + 1}</span>
                <span className="asset-logo">{holding.symbol[0]}</span>
                <span className="signal-name">
                  <strong>{holding.symbol}</strong>
                  <small>{fact}</small>
                </span>
                <StatusPill state={displayState} />
                <strong className="signal-score">{displayScore > 0 ? displayScore : '—'}</strong>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel attention-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WHAT CHANGED</span>
              <h2>Attention feed</h2>
            </div>
            <span className="live-indicator">
              <i /> Live
            </span>
          </div>
          <div className="attention-list">
            {scenario && (
              <button
                onClick={() => {
                  const h = holdings.find((item) => item.symbol === 'CRDO') || holdings[0]
                  onOpenDecision(h)
                }}
              >
                <span className="attention-icon critical">
                  <Target size={17} />
                </span>
                <span>
                  <strong>CRDO moved to Strong Entry</strong>
                  <small>Score 65 → 90 · breakout confirmed</small>
                </span>
                <time>Now</time>
              </button>
            )}
            <button
              onClick={() => {
                const h = holdings.find((item) => item.sector === 'Semiconductors') || holdings[0]
                onOpenDecision(h)
              }}
            >
              <span className="attention-icon warning">
                <AlertTriangle size={17} />
              </span>
              <span>
                <strong>Concentration threshold exceeded</strong>
                <small>Semiconductors reached 36.2%</small>
              </span>
              <time>12m</time>
            </button>
            <button onClick={() => onNavigate && onNavigate('Analytics')}>
              <span className="attention-icon">
                <TrendingUp size={17} />
              </span>
              <span>
                <strong>Portfolio extended its lead</strong>
                <small>Relative return vs SPY is now +7.3%</small>
              </span>
              <time>34m</time>
            </button>
            <button onClick={() => onNavigate && onNavigate('System')}>
              <span className="attention-icon">
                <Database size={17} />
              </span>
              <span>
                <strong>Daily data validation passed</strong>
                <small>11 symbols · no gaps detected</small>
              </span>
              <time>1h</time>
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
