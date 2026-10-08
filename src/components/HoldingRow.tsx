import React, { useEffect, useState } from 'react'
import { ChevronRight, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { api } from '../api/client'
import { assessHolding } from '../domain/engine'
import { buildTickerRatings } from '../domain/ratings'
import type { Holding, TickerRatings } from '../types'

export type TableDensity = 'compact' | 'comfortable'

interface HoldingRowProps {
  holding: Holding
  onSelect: (holding: Holding) => void
  density?: TableDensity
  onStageOrder?: (holding: Holding) => void
}

const formatCurrency = (value: number, compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value)

function StatusPill({ state }: { state: string }) {
  const key = state.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill ${key}`}>{state}</span>
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={`delta ${positive ? 'positive' : 'negative'}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{' '}
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

export function HoldingRow({
  holding,
  onSelect,
  density = 'comfortable',
  onStageOrder,
}: HoldingRowProps) {
  const assessment = assessHolding(holding)
  const marketValue = holding.quantity * holding.price
  const totalCost = holding.quantity * holding.avgCost
  const pnl = marketValue - totalCost
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0
  const ready = holding.hasSignalInputs !== false
  const [ratings, setRatings] = useState<TickerRatings>(() => buildTickerRatings(holding.symbol))

  useEffect(() => {
    if (holding.symbol === 'CASH') return
    let active = true
    api
      .ratings(holding.symbol)
      .then((real) => {
        if (active) setRatings(real)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [holding.symbol])

  const renderState = () => {
    if (holding.symbol === 'CASH') return '—'
    if (ready) return <StatusPill state={assessment.state} />
    if (ratings?.consensusLabel) return <StatusPill state={ratings.consensusLabel.toUpperCase()} />
    return '—'
  }

  const renderScore = () => {
    if (holding.symbol === 'CASH') return <>—<ChevronRight size={14} /></>
    if (ready) return <>{assessment.score}<ChevronRight size={14} /></>
    if (ratings?.consensus !== null && ratings?.consensus !== undefined) {
      return <>{Math.round(ratings.consensus)}<ChevronRight size={14} /></>
    }
    return <>—<ChevronRight size={14} /></>
  }

  const isCompact = density === 'compact'

  return (
    <button
      className={`holding-row extended ${isCompact ? 'compact' : ''}`}
      onClick={() => onSelect(holding)}
      aria-label={`Open ${holding.symbol} details`}
      style={{
        display: 'grid',
        textAlign: 'left',
        width: '100%',
        alignItems: 'center',
        padding: isCompact ? '6px 14px' : '10px 16px',
        fontSize: isCompact ? '12px' : '13px',
        minHeight: isCompact ? '34px' : '52px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--panel)',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
    >
      <span className="asset-cell" style={{ display: 'flex', alignItems: 'center', gap: isCompact ? '6px' : '10px' }}>
        <span
          className={`asset-logo ${holding.symbol === 'CASH' ? 'cash' : ''}`}
          style={{
            width: isCompact ? '22px' : '28px',
            height: isCompact ? '22px' : '28px',
            fontSize: isCompact ? '10px' : '12px',
          }}
        >
          {holding.symbol.slice(0, 1)}
        </span>
        <span style={{ display: 'grid', lineHeight: 1.2 }}>
          <strong style={{ fontSize: isCompact ? '12px' : '13px' }}>{holding.symbol}</strong>
          {!isCompact && holding.name && holding.name !== holding.symbol && (
            <small style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>
              {holding.name}
            </small>
          )}
        </span>
      </span>

      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {holding.symbol === 'CASH' ? '—' : formatCurrency(holding.price)}
      </span>

      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {holding.symbol === 'CASH' ? '—' : holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>

      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {holding.symbol === 'CASH' ? '—' : formatCurrency(holding.avgCost)}
      </span>

      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {holding.symbol === 'CASH' ? formatCurrency(marketValue) : formatCurrency(marketValue, true)}
      </span>

      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {holding.weight.toFixed(1)}%
      </span>

      <span>
        <Delta value={holding.dayChange} />
      </span>

      <span className={pnlPct >= 0 ? 'value-positive' : 'value-negative'} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {holding.symbol === 'CASH' ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
      </span>

      <span className={pnl >= 0 ? 'value-positive' : 'value-negative'} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {holding.symbol === 'CASH' ? '—' : `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl, true)}`}
      </span>

      <span>{renderState()}</span>

      <span className="score-cell" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
        {renderScore()}
      </span>
    </button>
  )
}
