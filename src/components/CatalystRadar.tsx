import React, { useEffect, useState } from 'react'
import { AlertTriangle, Calendar, CircleDollarSign, Clock, DollarSign, Flame, Layers, TrendingUp } from 'lucide-react'
import { api } from '../api/client'
import type { DividendData, EarningsCalendarResponse, EarningsEvent, Holding } from '../types'

interface CatalystRadarProps {
  holdings: Holding[]
  onSelectHolding?: (holding: Holding) => void
}

export function CatalystRadar({ holdings, onSelectHolding }: CatalystRadarProps) {
  const [tab, setTab] = useState<'earnings' | 'dividends'>('earnings')
  const [earningsData, setEarningsData] = useState<EarningsCalendarResponse | null>(null)
  const [dividendData, setDividendData] = useState<DividendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)

    Promise.all([
      api.catalystsEarnings().catch(() => null),
      api.catalystsDividends().catch(() => null),
    ]).then(([earn, div]) => {
      if (!alive) return
      if (earn) setEarningsData(earn)
      if (div) setDividendData(div)
      setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [holdings])

  const highRiskEvents = earningsData?.events.filter((e) => e.is_high_risk) ?? []
  const maxMonthlyAmount = Math.max(
    ...(dividendData?.monthly_cashflow.map((m) => m.amount) ?? [100]),
    50
  )

  const handleSelectSymbol = (sym: string) => {
    if (!onSelectHolding) return
    const found = holdings.find((h) => h.symbol.toUpperCase() === sym.toUpperCase())
    if (found) {
      onSelectHolding(found)
    }
  }

  return (
    <div className="catalyst-radar-page">
      <div className="page-heading" style={{ marginBottom: '18px' }}>
        <span className="eyebrow">CATALYST INTELLIGENCE &amp; CASHFLOW</span>
        <h1 style={{ fontSize: '24px', margin: '4px 0 6px', fontWeight: 700 }}>
          Catalyst Radar &amp; Dividend Flow
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
          Anticipate volatility events, track consensus earnings dates, and monitor projected dividend cashflows.
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button
          className={`tab-btn ${tab === 'earnings' ? 'active' : ''}`}
          onClick={() => setTab('earnings')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            background: tab === 'earnings' ? 'var(--accent, #0b6847)' : 'var(--card-bg, #fff)',
            color: tab === 'earnings' ? '#fff' : 'var(--ink, #1a202c)',
            border: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <Flame size={16} />
          Earnings Calendar ({earningsData?.summary.total_upcoming ?? 0})
        </button>
        <button
          className={`tab-btn ${tab === 'dividends' ? 'active' : ''}`}
          onClick={() => setTab('dividends')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            background: tab === 'dividends' ? 'var(--accent, #0b6847)' : 'var(--card-bg, #fff)',
            color: tab === 'dividends' ? '#fff' : 'var(--ink, #1a202c)',
            border: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <CircleDollarSign size={16} />
          Dividend Cashflow Projections
        </button>
      </div>

      {loading && (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading catalyst intelligence...
        </div>
      )}

      {/* TAB 1: EARNINGS CALENDAR & VOLATILITY RISK */}
      {!loading && tab === 'earnings' && (
        <>
          {/* Risk Alert Banner if imminent earnings */}
          {highRiskEvents.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '18px',
                color: '#92400e',
              }}
            >
              <AlertTriangle size={22} color="#b45309" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', marginBottom: '2px' }}>
                  Elevated Catalyst Volatility Detected ({highRiskEvents.length} {highRiskEvents.length === 1 ? 'asset reports' : 'assets report'} within 7 days)
                </strong>
                <span style={{ fontSize: '12px' }}>
                  {highRiskEvents.map((e) => `${e.symbol} (${e.days_until}d away, ${e.timing})`).join(' · ')}. Implied moves are elevated. Enforce trailing stop-loss bracket orders to limit gap risk.
                </span>
              </div>
            </div>
          )}

          {/* Earnings KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>REPORTING THIS WEEK</span>
                <Clock size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px', color: highRiskEvents.length > 0 ? '#b45309' : 'var(--ink)' }}>
                {earningsData?.summary.this_week ?? 0}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>High gap risk window</small>
            </article>

            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>REPORTING NEXT 30 DAYS</span>
                <Calendar size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px' }}>
                {earningsData?.summary.next_30_days ?? 0}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Near-term catalysts</small>
            </article>

            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>TOTAL TRACKED</span>
                <Layers size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px' }}>
                {earningsData?.summary.total_upcoming ?? 0}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Portfolio positions</small>
            </article>
          </div>

          {/* Earnings Table */}
          <section className="panel" style={{ background: 'var(--card-bg, #fff)', padding: '18px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
              Upcoming Earnings Announcements
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line, #e2e8f0)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '10px 8px' }}>Asset</th>
                    <th style={{ padding: '10px 8px' }}>Date</th>
                    <th style={{ padding: '10px 8px' }}>Countdown</th>
                    <th style={{ padding: '10px 8px' }}>Timing</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>EPS Est.</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Prior EPS</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Implied Move</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Position Value</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {earningsData?.events.map((e: EarningsEvent) => {
                    const badgeColor =
                      e.days_until <= 3 ? '#dc2626' : e.days_until <= 7 ? '#d97706' : e.days_until <= 30 ? '#2563eb' : '#64748b'
                    const badgeBg =
                      e.days_until <= 3 ? '#fee2e2' : e.days_until <= 7 ? '#fef3c7' : e.days_until <= 30 ? '#eff6ff' : '#f1f5f9'

                    return (
                      <tr key={e.symbol} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <strong style={{ fontSize: '13px', display: 'block' }}>{e.symbol}</strong>
                          <small style={{ color: 'var(--muted)' }}>{e.name}</small>
                        </td>
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          {e.earnings_date}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              fontSize: '11px',
                              background: badgeBg,
                              color: badgeColor,
                            }}
                          >
                            {e.days_until === 0 ? 'Today' : `${e.days_until}d away`}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: e.timing === 'BMO' ? '#e0f2fe' : '#f3e8ff',
                              color: e.timing === 'BMO' ? '#0369a1' : '#7e22ce',
                            }}
                          >
                            {e.timing === 'BMO' ? 'Before Open (BMO)' : 'After Close (AMC)'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                          ${e.eps_estimate?.toFixed(2) ?? '—'}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--muted)' }}>
                          ${e.last_reported_eps?.toFixed(2) ?? '—'}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: e.is_high_risk ? '#dc2626' : 'var(--ink)' }}>
                          ±{e.implied_move_pct.toFixed(1)}%
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 600 }}>${Math.round(e.position_value).toLocaleString()}</div>
                          <small style={{ color: 'var(--muted)' }}>{e.weight_pct.toFixed(1)}% weight</small>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            className="ask-button"
                            onClick={() => handleSelectSymbol(e.symbol)}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            aria-label={`Inspect ${e.symbol}`}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* TAB 2: DIVIDEND CASHFLOW PLANNER */}
      {!loading && tab === 'dividends' && (
        <>
          {/* Dividend KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>PROJECTED ANNUAL DIVIDENDS</span>
                <DollarSign size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px', color: 'var(--accent, #0b6847)' }}>
                ${Math.round(dividendData?.summary.total_annual_income ?? 0).toLocaleString()}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Passive annual cash flow</small>
            </article>

            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>AVG MONTHLY CASHFLOW</span>
                <CircleDollarSign size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px' }}>
                ${Math.round(dividendData?.summary.average_monthly_income ?? 0).toLocaleString()}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Monthly average payout</small>
            </article>

            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>PORTFOLIO YIELD</span>
                <TrendingUp size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px' }}>
                {dividendData?.summary.portfolio_yield_pct.toFixed(2)}%
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Weighted effective yield</small>
            </article>

            <article className="kpi-card" style={{ background: 'var(--card-bg, #fff)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                <span>TOP CONTRIBUTOR</span>
                <Layers size={16} />
              </div>
              <strong style={{ display: 'block', fontSize: '24px', margin: '6px 0 2px' }}>
                {dividendData?.summary.top_payer ?? '—'}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{dividendData?.summary.paying_positions_count} dividend positions</small>
            </article>
          </div>

          {/* 12-Month Cashflow Chart */}
          <section className="panel" style={{ background: 'var(--card-bg, #fff)', padding: '18px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
              12-Month Projected Cashflow Schedule
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px', alignItems: 'flex-end', height: '180px', paddingBottom: '20px' }}>
              {dividendData?.monthly_cashflow.map((m) => {
                const heightPct = Math.max(8, (m.amount / maxMonthlyAmount) * 100)
                return (
                  <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent, #0b6847)', marginBottom: '4px' }}>
                      ${Math.round(m.amount)}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                      title={`${m.month}: $${m.amount.toFixed(2)} (${m.tickers.join(', ')})`}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 600, marginTop: '6px', color: 'var(--muted)' }}>
                      {m.month}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Upcoming Ex-Dates Table */}
          <section className="panel" style={{ background: 'var(--card-bg, #fff)', padding: '18px', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
              Upcoming Ex-Dividend Dates &amp; Estimated Cashflow
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line, #e2e8f0)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '10px 8px' }}>Asset</th>
                    <th style={{ padding: '10px 8px' }}>Ex-Dividend Date</th>
                    <th style={{ padding: '10px 8px' }}>Days to Ex-Date</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>DPS</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Est. Portfolio Cash</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dividendData?.upcoming_ex_dates.map((d) => (
                    <tr key={d.symbol} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <strong style={{ fontSize: '13px', display: 'block' }}>{d.symbol}</strong>
                        <small style={{ color: 'var(--muted)' }}>{d.name}</small>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{d.ex_date}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#eff6ff', color: '#1d4ed8' }}>
                          {d.days_to_ex} days away
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>${d.payout_per_share.toFixed(2)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--accent, #0b6847)' }}>
                        +${d.estimated_cashflow.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button
                          className="ask-button"
                          onClick={() => handleSelectSymbol(d.symbol)}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          aria-label={`Inspect ${d.symbol}`}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
