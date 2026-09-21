import React, { useEffect, useState } from 'react'
import { Play, Sliders, X } from 'lucide-react'
import { api } from '../api/client'
import { ModalOverlay } from './ModalOverlay'
import type { BacktestCurvePoint, BacktestResult } from '../types'

interface BacktestModalProps {
  onClose: () => void
  initialSymbol?: string
}

const PRESET_SYMBOLS = ['NVDA', 'PLTR', 'ARM', 'CRM', 'VRT', 'GOOGL', 'AEM', 'SPY', 'QQQ']

export function BacktestModal({ onClose, initialSymbol = 'NVDA' }: BacktestModalProps) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase())
  const [customSymbol, setCustomSymbol] = useState('')
  const [entryScore, setEntryScore] = useState(75)
  const [exitScore, setExitScore] = useState(50)
  const [takeProfitPct, setTakeProfitPct] = useState(15)
  const [stopLossPct, setStopLossPct] = useState(5)
  const [maxHoldingDays, setMaxHoldingDays] = useState(20)
  const [rsiMin] = useState(38)
  const [rsiMax] = useState(58)
  const [lookback, setLookback] = useState<'6mo' | '1y' | '2y' | '3y'>('1y')
  const [initialCapital, setInitialCapital] = useState(100000)
  const [strategyMode, setStrategyMode] = useState<'5point_entry' | 'playbook_defense'>('5point_entry')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRunSimulation = async (modeOverride?: '5point_entry' | 'playbook_defense') => {
    setLoading(true)
    setError(null)
    const activeMode = modeOverride || strategyMode
    const targetSym = (customSymbol.trim() || symbol).toUpperCase()
    try {
      const res = await api.analyticsBacktest({
        symbol: targetSym,
        strategy_mode: activeMode,
        entry_score: entryScore,
        exit_score: exitScore,
        lookback,
        initial_capital: initialCapital,
        take_profit_pct: takeProfitPct,
        stop_loss_pct: stopLossPct,
        max_holding_days: maxHoldingDays,
        rsi_min: rsiMin,
        rsi_max: rsiMax,
      })
      setResult(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleRunSimulation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw SVG Equity Curve
  const renderEquityChart = (curve: BacktestCurvePoint[]) => {
    if (!curve || curve.length < 2) return null

    const width = 640
    const height = 200
    const padding = 24

    const allValues = curve.flatMap((p) => [p.portfolio, p.benchmark])
    const minVal = Math.min(...allValues) * 0.98
    const maxVal = Math.max(...allValues) * 1.02
    const valRange = maxVal - minVal || 1

    const getX = (idx: number) => padding + (idx / (curve.length - 1)) * (width - padding * 2)
    const getY = (val: number) => height - padding - ((val - minVal) / valRange) * (height - padding * 2)

    const stratPoints = curve.map((p, i) => `${getX(i)},${getY(p.portfolio)}`).join(' ')
    const benchPoints = curve.map((p, i) => `${getX(i)},${getY(p.benchmark)}`).join(' ')

    // Extract entry points where in_position transitions from false to true
    const entryDots: { x: number; y: number; date: string }[] = []
    for (let i = 1; i < curve.length; i++) {
      if (curve[i].in_position && !curve[i - 1].in_position) {
        entryDots.push({ x: getX(i), y: getY(curve[i].portfolio), date: curve[i].date })
      }
    }

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
            stroke="var(--border, #e2e8f0)"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        ))}

        {/* Benchmark line (SPY) */}
        <polyline points={benchPoints} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />

        {/* Strategy line */}
        <polyline points={stratPoints} fill="none" stroke="#10b981" strokeWidth="2.5" />

        {/* Entry points */}
        {entryDots.map((dot, idx) => (
          <circle key={idx} cx={dot.x} cy={dot.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5">
            <title>Entry triggered on {dot.date}</title>
          </circle>
        ))}
      </svg>
    )
  }

  const activeSymbol = (customSymbol.trim() || symbol).toUpperCase()

  return (
    <ModalOverlay label="5-Point Entry Criteria Backtester" className="decision-modal" onClose={onClose}>
      <div style={{ maxWidth: '800px', width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            paddingBottom: '12px',
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>
              5-POINT CRITERIA STRATEGY BACKTESTER
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 0' }}>
              Historical Performance Simulation: {activeSymbol}
            </h2>
            <small style={{ color: 'var(--muted)' }}>
              Simulates actual trade executions when the 5-point score reaches entry threshold vs SPY benchmark.
            </small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Parameters Panel */}
        <div
          style={{
            background: 'var(--surface-hover, #f8fafc)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border, #e2e8f0)',
            marginBottom: '18px',
          }}
        >
          {/* Strategy Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <button
              type="button"
              onClick={() => {
                setStrategyMode('5point_entry')
                setStopLossPct(5)
                setTakeProfitPct(15)
                handleRunSimulation('5point_entry')
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: strategyMode === '5point_entry' ? 700 : 500,
                background: strategyMode === '5point_entry' ? 'var(--accent-dark, #0f172a)' : 'var(--surface)',
                color: strategyMode === '5point_entry' ? '#fff' : 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              ⚡ 5-Point Entry Criteria
            </button>
            <button
              type="button"
              onClick={() => {
                setStrategyMode('playbook_defense')
                setStopLossPct(6)
                setTakeProfitPct(15)
                handleRunSimulation('playbook_defense')
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: strategyMode === 'playbook_defense' ? 700 : 500,
                background: strategyMode === 'playbook_defense' ? '#047857' : 'var(--surface)',
                color: strategyMode === 'playbook_defense' ? '#fff' : 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              🛡️ Playbook Defense (-6% Stop &amp; Profit Trim)
            </button>
          </div>

          {strategyMode === 'playbook_defense' && (
            <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', fontSize: '11px', color: '#047857', marginBottom: '14px' }}>
              <strong>🛡️ Playbook Active Defense:</strong> Holds {customSymbol || symbol} with automated risk defense: -{stopLossPct}% trailing stop exit to cash on breakdowns, 33% profit trim at +{takeProfitPct}%, and 50 SMA momentum re-entry. Benchmarked directly against 100% passive Buy &amp; Hold of {customSymbol || symbol}.
            </div>
          )}

          {/* Ticker & Lookback Selection */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>CANDIDATE TICKER:</span>
              <select
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value)
                  setCustomSymbol('')
                }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: 'var(--foreground)',
                }}
              >
                {PRESET_SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Or custom ticker..."
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                style={{
                  width: '120px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '12px',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Lookback Selector */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Lookback:</span>
              {(['6mo', '1y', '2y', '3y'] as const).map((lb) => (
                <button
                  key={lb}
                  type="button"
                  onClick={() => setLookback(lb)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: lookback === lb ? 'var(--green)' : 'var(--surface)',
                    color: lookback === lb ? '#fff' : 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {lb}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Grid: 5-Point Criteria & Risk Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            {/* Min Entry Score Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <label>Entry Score Threshold</label>
                <strong style={{ color: 'var(--green)' }}>≥ {entryScore} pts</strong>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="1"
                value={entryScore}
                onChange={(e) => setEntryScore(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Take Profit Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <label>Take-Profit Target</label>
                <strong style={{ color: 'var(--green)' }}>+{takeProfitPct}%</strong>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="1"
                value={takeProfitPct}
                onChange={(e) => setTakeProfitPct(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Stop Loss Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <label>Stop-Loss Risk Limit</label>
                <strong style={{ color: 'var(--red)' }}>-{stopLossPct}%</strong>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={stopLossPct}
                onChange={(e) => setStopLossPct(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Max Holding Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <label>Max Holding Days (Time Stop)</label>
                <strong>{maxHoldingDays} days</strong>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={maxHoldingDays}
                onChange={(e) => setMaxHoldingDays(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Bottom Row: RSI Buy-Zone & Run Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--muted)' }}>
              <span>RSI Buy-Zone:</span>
              <strong style={{ color: 'var(--foreground)' }}>
                {rsiMin} – {rsiMax}
              </strong>
              <span>| MA Filters:</span>
              <strong style={{ color: 'var(--foreground)' }}>Price &gt; 200 &amp; 50 SMA</strong>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => handleRunSimulation()}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '12px' }}
            >
              <Play size={13} />
              {loading ? 'Simulating Strategy...' : 'Run Simulation'}
            </button>
          </div>

          {error && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '10px' }}>{error}</div>}
        </div>

        {/* Results */}
        {result && (
          <div>
            {/* KPI Performance Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid var(--green)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', display: 'block' }}>
                  {strategyMode === 'playbook_defense' ? 'PLAYBOOK DEFENSE' : 'STRATEGY RETURN'}
                </span>
                <strong style={{ fontSize: '18px', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.total_return_pct >= 0 ? '+' : ''}
                  {result.metrics.total_return_pct.toFixed(1)}%
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                  Alpha: <strong>{result.metrics.alpha_pct >= 0 ? '+' : ''}{result.metrics.alpha_pct.toFixed(1)}%</strong>
                </small>
              </div>

              <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>
                  {strategyMode === 'playbook_defense' ? `${activeSymbol} BUY & HOLD` : 'SPY BENCHMARK'}
                </span>
                <strong style={{ fontSize: '18px', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.benchmark_return_pct >= 0 ? '+' : ''}
                  {result.metrics.benchmark_return_pct.toFixed(1)}%
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Passive Hold</small>
              </div>

              {strategyMode === 'playbook_defense' ? (
                <>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid var(--green)' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', display: 'block' }}>DRAWDOWN AVOIDED</span>
                    <strong style={{ fontSize: '18px', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                      +{result.metrics.drawdown_avoided_pct || 0}%
                    </strong>
                    <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                      DD: -{result.metrics.max_drawdown_pct.toFixed(1)}% vs -{result.metrics.benchmark_max_drawdown_pct || 0}%
                    </small>
                  </div>

                  <div style={{ background: 'rgba(37, 99, 235, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid #2563eb' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', display: 'block' }}>CAPITAL PRESERVED</span>
                    <strong style={{ fontSize: '18px', color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>
                      +${result.metrics.capital_preserved ? result.metrics.capital_preserved.toLocaleString() : '0'}
                    </strong>
                    <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Losses prevented</small>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>WIN RATE</span>
                    <strong style={{ fontSize: '18px', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                      {result.metrics.win_rate_pct.toFixed(0)}%
                    </strong>
                    <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                      PF: <strong>{result.metrics.profit_factor}</strong>
                    </small>
                  </div>

                  <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>MAX DRAWDOWN</span>
                    <strong style={{ fontSize: '18px', color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                      -{result.metrics.max_drawdown_pct.toFixed(1)}%
                    </strong>
                    <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Peak-to-trough</small>
                  </div>
                </>
              )}

              <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>
                  {strategyMode === 'playbook_defense' ? 'DEFENSE ACTIONS' : 'TOTAL TRADES'}
                </span>
                <strong style={{ fontSize: '18px', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.trades_count}
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>
                  Avg: <strong>{result.metrics.avg_trade_return_pct !== undefined ? `${result.metrics.avg_trade_return_pct > 0 ? '+' : ''}${result.metrics.avg_trade_return_pct}%` : '—'}</strong>
                </small>
              </div>

              <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>SHARPE RATIO</span>
                <strong style={{ fontSize: '18px', color: result.metrics.sharpe_ratio >= 1.5 ? 'var(--green)' : 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {result.metrics.sharpe_ratio.toFixed(2)}
                </strong>
                <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Risk-adj. return</small>
              </div>
            </div>

            {/* Equity Curve Chart */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>
                  {strategyMode === 'playbook_defense'
                    ? `EQUITY GROWTH: ${activeSymbol} PLAYBOOK DEFENSE VS. BUY & HOLD`
                    : `EQUITY GROWTH COMPARISON (${activeSymbol} 5-POINT STRATEGY VS SPY)`}
                </span>
                <div style={{ display: 'flex', gap: '14px', fontSize: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} />
                    Strategy (${Math.round(result.metrics.final_equity).toLocaleString()})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--muted)' }} />
                    SPY Benchmark (${Math.round(result.metrics.benchmark_final_equity).toLocaleString()})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', border: '1px solid #fff' }} />
                    Entry Points
                  </span>
                </div>
              </div>

              {renderEquityChart(result.equity_curve)}
            </div>

            {/* Simulated Trades Table */}
            {result.trades.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Executed Simulated Trades ({result.trades.length})
                  </span>
                  <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    Avg Duration: {result.metrics.avg_holding_days} days
                  </small>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: 'var(--foreground)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Symbol</th>
                        <th style={{ padding: '6px 8px' }}>Entry Date</th>
                        <th style={{ padding: '6px 8px' }}>Entry Price</th>
                        <th style={{ padding: '6px 8px' }}>Exit Date</th>
                        <th style={{ padding: '6px 8px' }}>Exit Price</th>
                        <th style={{ padding: '6px 8px' }}>Duration</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Return</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Reason</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{t.symbol || activeSymbol}</td>
                          <td style={{ padding: '6px 8px' }}>{t.entry_date}</td>
                          <td style={{ padding: '6px 8px' }}>${t.entry_price ? t.entry_price.toFixed(2) : '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{t.exit_date}</td>
                          <td style={{ padding: '6px 8px' }}>${t.exit_price ? t.exit_price.toFixed(2) : '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{t.duration_days}d</td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: t.return_pct >= 0 ? 'var(--green)' : 'var(--red)',
                            }}
                          >
                            {t.return_pct >= 0 ? `+${t.return_pct.toFixed(2)}%` : `${t.return_pct.toFixed(2)}%`}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background:
                                  t.exit_reason === 'TARGET'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : t.exit_reason === 'STOP_LOSS'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'rgba(148, 163, 184, 0.15)',
                                color:
                                  t.exit_reason === 'TARGET'
                                    ? 'var(--green)'
                                    : t.exit_reason === 'STOP_LOSS'
                                    ? 'var(--red)'
                                    : 'var(--muted)',
                              }}
                            >
                              {t.exit_reason || 'EXIT'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 800,
                                background: t.win ? 'var(--green)' : 'var(--red)',
                                color: '#ffffff',
                              }}
                            >
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
