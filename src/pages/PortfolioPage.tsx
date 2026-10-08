import React, { useMemo, useState } from 'react'
import { LayoutGrid, Scale, Search, Table, Zap } from 'lucide-react'
import { HoldingRow, type TableDensity } from '../components/HoldingRow'
import { SectorTreemap } from '../components/SectorTreemap'
import { Tooltip } from '../components/Tooltip'
import { METRIC_TOOLTIPS } from '../data/tooltips'
import { assessHolding } from '../domain/engine'
import type { Holding } from '../types'

interface PortfolioPageProps {
  holdings: Holding[]
  onSelect: (holding: Holding) => void
  onRefresh?: () => void
  refreshing?: boolean
  onOpenRebalance?: () => void
  onStageOrder?: (holding: Holding) => void
}

type PortfolioSortKey =
  | 'symbol'
  | 'price'
  | 'quantity'
  | 'avgCost'
  | 'marketValue'
  | 'weight'
  | 'dayChange'
  | 'unrealizedPct'
  | 'unrealizedVal'
  | 'state'
  | 'score'

export function PortfolioPage({
  holdings,
  onSelect,
  onRefresh,
  refreshing,
  onOpenRebalance,
  onStageOrder,
}: PortfolioPageProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<PortfolioSortKey>('weight')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'table' | 'treemap'>('table')

  // Table density mode: persistent
  const [density, setDensity] = useState<TableDensity>(() => {
    try {
      const saved = localStorage.getItem('atlas_table_density')
      if (saved === 'compact' || saved === 'comfortable') return saved
    } catch {
      /* ignore */
    }
    return 'comfortable'
  })

  const handleDensityChange = (newDensity: TableDensity) => {
    setDensity(newDensity)
    try {
      localStorage.setItem('atlas_table_density', newDensity)
    } catch {
      /* ignore */
    }
  }

  const handleSort = (key: PortfolioSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return holdings
    const q = search.trim().toLowerCase()
    return holdings.filter(
      (h) =>
        h.symbol.toLowerCase().includes(q) ||
        (h.name && h.name.toLowerCase().includes(q)) ||
        h.sector.toLowerCase().includes(q)
    )
  }, [holdings, search])

  const sortedHoldings = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let vA: number | string = 0
      let vB: number | string = 0
      switch (sortKey) {
        case 'symbol':
          return sortDir === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol)
        case 'price':
          vA = a.price
          vB = b.price
          break
        case 'quantity':
          vA = a.quantity
          vB = b.quantity
          break
        case 'avgCost':
          vA = a.avgCost
          vB = b.avgCost
          break
        case 'marketValue':
          vA = a.quantity * a.price
          vB = b.quantity * b.price
          break
        case 'weight':
          vA = a.weight
          vB = b.weight
          break
        case 'dayChange':
          vA = a.dayChange
          vB = b.dayChange
          break
        case 'unrealizedPct': {
          const cA = a.avgCost || a.price
          const cB = b.avgCost || b.price
          vA = cA > 0 ? ((a.price - cA) / cA) * 100 : 0
          vB = cB > 0 ? ((b.price - cB) / cB) * 100 : 0
          break
        }
        case 'unrealizedVal': {
          const cA = a.avgCost || a.price
          const cB = b.avgCost || b.price
          vA = (a.price - cA) * a.quantity
          vB = (b.price - cB) * b.quantity
          break
        }
        case 'state': {
          const sA = assessHolding(a).state
          const sB = assessHolding(b).state
          return sortDir === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA)
        }
        case 'score': {
          vA = assessHolding(a).score
          vB = assessHolding(b).score
          break
        }
      }
      return sortDir === 'asc' ? (vA as number) - (vB as number) : (vB as number) - (vA as number)
    })
  }, [filtered, sortKey, sortDir])

  const renderSortArrow = (key: PortfolioSortKey) => (
    <span className="sort-arrow">{sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
  )

  const isCompact = density === 'compact'

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">CURRENT POSITION</span>
        <h2>Portfolio Exposure &amp; Holdings</h2>
        <p>A complete view of exposure, position sizing, cost basis, performance, and quant signal state.</p>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div className="search-box">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search holdings by symbol, name, or sector…"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Table Density Switcher */}
            <div
              className="density-switcher"
              style={{
                display: 'inline-flex',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                backgroundColor: 'var(--surface-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => handleDensityChange('compact')}
                style={{
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  background: isCompact ? 'var(--accent-dark)' : 'transparent',
                  color: isCompact ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                }}
                title="Dense view (34px rows, maximum data per screen)"
              >
                Compact (Pro)
              </button>
              <button
                type="button"
                onClick={() => handleDensityChange('comfortable')}
                style={{
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  background: !isCompact ? 'var(--accent-dark)' : 'transparent',
                  color: !isCompact ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                }}
                title="Comfortable view (52px rows, detailed chips)"
              >
                Comfortable
              </button>
            </div>

            {/* View Mode Switcher */}
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                backgroundColor: 'var(--surface-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  background: viewMode === 'table' ? 'var(--accent-dark)' : 'transparent',
                  color: viewMode === 'table' ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                <Table size={13} /> Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('treemap')}
                style={{
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  background: viewMode === 'treemap' ? 'var(--accent-dark)' : 'transparent',
                  color: viewMode === 'treemap' ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                <LayoutGrid size={13} /> Heatmap
              </button>
            </div>

            {onOpenRebalance && (
              <button
                type="button"
                className="banner-primary"
                onClick={onOpenRebalance}
                title="Model-based portfolio rebalance and trade execution"
              >
                <Scale size={14} /> Rebalance &amp; Trade
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                className="refresh-data-btn"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh live market quotes and recalculate technical signals"
              >
                <Zap size={14} className={refreshing ? 'spin' : ''} />
                {refreshing ? 'Refreshing…' : '⚡ Refresh All Data'}
              </button>
            )}

            <button
              className="secondary-button"
              onClick={() => {
                const rows = ['Symbol,Name,Sector,Price,Shares,AvgCost,Weight,DayChange,Value']
                holdings.forEach((h) =>
                  rows.push(
                    `${h.symbol},"${h.name || ''}",${h.sector},${h.price},${h.quantity},${h.avgCost},${h.weight}%,${h.dayChange}%,${(h.quantity * h.price).toFixed(2)}`
                  )
                )
                const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'atlas_portfolio.csv'
                a.click()
              }}
            >
              Export CSV
            </button>
          </div>
        </div>

        {viewMode === 'treemap' ? (
          <div style={{ padding: '0 16px 16px 16px' }}>
            <SectorTreemap holdings={filtered} onSelect={onSelect} />
          </div>
        ) : (
          <>
            <div className={`table-head extended ${isCompact ? 'compact' : ''}`}>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'symbol' ? 'active' : ''}`} onClick={() => handleSort('symbol')}>
                  Asset {renderSortArrow('symbol')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'price' ? 'active' : ''}`} onClick={() => handleSort('price')}>
                  Price {renderSortArrow('price')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'quantity' ? 'active' : ''}`} onClick={() => handleSort('quantity')}>
                  <Tooltip content={METRIC_TOOLTIPS.shares}>Shares</Tooltip> {renderSortArrow('quantity')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'avgCost' ? 'active' : ''}`} onClick={() => handleSort('avgCost')}>
                  <Tooltip content={METRIC_TOOLTIPS.costBasis}>Avg Cost</Tooltip> {renderSortArrow('avgCost')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'marketValue' ? 'active' : ''}`} onClick={() => handleSort('marketValue')}>
                  <Tooltip content={METRIC_TOOLTIPS.totalCost}>Market Value</Tooltip> {renderSortArrow('marketValue')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'weight' ? 'active' : ''}`} onClick={() => handleSort('weight')}>
                  Weight {renderSortArrow('weight')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'dayChange' ? 'active' : ''}`} onClick={() => handleSort('dayChange')}>
                  Today {renderSortArrow('dayChange')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'unrealizedPct' ? 'active' : ''}`} onClick={() => handleSort('unrealizedPct')}>
                  <Tooltip content={METRIC_TOOLTIPS.unrealizedPct}>Unrealized %</Tooltip> {renderSortArrow('unrealizedPct')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'unrealizedVal' ? 'active' : ''}`} onClick={() => handleSort('unrealizedVal')}>
                  <Tooltip content={METRIC_TOOLTIPS.unrealizedVal}>Unrealized Value</Tooltip> {renderSortArrow('unrealizedVal')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'state' ? 'active' : ''}`} onClick={() => handleSort('state')}>
                  State {renderSortArrow('state')}
                </button>
              </span>
              <span>
                <button type="button" className={`th-sort-btn ${sortKey === 'score' ? 'active' : ''}`} onClick={() => handleSort('score')}>
                  Score {renderSortArrow('score')}
                </button>
              </span>
            </div>
            {sortedHoldings.map((holding) => (
              <HoldingRow
                key={holding.symbol}
                holding={holding}
                onSelect={onSelect}
                density={density}
                onStageOrder={onStageOrder}
              />
            ))}
          </>
        )}
      </section>
    </>
  )
}
