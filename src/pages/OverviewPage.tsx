import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Database,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { api } from '../api/client'
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
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{ symbol: string; name: string; days_until: number; timing: string; implied_move_pct?: number }>>([])
  const [dividendSummary, setDividendSummary] = useState<{ total_annual_income: number; portfolio_yield_pct: number } | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      api.catalystsEarnings().catch(() => null),
      api.catalystsDividends().catch(() => null),
    ]).then(([earn, div]) => {
      if (!active) return
      if (earn?.events) {
        setUpcomingEvents(earn.events.filter((e) => e.days_until <= 21).slice(0, 4))
      }
      if (div?.summary) {
        setDividendSummary({
          total_annual_income: div.summary.total_annual_income,
          portfolio_yield_pct: div.summary.portfolio_yield_pct,
        })
      }
    })
    return () => {
      active = false
    }
  }, [])

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

        {/* Imminent Catalysts & Dividend Cashflow */}
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent-dark)', display: 'grid', placeItems: 'center' }}>
                <Calendar size={16} />
              </span>
              <div>
                <span className="eyebrow">CATALYST INTELLIGENCE</span>
                <h2>Imminent Catalysts &amp; Dividend Flow</h2>
              </div>
            </div>
            {onNavigate && (
              <button className="text-button" onClick={() => onNavigate('Catalysts')}>
                Full Calendar <ArrowRight size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '12px' }}>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((evt) => {
                const isUrgent = evt.days_until <= 7
                const h = holdings.find((item) => item.symbol === evt.symbol)
                return (
                  <div
                    key={evt.symbol}
                    onClick={() => h && onSelect(h)}
                    style={{
                      background: 'var(--subtle)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: h ? 'pointer' : 'default',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{evt.symbol}</strong>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isUrgent ? 'var(--red-soft)' : 'var(--accent-soft)',
                          color: isUrgent ? 'var(--red)' : 'var(--accent-dark)',
                        }}>
                          {isUrgent ? '⚠️ ' : '📅 '}{evt.days_until} days
                        </span>
                      </div>
                      <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                        Earnings ({evt.timing}) · {evt.implied_move_pct ? `±${evt.implied_move_pct}% move` : 'Reporting soon'}
                      </small>
                    </div>
                    {h && <ChevronRight size={16} color="var(--muted)" />}
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '12px', background: 'var(--subtle)', borderRadius: '8px' }}>
                No earnings catalysts reported in the next 21 days for portfolio holdings.
              </div>
            )}

            {dividendSummary && (
              <div style={{
                background: 'var(--subtle)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 650, letterSpacing: '0.04em' }}>DIVIDEND RUN-RATE</span>
                  <strong style={{ fontSize: '13px', color: 'var(--accent-dark)' }}>{dividendSummary.portfolio_yield_pct.toFixed(2)}% Yld</strong>
                </div>
                <strong style={{ fontSize: '18px', color: 'var(--ink)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  ${Math.round(dividendSummary.total_annual_income).toLocaleString()}/yr
                </strong>
                <small style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '2px' }}>
                  ~${Math.round(dividendSummary.total_annual_income / 12).toLocaleString()}/mo passive cashflow
                </small>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
