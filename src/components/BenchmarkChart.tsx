import { useEffect, useMemo, useState } from 'react'
import { Award, Activity, ShieldAlert, LineChart } from 'lucide-react'
import { api } from '../api/client'
import type { BenchmarkComparisonResponse, BenchmarkPoint } from '../types'

export function BenchmarkChart() {
  const [range, setRange] = useState<'1y' | '6mo' | '3mo' | 'ytd'>('1y')
  const [data, setData] = useState<BenchmarkComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.benchmarkComparison(range)
      .then((res) => {
        if (alive) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [range])

  const series = useMemo(() => data?.series || [], [data])
  const metrics = data?.metrics

  // Compute SVG scale
  const { minVal, maxVal, width, height, pointsPort, pointsSpy, pointsQqq } = useMemo(() => {
    const w = 700
    const h = 260
    if (series.length < 2) {
      return { minVal: 0, maxVal: 10, width: w, height: h, pointsPort: '', pointsSpy: '', pointsQqq: '' }
    }

    let min = 0
    let max = 0
    series.forEach((pt) => {
      min = Math.min(min, pt.portfolio, pt.spy, pt.qqq)
      max = Math.max(max, pt.portfolio, pt.spy, pt.qqq)
    })

    const pad = (max - min) * 0.1 || 2
    const yMin = min - pad
    const yMax = max + pad

    const scaleX = (idx: number) => (idx / (series.length - 1)) * (w - 60) + 40
    const scaleY = (val: number) => h - 30 - ((val - yMin) / (yMax - yMin)) * (h - 50)

    const pPort = series.map((pt, i) => `${scaleX(i).toFixed(1)},${scaleY(pt.portfolio).toFixed(1)}`).join(' ')
    const pSpy = series.map((pt, i) => `${scaleX(i).toFixed(1)},${scaleY(pt.spy).toFixed(1)}`).join(' ')
    const pQqq = series.map((pt, i) => `${scaleX(i).toFixed(1)},${scaleY(pt.qqq).toFixed(1)}`).join(' ')

    return { minVal: yMin, maxVal: yMax, width: w, height: h, pointsPort: pPort, pointsSpy: pSpy, pointsQqq: pQqq }
  }, [series])

  const activePoint: BenchmarkPoint | null = hoverIndex !== null && series[hoverIndex] ? series[hoverIndex] : null

  return (
    <section className="panel" style={{ marginTop: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LineChart size={13} color="var(--accent-dark)" />
            CUMULATIVE BENCHMARK RETURN
          </span>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '16px' }}>Portfolio vs SPY &amp; QQQ</h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Comparative total return curve with Alpha, Beta, Sharpe, and Drawdown analytics.
          </p>
        </div>

        {/* Timeframe selector */}
        <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden', backgroundColor: 'var(--surface-subtle)' }}>
          {(['3mo', '6mo', '1y', 'ytd'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRange(t)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                background: range === t ? 'var(--accent-dark)' : 'transparent',
                color: range === t ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Portfolio Return</span>
            <strong style={{ display: 'block', fontSize: '18px', marginTop: '2px', color: metrics.portfolio_return >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {metrics.portfolio_return >= 0 ? '+' : ''}{metrics.portfolio_return.toFixed(1)}%
            </strong>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
              SPY: {metrics.spy_return >= 0 ? '+' : ''}{metrics.spy_return.toFixed(1)}% · QQQ: {metrics.qqq_return >= 0 ? '+' : ''}{metrics.qqq_return.toFixed(1)}%
            </small>
          </div>

          <div style={{ background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Award size={11} color="var(--accent-dark)" /> Annualized Alpha
            </span>
            <strong style={{ display: 'block', fontSize: '18px', marginTop: '2px', color: metrics.alpha >= 0 ? 'var(--accent-dark)' : 'var(--muted)' }}>
              {metrics.alpha >= 0 ? '+' : ''}{metrics.alpha.toFixed(1)}%
            </strong>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>Excess return vs benchmark</small>
          </div>

          <div style={{ background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={11} color="#c48017" /> Portfolio Beta &amp; Sharpe
            </span>
            <strong style={{ display: 'block', fontSize: '18px', marginTop: '2px', color: 'var(--ink)' }}>
              {metrics.beta.toFixed(2)}x <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--muted)' }}>({metrics.sharpe.toFixed(2)} SR)</span>
            </strong>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>Risk-adjusted Sharpe Ratio</small>
          </div>

          <div style={{ background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={11} color="var(--red)" /> Max Peak Drawdown
            </span>
            <strong style={{ display: 'block', fontSize: '18px', marginTop: '2px', color: 'var(--red)' }}>
              {metrics.max_drawdown.toFixed(1)}%
            </strong>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>Worst peak-to-trough drop</small>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      {loading ? (
        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          Simulating benchmark comparisons…
        </div>
      ) : series.length > 1 ? (
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const relX = (e.clientX - rect.left) / rect.width
              const idx = Math.min(series.length - 1, Math.max(0, Math.round(relX * (series.length - 1))))
              setHoverIndex(idx)
            }}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Zero Line */}
            {minVal < 0 && maxVal > 0 && (
              <line
                x1="40"
                y1={height - 30 - ((0 - minVal) / (maxVal - minVal)) * (height - 50)}
                x2={width - 20}
                y2={height - 30 - ((0 - minVal) / (maxVal - minVal)) * (height - 50)}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )}

            {/* QQQ Curve (Amber dashed) */}
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="3 3"
              points={pointsQqq}
            />

            {/* SPY Curve (Slate/Indigo) */}
            <polyline
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              points={pointsSpy}
            />

            {/* Portfolio Curve (Vibrant Teal / Accent) */}
            <polyline
              fill="none"
              stroke="var(--accent-dark)"
              strokeWidth="3"
              points={pointsPort}
            />

            {/* Hover Vertical Guide */}
            {hoverIndex !== null && (
              <line
                x1={(hoverIndex / (series.length - 1)) * (width - 60) + 40}
                y1="10"
                x2={(hoverIndex / (series.length - 1)) * (width - 60) + 40}
                y2={height - 30}
                stroke="var(--ink)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            )}
          </svg>

          {/* Hover Floating Details */}
          {activePoint && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '16px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '11px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{activePoint.date}</span>
              <span style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>
                Portfolio: {activePoint.portfolio >= 0 ? '+' : ''}{activePoint.portfolio.toFixed(1)}%
              </span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>
                SPY: {activePoint.spy >= 0 ? '+' : ''}{activePoint.spy.toFixed(1)}%
              </span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                QQQ: {activePoint.qqq >= 0 ? '+' : ''}{activePoint.qqq.toFixed(1)}%
              </span>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px', fontSize: '11px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i style={{ width: '14px', height: '3px', backgroundColor: 'var(--accent-dark)', borderRadius: '2px' }} />
              <strong>Portfolio</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
              <i style={{ width: '14px', height: '2px', backgroundColor: '#64748b', borderRadius: '2px' }} />
              SPY (S&amp;P 500)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
              <i style={{ width: '14px', height: '2px', backgroundColor: '#f59e0b', borderTop: '2px dashed #f59e0b' }} />
              QQQ (Nasdaq 100)
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
