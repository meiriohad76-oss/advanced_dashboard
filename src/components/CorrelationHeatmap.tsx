import { useEffect, useState } from 'react'
import { GitCompare, AlertTriangle, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'
import type { CorrelationMatrixResponse } from '../types'

function getCellColor(val: number, isDiag: boolean): { bg: string; text: string } {
  if (isDiag) return { bg: 'rgba(100, 116, 139, 0.15)', text: 'var(--muted)' }
  if (val >= 0.80) return { bg: 'rgba(239, 68, 68, 0.35)', text: '#dc2626' }
  if (val >= 0.65) return { bg: 'rgba(245, 158, 11, 0.28)', text: '#d97706' }
  if (val >= 0.40) return { bg: 'rgba(245, 158, 11, 0.14)', text: '#b45309' }
  if (val >= 0.15) return { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' }
  if (val >= -0.15) return { bg: 'rgba(100, 116, 139, 0.08)', text: 'var(--ink)' }
  return { bg: 'rgba(16, 185, 129, 0.30)', text: '#047857' } // Strong hedge
}

export function CorrelationHeatmap() {
  const [data, setData] = useState<CorrelationMatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; val: number } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.correlationMatrix(8)
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
  }, [])

  if (loading) {
    return (
      <section className="panel" style={{ padding: '24px', textAlign: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Calculating Pearson correlation matrix…</span>
      </section>
    )
  }

  if (!data || !data.symbols || data.symbols.length === 0) {
    return null
  }

  const { symbols, matrix, high_pairs } = data

  return (
    <section className="panel" style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitCompare size={13} color="var(--accent-dark)" />
            CROSS-ASSET CO-MOVEMENT
          </span>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '16px' }}>Pairwise Correlation Heatmap</h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Pearson correlation coefficient (\(\rho\)) based on 6 months of daily returns.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <i style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'rgba(239, 68, 68, 0.4)' }} /> &gt;0.7 High Overlap
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <i style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'rgba(16, 185, 129, 0.3)' }} /> &lt;0.2 Diversified
          </span>
        </div>
      </div>

      {/* Heatmap Grid Container */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}></th>
              {symbols.map((s) => (
                <th key={s} style={{ padding: '6px', fontWeight: 700, color: 'var(--ink)' }}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((symRow, i) => (
              <tr key={symRow}>
                <td style={{ padding: '6px', textAlign: 'left', fontWeight: 700, color: 'var(--ink)' }}>
                  {symRow}
                </td>
                {symbols.map((symCol, j) => {
                  const val = matrix[i] ? matrix[i][j] : 0
                  const isDiag = i === j
                  const colors = getCellColor(val, isDiag)
                  const isHovered = hoveredCell && hoveredCell.row === symRow && hoveredCell.col === symCol

                  return (
                    <td
                      key={symCol}
                      onMouseEnter={() => setHoveredCell({ row: symRow, col: symCol, val })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        padding: '8px 6px',
                        backgroundColor: isHovered ? 'var(--accent-subtle)' : colors.bg,
                        color: colors.text,
                        fontWeight: isDiag ? 400 : 700,
                        borderRadius: '4px',
                        cursor: 'default',
                        transition: 'background-color 0.15s ease',
                        border: '1px solid var(--surface-card, rgba(0,0,0,0.05))',
                      }}
                      title={`${symRow} vs ${symCol}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}`}
                    >
                      {isDiag ? '1.0' : (val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover Callout or Insights */}
      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <AlertTriangle size={13} color="#d97706" />
            Concentration Overlap Pairs
          </span>
          {high_pairs && high_pairs.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {high_pairs.map((p, idx) => (
                <span key={idx} style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  {p.pair[0]} &amp; {p.pair[1]} (+{p.correlation.toFixed(2)})
                </span>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
              No critical co-movement clusters detected (&gt;0.70). Holdings display healthy decorrelation.
            </p>
          )}
        </div>

        <div style={{ background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <ShieldCheck size={13} color="#059669" />
            Diversification Benefit
          </span>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
            Assets with correlation &lt;0.30 dampen drawdown volatility. Cross-sector positions reduce systematic exposure.
          </p>
        </div>
      </div>
    </section>
  )
}
