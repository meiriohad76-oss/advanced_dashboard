import React, { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { BenchmarkChart } from '../components/BenchmarkChart'
import { CorrelationHeatmap } from '../components/CorrelationHeatmap'
import { Tooltip } from '../components/Tooltip'
import { METRIC_TOOLTIPS } from '../data/tooltips'
import { portfolioRisk } from '../domain/engine'
import type { Holding } from '../types'

interface AnalyticsPageProps {
  holdings: Holding[]
  onOpenBacktest?: () => void
}

export function AnalyticsPage({ holdings, onOpenBacktest }: AnalyticsPageProps) {
  const risk = portfolioRisk(holdings)
  const [shockPct, setShockPct] = useState(10)

  const portfolioBeta = 1.24
  const portfolioDropPct = shockPct * portfolioBeta
  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.price, 0) || 715520
  const lossAmount = totalValue * (portfolioDropPct / 100)
  const postValue = totalValue - lossAmount

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div className="page-heading">
          <span className="eyebrow">PORTFOLIO CONTEXT</span>
          <h2>Risk Analytics &amp; Stress Testing</h2>
          <p>Beta sensitivity, 95% Parametric VaR, and interactive market shock simulation.</p>
        </div>
        {onOpenBacktest && (
          <button
            className="ask-button"
            onClick={onOpenBacktest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              marginTop: '8px',
            }}
          >
            <BarChart2 size={15} /> Launch Strategy Backtester
          </button>
        )}
      </div>

      <div className="analytics-grid">
        <section className="panel risk-hero">
          <span className="eyebrow">RISK POSTURE</span>
          <div className="risk-score">
            <strong>64</strong>
            <span>/100</span>
          </div>
          <h2>Elevated, but controlled</h2>
          <p>Sector concentration is the primary contributor. Market and drawdown indicators remain within limits.</p>
          <div className="risk-scale">
            <i />
            <b style={{ left: '64%' }} />
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">CONCENTRATION</span>
          <h2>Exposure limits</h2>
          <div className="limit-list">
            <div>
              <span>
                <strong>Largest position</strong>
                <small>Limit 20%</small>
              </span>
              <b>{risk.largest.toFixed(1)}%</b>
            </div>
            <div>
              <span>
                <strong>Top five holdings</strong>
                <small>Limit 70%</small>
              </span>
              <b>{risk.topFive.toFixed(1)}%</b>
            </div>
            <div className="over">
              <span>
                <strong>{risk.largestSector}</strong>
                <small>Limit 35%</small>
              </span>
              <b>{risk.sectorWeight.toFixed(1)}%</b>
            </div>
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">VOLATILITY METRICS</span>
          <h2>Beta &amp; Value-at-Risk</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div
              style={{
                background: 'var(--panel)',
                padding: '12px',
                borderRadius: '9px',
                border: '1px solid var(--line)',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                <Tooltip content={METRIC_TOOLTIPS.beta}>Portfolio Beta vs SPY</Tooltip>
              </span>
              <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: 'var(--accent-dark)' }}>
                {portfolioBeta.toFixed(2)}x
              </strong>
              <small style={{ fontSize: '9px', color: 'var(--muted)' }}>High growth sensitivity</small>
            </div>
            <div
              style={{
                background: 'var(--panel)',
                padding: '12px',
                borderRadius: '9px',
                border: '1px solid var(--line)',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                <Tooltip content={METRIC_TOOLTIPS.var95}>1-Day 95% Parametric VaR</Tooltip>
              </span>
              <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#c48017' }}>
                ${Math.round(totalValue * 0.0199).toLocaleString()}
              </strong>
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
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={shockPct}
              onChange={(e) => setShockPct(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--red)' }}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              background: 'var(--amber-soft)',
              padding: '12px',
              borderRadius: '9px',
              fontSize: '10px',
              color: '#7e5b1d',
              border: '1px solid var(--amber-line)',
            }}
          >
            <div>
              <span>Projected Portfolio Impact</span>
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--red)', marginTop: '2px' }}>
                -${Math.round(lossAmount).toLocaleString()} (-{portfolioDropPct.toFixed(1)}%)
              </strong>
            </div>
            <div>
              <span>Post-Shock Total Value</span>
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--ink)', marginTop: '2px' }}>
                ${Math.round(postValue).toLocaleString()}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <BenchmarkChart />
      <CorrelationHeatmap />
    </>
  )
}
