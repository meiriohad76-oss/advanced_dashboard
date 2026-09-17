import { useMemo, useState } from 'react'
import { LayoutGrid, TrendingUp, TrendingDown, Layers } from 'lucide-react'
import type { Holding } from '../types'
import { assessHolding } from '../domain/engine'

interface SectorTreemapProps {
  holdings: Holding[]
  onSelect: (holding: Holding) => void
}

function getPerformanceColor(dayChange: number): { bg: string; text: string; border: string } {
  if (dayChange >= 3.0) return { bg: '#059669', text: '#ffffff', border: '#047857' }
  if (dayChange >= 1.5) return { bg: '#10b981', text: '#ffffff', border: '#059669' }
  if (dayChange >= 0.0) return { bg: '#6ee7b7', text: '#064e3b', border: '#34d399' }
  if (dayChange >= -1.5) return { bg: '#fca5a5', text: '#7f1d1d', border: '#f87171' }
  if (dayChange >= -3.0) return { bg: '#ef4444', text: '#ffffff', border: '#dc2626' }
  return { bg: '#b91c1c', text: '#ffffff', border: '#991b1b' }
}

export function SectorTreemap({ holdings, onSelect }: SectorTreemapProps) {
  const [groupBySector, setGroupBySector] = useState(true)
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)

  const nonCashHoldings = useMemo(() => {
    return holdings.filter((h) => h.symbol !== 'CASH')
  }, [holdings])

  // Group by sector
  const sectors = useMemo(() => {
    const map = new Map<string, { sector: string; weight: number; value: number; holdings: Holding[] }>()
    nonCashHoldings.forEach((h) => {
      const sec = h.sector || 'Equities'
      const val = h.quantity * h.price
      const current = map.get(sec) || { sector: sec, weight: 0, value: 0, holdings: [] }
      current.weight += h.weight
      current.value += val
      current.holdings.push(h)
      map.set(sec, current)
    })
    // Sort sectors by weight descending
    return Array.from(map.values()).sort((a, b) => b.weight - a.weight)
  }, [nonCashHoldings])

  return (
    <div style={{ marginTop: '14px' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutGrid size={16} color="var(--accent-dark)" />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            PORTFOLIO PERFORMANCE &amp; SECTOR TREEMAP
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)', marginRight: '6px' }}>
            Color: 1D % Change · Size: Portfolio Weight
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setGroupBySector(!groupBySector)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              background: groupBySector ? 'var(--accent-soft)' : '#fff',
              color: groupBySector ? 'var(--accent-dark)' : 'var(--muted)',
            }}
          >
            <Layers size={13} /> {groupBySector ? 'Grouped by Sector' : 'All Holdings'}
          </button>
        </div>
      </div>

      {groupBySector ? (
        /* Sector Grouped Grid */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {sectors.map((sec) => (
            <div
              key={sec.sector}
              style={{
                background: '#f8faf9',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{sec.sector}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{sec.weight.toFixed(1)}% weight</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>
                  ${Math.round(sec.value).toLocaleString()}
                </span>
              </div>

              {/* Flex Tiles for Sector Holdings */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {sec.holdings.map((h) => {
                  const colors = getPerformanceColor(h.dayChange)
                  const assessment = assessHolding(h)
                  const isHovered = hoveredSymbol === h.symbol
                  const marketVal = h.quantity * h.price
                  // Flexible basis proportional to holding weight
                  const flexBasis = Math.max(110, Math.min(260, h.weight * 16))

                  return (
                    <div
                      key={h.symbol}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(h)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(h) }}
                      onMouseEnter={() => setHoveredSymbol(h.symbol)}
                      onMouseLeave={() => setHoveredSymbol(null)}
                      style={{
                        flex: `1 1 ${flexBasis}px`,
                        minHeight: '76px',
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        padding: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
                      }}
                      title={`${h.symbol}: ${h.dayChange >= 0 ? '+' : ''}${h.dayChange.toFixed(2)}% | Weight: ${h.weight.toFixed(1)}% | Value: $${Math.round(marketVal).toLocaleString()}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '14px', display: 'block', letterSpacing: '0.02em' }}>{h.symbol}</strong>
                          <span style={{ fontSize: '10px', opacity: 0.9 }}>{h.weight.toFixed(1)}% wt</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                          {h.dayChange >= 0 ? <TrendingUp size={12} style={{ marginRight: '2px' }} /> : <TrendingDown size={12} style={{ marginRight: '2px' }} />}
                          {h.dayChange >= 0 ? '+' : ''}{h.dayChange.toFixed(1)}%
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', fontSize: '10px', opacity: 0.95 }}>
                        <span>${h.price.toFixed(2)}</span>
                        <span style={{ fontSize: '9px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', background: 'rgba(0,0,0,0.2)' }}>
                          Score {assessment.score}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat Heatmap Grid */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {nonCashHoldings.map((h) => {
            const colors = getPerformanceColor(h.dayChange)
            const assessment = assessHolding(h)
            const isHovered = hoveredSymbol === h.symbol
            const marketVal = h.quantity * h.price
            const flexBasis = Math.max(120, Math.min(280, h.weight * 18))

            return (
              <div
                key={h.symbol}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(h)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(h) }}
                onMouseEnter={() => setHoveredSymbol(h.symbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                style={{
                  flex: `1 1 ${flexBasis}px`,
                  minHeight: '80px',
                  background: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block' }}>{h.symbol}</strong>
                    <span style={{ fontSize: '10px', opacity: 0.9 }}>{h.sector}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>
                    {h.dayChange >= 0 ? '+' : ''}{h.dayChange.toFixed(1)}%
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', fontSize: '10px', opacity: 0.95 }}>
                  <span>{h.weight.toFixed(1)}% wt (${Math.round(marketVal).toLocaleString()})</span>
                  <span style={{ fontSize: '9px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', background: 'rgba(0,0,0,0.2)' }}>
                    Score {assessment.score}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Color Scale Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', fontSize: '10px', color: 'var(--muted)' }}>
        <span>Day Return:</span>
        <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#059669', color: '#fff' }}>&gt;+3%</span>
        <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#10b981', color: '#fff' }}>+1.5%</span>
        <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#6ee7b7', color: '#064e3b' }}>0%</span>
        <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#fca5a5', color: '#7f1d1d' }}>-1.5%</span>
        <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#ef4444', color: '#fff' }}>&lt;-3%</span>
      </div>
    </div>
  )
}
