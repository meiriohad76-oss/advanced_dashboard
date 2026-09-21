import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart2, RefreshCw } from 'lucide-react'
import { api } from '../api/client'

export interface BarData {
  time: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  sma20?: number | null
  sma50?: number | null
  sma200?: number | null
}

export interface BarsResponse {
  symbol: string
  range: string
  interval: string
  count: number
  current_price: number
  day_change: number
  sma50?: number | null
  sma200?: number | null
  bars: BarData[]
}

export interface ChartTrigger {
  id: string
  type: 'stop_loss' | 'profit_target' | 'dip_buy' | 'custom'
  price: number
  label: string
  actionDirective?: string
}

interface CandleChartProps {
  symbol: string
  height?: number
  defaultRange?: '1mo' | '3mo' | '6mo' | '1y'
  triggers?: ChartTrigger[]
}

type RangeOption = '1mo' | '3mo' | '6mo' | '1y'

export function CandleChart({ symbol, height = 280, defaultRange = '6mo', triggers = [] }: CandleChartProps) {
  const [range, setRange] = useState<RangeOption>(defaultRange)
  const [data, setData] = useState<BarsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [showSma50, setShowSma50] = useState<boolean>(true)
  const [showSma200, setShowSma200] = useState<boolean>(true)
  const [showTriggers, setShowTriggers] = useState<boolean>(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoveredTrigger, setHoveredTrigger] = useState<ChartTrigger | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.marketBars(symbol, range, '1d')
      .then((res) => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [symbol, range])

  const bars = useMemo(() => data?.bars || [], [data])

  // Metrics & Chart Geometry
  const chartWidth = 560
  const chartHeight = height
  const volumeHeight = 46
  const priceHeight = chartHeight - volumeHeight - 16
  const paddingX = 14

  const { minPrice, maxPrice, maxVol } = useMemo(() => {
    if (!bars.length) return { minPrice: 0, maxPrice: 100, maxVol: 1 }
    let min = Infinity
    let max = -Infinity
    let volMax = 0

    bars.forEach((b) => {
      if (b.low < min) min = b.low
      if (b.high > max) max = b.high
      if (b.sma50 != null) {
        if (b.sma50 < min) min = b.sma50
        if (b.sma50 > max) max = b.sma50
      }
      if (b.sma200 != null) {
        if (b.sma200 < min) min = b.sma200
        if (b.sma200 > max) max = b.sma200
      }
      if (b.volume > volMax) volMax = b.volume
    })

    if (showTriggers && triggers.length > 0) {
      triggers.forEach((t) => {
        if (t.price > 0 && min !== Infinity && max !== -Infinity) {
          if (t.price >= min * 0.7 && t.price <= max * 1.3) {
            if (t.price < min) min = t.price
            if (t.price > max) max = t.price
          }
        }
      })
    }

    const pad = (max - min) * 0.05 || 1.0
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      maxVol: volMax || 1,
    }
  }, [bars, showTriggers, triggers])

  const priceRange = maxPrice - minPrice || 1.0
  const getY = useCallback((price: number) => {
    return priceHeight - ((price - minPrice) / priceRange) * priceHeight
  }, [priceHeight, minPrice, priceRange])

  const getVolY = (vol: number) => {
    const vH = (vol / maxVol) * volumeHeight
    return chartHeight - vH
  }

  const barCount = bars.length
  const candleSpacing = barCount > 1 ? (chartWidth - paddingX * 2) / (barCount - 1) : 10
  const candleWidth = Math.max(2, Math.min(8, candleSpacing * 0.65))

  const activeBar = hoverIndex !== null && bars[hoverIndex] ? bars[hoverIndex] : bars[bars.length - 1]

  // Compute SMA polyline paths
  const sma50Points = useMemo(() => {
    if (!showSma50 || !bars.length) return ''
    return bars
      .map((b, i) => {
        if (b.sma50 == null) return null
        const x = paddingX + i * candleSpacing
        const y = getY(b.sma50)
        return `${x},${y}`
      })
      .filter(Boolean)
      .join(' ')
  }, [bars, showSma50, candleSpacing, getY])

  const sma200Points = useMemo(() => {
    if (!showSma200 || !bars.length) return ''
    return bars
      .map((b, i) => {
        if (b.sma200 == null) return null
        const x = paddingX + i * candleSpacing
        const y = getY(b.sma200)
        return `${x},${y}`
      })
      .filter(Boolean)
      .join(' ')
  }, [bars, showSma200, candleSpacing, getY])

  return (
    <section className="drawer-section candle-chart-card" style={{ marginTop: '14px', background: 'var(--subtle)', border: '1px solid var(--line)', borderRadius: '12px', padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} color="var(--accent-dark)" />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            INTERACTIVE CANDLESTICK &amp; SMA
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['1mo', '3mo', '6mo', '1y'] as RangeOption[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                borderRadius: '6px',
                border: range === r ? '1px solid var(--accent-dark)' : '1px solid var(--line)',
                background: range === r ? 'var(--accent-soft)' : 'var(--panel)',
                color: range === r ? 'var(--accent-dark)' : 'var(--muted)',
                fontWeight: range === r ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Hover Info Header */}
      {activeBar && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'baseline', fontSize: '11px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{activeBar.time}</span>
          <span>O: <strong>${activeBar.open.toFixed(2)}</strong></span>
          <span>H: <strong>${activeBar.high.toFixed(2)}</strong></span>
          <span>L: <strong>${activeBar.low.toFixed(2)}</strong></span>
          <span>C: <strong style={{ color: activeBar.close >= activeBar.open ? 'var(--green)' : 'var(--red)' }}>${activeBar.close.toFixed(2)}</strong></span>
          <span>Vol: <strong>{activeBar.volume > 1e6 ? `${(activeBar.volume / 1e6).toFixed(1)}M` : activeBar.volume.toLocaleString()}</strong></span>
          {activeBar.sma50 != null && showSma50 && (
            <span style={{ color: '#d97706' }}>SMA50: <strong>${activeBar.sma50.toFixed(2)}</strong></span>
          )}
          {activeBar.sma200 != null && showSma200 && (
            <span style={{ color: '#2563eb' }}>SMA200: <strong>${activeBar.sma200.toFixed(2)}</strong></span>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ height: `${chartHeight}px`, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className="spin" /> Loading historical bars for {symbol}…
          </div>
        </div>
      ) : bars.length === 0 ? (
        <div style={{ height: `${chartHeight}px`, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          No bar data available for {symbol}
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: '100%', height: `${chartHeight}px`, display: 'block', cursor: 'crosshair' }}
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth
              const idx = Math.max(0, Math.min(barCount - 1, Math.round((mouseX - paddingX) / candleSpacing)))
              setHoverIndex(idx)
            }}
          >
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Price Gridlines */}
            {[0.25, 0.5, 0.75].map((pct) => {
              const y = priceHeight * pct
              const pVal = maxPrice - (pct * priceRange)
              return (
                <g key={pct}>
                  <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
                  <text x={chartWidth - paddingX + 2} y={y + 3} fill="#94a3b8" fontSize="8" textAnchor="start">
                    ${pVal.toFixed(1)}
                  </text>
                </g>
              )
            })}

            {/* Volume Separator */}
            <line x1={paddingX} y1={chartHeight - volumeHeight - 4} x2={chartWidth - paddingX} y2={chartHeight - volumeHeight - 4} stroke="#e2e8f0" strokeWidth="1" />

            {/* Volume Bars */}
            {bars.map((b, i) => {
              const x = paddingX + i * candleSpacing - candleWidth / 2
              const y = getVolY(b.volume)
              const vH = chartHeight - y
              const isBull = b.close >= b.open
              return (
                <rect
                  key={`vol-${b.timestamp}-${i}`}
                  x={x}
                  y={y}
                  width={candleWidth}
                  height={Math.max(1, vH)}
                  fill={isBull ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}
                />
              )
            })}

            {/* Candlesticks (Wick + Body) */}
            {bars.map((b, i) => {
              const xCenter = paddingX + i * candleSpacing
              const isBull = b.close >= b.open
              const color = isBull ? '#10b981' : '#ef4444'
              const yOpen = getY(b.open)
              const yClose = getY(b.close)
              const yHigh = getY(b.high)
              const yLow = getY(b.low)
              const bodyTop = Math.min(yOpen, yClose)
              const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose))

              return (
                <g key={`candle-${b.timestamp}-${i}`}>
                  {/* High/Low Wick */}
                  <line x1={xCenter} y1={yHigh} x2={xCenter} y2={yLow} stroke={color} strokeWidth="1.2" />
                  {/* Real Body */}
                  <rect
                    x={xCenter - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={isBull ? '#10b981' : '#ef4444'}
                    stroke={color}
                    strokeWidth="0.5"
                    rx="0.5"
                  />
                </g>
              )
            })}

            {/* SMA-50 Line (Amber) */}
            {sma50Points && (
              <polyline points={sma50Points} fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
            )}

            {/* SMA-200 Line (Blue) */}
            {sma200Points && (
              <polyline points={sma200Points} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
            )}

            {/* Visual Trigger Overlay Lines (Stop-Loss, Target, Dip-Buy) */}
            {showTriggers && triggers.map((t) => {
              const y = getY(t.price)
              if (y < 0 || y > priceHeight) return null
              const isStop = t.type === 'stop_loss'
              const isTarget = t.type === 'profit_target'
              const strokeColor = isStop ? '#ef4444' : isTarget ? '#10b981' : '#3b82f6'
              const bgColor = isStop ? 'rgba(239, 68, 68, 0.12)' : isTarget ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)'
              const textColor = isStop ? '#b91c1c' : isTarget ? '#047857' : '#1d4ed8'
              const currentPrice = data?.current_price || (bars.length > 0 ? bars[bars.length - 1].close : 0)
              const diffPct = currentPrice > 0 ? ((t.price - currentPrice) / currentPrice) * 100 : 0
              const diffStr = (diffPct >= 0 ? '+' : '') + diffPct.toFixed(1) + '%'
              const labelText = `${t.label}: $${t.price.toFixed(2)} (${diffStr})`

              return (
                <g
                  key={t.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredTrigger(t)}
                  onMouseLeave={() => setHoveredTrigger(null)}
                >
                  <title>{`${t.label}: $${t.price.toFixed(2)} (${diffStr})\n${t.actionDirective || ''}`}</title>
                  {/* Horizontal dashed line across price chart */}
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX - 116}
                    y2={y}
                    stroke={strokeColor}
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                    opacity="0.85"
                  />
                  {/* Badge pill at right axis */}
                  <rect
                    x={chartWidth - paddingX - 114}
                    y={y - 8}
                    width="114"
                    height="16"
                    rx="3"
                    fill={bgColor}
                    stroke={strokeColor}
                    strokeWidth="0.8"
                  />
                  <text
                    x={chartWidth - paddingX - 57}
                    y={y + 3.5}
                    fill={textColor}
                    fontSize="7.5"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {labelText}
                  </text>
                </g>
              )
            })}

            {/* Hover Crosshair */}
            {hoverIndex !== null && hoverIndex < bars.length && (
              <g>
                <line
                  x1={paddingX + hoverIndex * candleSpacing}
                  y1={0}
                  x2={paddingX + hoverIndex * candleSpacing}
                  y2={chartHeight}
                  stroke="#64748b"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <circle
                  cx={paddingX + hoverIndex * candleSpacing}
                  cy={getY(bars[hoverIndex].close)}
                  r="3.5"
                  fill="#0f172a"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              </g>
            )}
          </svg>

          {/* Hovered Trigger Directive Banner */}
          {hoveredTrigger && hoveredTrigger.actionDirective && (
            <div style={{
              marginTop: '6px',
              padding: '6px 10px',
              background: hoveredTrigger.type === 'stop_loss' ? 'rgba(239, 68, 68, 0.1)' : hoveredTrigger.type === 'profit_target' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              border: `1px solid ${hoveredTrigger.type === 'stop_loss' ? '#ef4444' : hoveredTrigger.type === 'profit_target' ? '#10b981' : '#3b82f6'}`,
              borderRadius: '6px',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <strong>🎯 {hoveredTrigger.label} Directive:</strong>
              <span>{hoveredTrigger.actionDirective}</span>
            </div>
          )}

          {/* Indicators Legend Toggles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', marginTop: '6px', fontSize: '10px', color: 'var(--muted)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showSma50} onChange={(e) => setShowSma50(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', background: '#d97706', borderRadius: '2px', display: 'inline-block' }} />
              SMA 50
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showSma200} onChange={(e) => setShowSma200(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', background: '#2563eb', borderRadius: '2px', display: 'inline-block' }} />
              SMA 200
            </label>
            {triggers.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showTriggers} onChange={(e) => setShowTriggers(e.target.checked)} />
                <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px', display: 'inline-block' }} />
                Triggers ({triggers.length})
              </label>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '9px' }}>
              Hover for OHLCV &amp; trigger directives
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
