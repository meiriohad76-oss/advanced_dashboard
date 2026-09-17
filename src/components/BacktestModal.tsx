import React, { useEffect, useState } from 'react'
import { Play, Sliders, X } from 'lucide-react'
import { api } from '../api/client'
import { ModalOverlay } from './ModalOverlay'
import type { BacktestCurvePoint, BacktestResult } from '../types'

interface BacktestModalProps {
  onClose: () => void
}

export function BacktestModal({ onClose }: BacktestModalProps) {
  const [entryScore, setEntryScore] = useState(75)
  const [exitScore, setExitScore] = useState(50)
  const [lookback, setLookback] = useState<'6mo' | '1y' | '2y' | '3y'>('1y')
  const [initialCapital, setInitialCapital] = useState(100000)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRunSimulation = async () => {
    setLoading(true)
    try {
      const res = await api.analyticsBacktest({
        entry_score: entryScore,
        exit_score: exitScore,
        lookback,
        initial_capital: initialCapital,
      })
      setResult(res)
    } catch {
      // Keep existing result if any
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleRunSimulation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Helper to draw SVG Equity Curve
  const renderEquityChart = (curve: BacktestCurvePoint[]) => {
    if (!curve || curve.length < 2) return null

    const width = 600
    const height = 180
    const padding = 20

    const allValues = curve.flatMap((p) => [p.portfolio, p.benchmark])
    const minVal = Math.min(...allValues) * 0.98
    const maxVal = Math.max(...allValues) * 1.02
    const valRange = maxVal - minVal || 1

    const getX = (idx: number) => padding + (idx / (curve.length - 1)) * (width - padding * 2)
    const getY = (val: number) => height - padding - ((val - minVal) / valRange) * (height - padding * 2)

    const stratPoints = curve.map((p, i) => `${getX(i)},${getY(p.portfolio)}`).join(' ')
    const benchPoints = curve.map((p, i) => `${getX(i)},${getY(p.benchmark)}`).join(' ')

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={padding}
            x2={width - padding}
            y1={padding + pct * (height - padding * 2)}
            y2={padding + pct * (height - padding * 2)}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}

        {/* Benchmark line (SPY) */}
        <polyline points={benchPoints} fill="none" stroke="#94a3b8" strokeWidth="2" />

        {/* Strategy line (Atlas) */}
        <polyline points={stratPoints} fill="none" stroke="#10b981" strokeWidth="2.5" />
      </svg>
    )
  }

  return (
    <ModalOverlay label="Quantitative Strategy Backtester" className="decision-modal" onClose={onClose}>
      <div style={{ maxWidth: '720px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--line, #e2e8f0)', paddingBottom: '12px' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent, #0b6847)' }}>HISTORICAL QUANT SIMULATION</span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 0' }}>
              Strategy Rule Backtester
            </h2>
            <small style={{ color: 'var(--muted)' }}>
              Simulate entry/exit score thresholds against historical daily bars vs SPY benchmark
            </small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Parameters Controls */}
        <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line, #e2e8f0)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <Sliders size={16} color="var(--accent, #0b6847)" />
            <strong style={{ fontSize: '12px' }}>Strategy Parameters</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <label htmlFor="entry-score-slider">Entry Score Threshold</label>
                <strong style={{ color: 'var(--accent, #0b6847)' }}>≥ {entryScore}</strong>
              </div>
              <input
                id="entry-score-slider"
                type="range"
                min="60"
                max="90"
                step="1"
                value={entryScore}
                onChange={(e) => setEntryScore(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <label htmlFor="exit-score-slider">Exit / De-risk Score Threshold</label>
                <strong style={{ color: '#ef4444' }}>&lt; {exitScore}</strong>
              </div>
              <input
                id="exit-score-slider"
                type="range"
                min="30"
                max="65"
                step="1"
                value={exitScore}
                onChange={(e) => setExitScore(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>Lookback:</span>
              {(['6mo', '1y', '2y', '3y'] as const).map((lb) => (
                <button
                  key={lb}
                  onClick={() => setLookback(lb)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: lookback === lb ? 'var(--accent)' : 'var(--panel)',
                    color: lookback === lb ? '#fff' : 'var(--ink)',
                    border: '1px solid var(--line)',
                  }}
                >
                  {lb}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>Capital:</span>
              {[25000, 100000, 250000].map((cap) => (
                <button
                  key={cap}
                  onClick={() => setInitialCapital(cap)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: initialCapital === cap ? 'var(--accent)' : 'var(--panel)',
                    color: initialCapital === cap ? '#fff' : 'var(--ink)',
                    border: '1px solid var(--line)',
                  }}
                >
                  ${cap / 1000}k
                </button>
              ))}
            </div>

            <button
              className="ask-button"
              onClick={handleRunSimulation}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '11px' }}
            >
              <Play size={13} />
              {loading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--accent-soft)', padding: '10px', borderRadius: '8px', border: '1px solid var(--accent)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-dark)', display: 'block' }}>STRATEGY RETURN</span>
                <strong style={{ fontSize: '18px', color: 'var(--accent-dark)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.total_return_pct >= 0 ? '+' : ''}{result.metrics.total_return_pct.toFixed(1)}%
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--accent-dark)', display: 'block' }}>
                  Alpha: <strong>{result.metrics.alpha_pct >= 0 ? '+' : ''}{result.metrics.alpha_pct.toFixed(1)}%</strong>
                </small>
              </div>

              <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>SPY BENCHMARK</span>
                <strong style={{ fontSize: '18px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.benchmark_return_pct >= 0 ? '+' : ''}{result.metrics.benchmark_return_pct.toFixed(1)}%
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Buy &amp; Hold</small>
              </div>

              <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>SHARPE RATIO</span>
                <strong style={{ fontSize: '18px', color: result.metrics.sharpe_ratio >= 1.5 ? 'var(--accent-dark)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.sharpe_ratio.toFixed(2)}
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Risk-adj. return</small>
              </div>

              <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>MAX DRAWDOWN</span>
                <strong style={{ fontSize: '18px', color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                  -{result.metrics.max_drawdown_pct.toFixed(1)}%
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Peak-to-trough</small>
              </div>

              <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>WIN RATE</span>
                <strong style={{ fontSize: '18px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.win_rate_pct.toFixed(0)}%
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                  {result.metrics.trades_count} trades (PF {result.metrics.profit_factor})
                </small>
              </div>
            </div>

            {/* Chart */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>
                  EQUITY GROWTH COMPARISON (PORTFOLIO VS SPY)
                </span>
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                    Atlas Strategy (${Math.round(result.metrics.final_equity).toLocaleString()})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--muted)' }} />
                    SPY Benchmark (${Math.round(result.metrics.benchmark_final_equity).toLocaleString()})
                  </span>
                </div>
              </div>

              {renderEquityChart(result.equity_curve)}
            </div>

            {/* Recent Trades Table */}
            {result.trades.length > 0 && (
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                  RECENT SIMULATED TRADES
                </span>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: 'var(--ink)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Entry Date</th>
                        <th style={{ padding: '6px 8px' }}>Exit Date</th>
                        <th style={{ padding: '6px 8px' }}>Duration</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Trade Return</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.slice(-6).map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                          <td style={{ padding: '6px 8px' }}>{t.entry_date}</td>
                          <td style={{ padding: '6px 8px' }}>{t.exit_date}</td>
                          <td style={{ padding: '6px 8px' }}>{t.duration_days} days</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: t.return_pct >= 0 ? '#15803d' : '#ef4444' }}>
                            {t.return_pct >= 0 ? '+' : ''}{t.return_pct.toFixed(2)}%
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, background: t.win ? '#dcfce7' : '#fee2e2', color: t.win ? '#15803d' : '#b91c1c' }}>
                              {t.win ? 'WIN' : 'LOSS'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
