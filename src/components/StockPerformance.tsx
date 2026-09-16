import { useMemo, useState } from 'react'
import { TimeframeKey } from './TimeframeSelector'
import type { Holding } from '../types'

export interface StockPerformanceProps {
  holding: Holding
}

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: '1W', label: '1 Week' },
  { key: '1M', label: '1 Month' },
  { key: '3M', label: '3 Months' },
  { key: '6M', label: '6 Months' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1 Year' },
]

export function StockPerformance({ holding }: StockPerformanceProps) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1Y')

  // Generate deterministic performance series for this stock based on its price and indicators
  const seriesData = useMemo(() => {
    const basePrice = holding.price
    const points: number[] = []
    
    // Seed points based on symbol hash and price
    const seed = holding.symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const factor = (seed % 15 + 10) / 100

    let count = 12
    if (timeframe === '1W') count = 5
    else if (timeframe === '1M') count = 8
    else if (timeframe === '3M') count = 10
    else if (timeframe === '6M') count = 12
    else if (timeframe === 'YTD') count = 10
    else count = 14

    for (let i = 0; i < count; i++) {
      const step = (i / (count - 1))
      const wave = Math.sin((i + seed) * 0.7) * (basePrice * factor * 0.4)
      const trend = (step - 0.5) * (holding.dayChange >= 0 ? basePrice * 0.25 : -basePrice * 0.15)
      const p = Math.max(1.0, basePrice - (basePrice * factor * 0.5) + trend + wave)
      points.push(p)
    }
    // ensure last point matches current price
    points[points.length - 1] = basePrice

    const start = points[0]
    const end = points[points.length - 1]
    const returnPct = start ? ((end - start) / start) * 100 : 0

    // SPY benchmark return over same timeframe
    const spyReturns: Record<TimeframeKey, number> = {
      '1W': 0.8,
      '1M': 2.4,
      '3M': 5.1,
      '6M': 9.8,
      'YTD': 7.1,
      '1Y': 12.1,
    }
    const spyReturn = spyReturns[timeframe] || 12.1
    const alpha = returnPct - spyReturn

    return {
      points,
      returnPct,
      spyReturn,
      alpha,
    }
  }, [holding, timeframe])

  const width = 400
  const height = 120
  const min = Math.min(...seriesData.points) * 0.98
  const max = Math.max(...seriesData.points) * 1.02

  const polyPoints = seriesData.points
    .map((val, idx) => `${(idx / (seriesData.points.length - 1)) * width},${height - ((val - min) / (max - min)) * height}`)
    .join(' ')

  const isPositive = seriesData.returnPct >= 0

  return (
    <section className="drawer-section stock-performance-section" style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
      <div className="section-heading" style={{ marginBottom: '10px' }}>
        <div>
          <span className="eyebrow">ASSET PERFORMANCE ANALYSIS</span>
          <h3 style={{ fontSize: '13px', margin: '2px 0', color: 'var(--ink)' }}>{holding.symbol} Returns History</h3>
        </div>
        <div className="timeframe-selector" style={{ background: 'var(--subtle)', padding: '2px', borderRadius: '6px' }}>
          {TIMEFRAMES.map(({ key }) => (
            <button
              key={key}
              className={`tf-button ${timeframe === key ? 'active' : ''}`}
              onClick={() => setTimeframe(key)}
              style={{ padding: '3px 7px', fontSize: '9px' }}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <strong style={{ fontSize: '18px', color: isPositive ? 'var(--accent-dark)' : 'var(--red)' }}>
            {isPositive ? '+' : ''}{seriesData.returnPct.toFixed(2)}%
          </strong>
          <small style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '8px' }}>
            {timeframe} Return
          </small>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
          vs SPY ({seriesData.spyReturn >= 0 ? '+' : ''}{seriesData.spyReturn.toFixed(1)}%):{' '}
          <strong style={{ color: seriesData.alpha >= 0 ? 'var(--accent-dark)' : 'var(--red)' }}>
            {seriesData.alpha >= 0 ? '+' : ''}{seriesData.alpha.toFixed(1)}% Alpha
          </strong>
        </div>
      </div>

      <div className="chart-wrap" style={{ height: '110px', position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={`stock-fade-${holding.symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={isPositive ? '#36a879' : '#ca4f4b'} stopOpacity="0.25" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${height} ${polyPoints} ${width},${height}`} fill={`url(#stock-fade-${holding.symbol})`} />
          <polyline points={polyPoints} fill="none" stroke={isPositive ? '#14875e' : '#ca4f4b'} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  )
}
