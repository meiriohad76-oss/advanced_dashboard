import React, { useMemo, useState } from 'react'
import { ArrowRight, Database } from 'lucide-react'
import { PortfolioFitTag } from '../components/PortfolioFit'
import { RatingsConsensusChip } from '../components/RatingsConsensusChip'
import { assessHolding } from '../domain/engine'
import type { Holding } from '../types'

interface SignalsPageProps {
  holdings: Holding[]
  onSelect: (holding: Holding) => void
}

type SignalSortKey = 'score' | 'symbol' | 'dayChange' | 'state'

function StatusPill({ state }: { state: string }) {
  const key = state.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill ${key}`}>{state}</span>
}

export function SignalsPage({ holdings, onSelect }: SignalsPageProps) {
  const [sortKey, setSortKey] = useState<SignalSortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SignalSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' || key === 'state' ? 'asc' : 'desc')
    }
  }

  const ranked = useMemo(() => {
    const list = holdings
      .filter((h) => h.symbol !== 'CASH')
      .map((holding) => ({
        holding,
        assessment: assessHolding(holding),
        ready: holding.hasSignalInputs !== false,
      }))
    return list.sort((a, b) => {
      if (sortKey === 'score') {
        const diff =
          Number(b.ready) - Number(a.ready) ||
          (sortDir === 'desc'
            ? b.assessment.score - a.assessment.score
            : a.assessment.score - b.assessment.score)
        return diff
      }
      if (sortKey === 'symbol') {
        return sortDir === 'asc'
          ? a.holding.symbol.localeCompare(b.holding.symbol)
          : b.holding.symbol.localeCompare(a.holding.symbol)
      }
      if (sortKey === 'dayChange') {
        return sortDir === 'desc'
          ? b.holding.dayChange - a.holding.dayChange
          : a.holding.dayChange - b.holding.dayChange
      }
      if (sortKey === 'state') {
        return sortDir === 'asc'
          ? a.assessment.state.localeCompare(b.assessment.state)
          : b.assessment.state.localeCompare(a.assessment.state)
      }
      return 0
    })
  }, [holdings, sortKey, sortDir])

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">EXPLAINABLE PRIORITIZATION</span>
          <h1>Signal Center</h1>
          <p>Ranked setups with every contributing rule, factor weight, and portfolio fit adjustment visible.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Sort by:</span>
          <button
            type="button"
            className={`secondary-button ${sortKey === 'score' ? 'active' : ''}`}
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'score' ? 700 : 500 }}
            onClick={() => handleSort('score')}
          >
            Score {sortKey === 'score' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </button>
          <button
            type="button"
            className={`secondary-button ${sortKey === 'symbol' ? 'active' : ''}`}
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'symbol' ? 700 : 500 }}
            onClick={() => handleSort('symbol')}
          >
            Symbol {sortKey === 'symbol' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </button>
          <button
            type="button"
            className={`secondary-button ${sortKey === 'dayChange' ? 'active' : ''}`}
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'dayChange' ? 700 : 500 }}
            onClick={() => handleSort('dayChange')}
          >
            Today % {sortKey === 'dayChange' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </button>
          <button
            type="button"
            className={`secondary-button ${sortKey === 'state' ? 'active' : ''}`}
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: sortKey === 'state' ? 700 : 500 }}
            onClick={() => handleSort('state')}
          >
            State {sortKey === 'state' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </button>
        </div>
      </div>

      <div className="signal-cards">
        {ranked.map(({ holding, assessment, ready }, index) => (
          <button
            className={`signal-card ${ready ? '' : 'muted'}`}
            key={holding.symbol}
            onClick={() => onSelect(holding)}
          >
            <span className="signal-card-rank">{ready ? String(index + 1).padStart(2, '0') : '—'}</span>
            <div className="signal-card-main">
              <div>
                <span className="asset-logo">{holding.symbol[0]}</span>
                <span>
                  <strong>{holding.symbol}</strong>
                  {holding.name && holding.name !== holding.symbol && <small>{holding.name}</small>}
                </span>
              </div>
              <span className="signal-card-tags">
                <PortfolioFitTag holding={holding} holdings={holdings} />
                <RatingsConsensusChip symbol={holding.symbol} />
                {ready && <StatusPill state={assessment.state} />}
              </span>
            </div>
            {ready ? (
              <>
                <div className="signal-card-score">
                  <strong>{assessment.score}</strong>
                  <span>/ 100</span>
                </div>
                <div className="mini-components">
                  {assessment.components.map((component) => (
                    <div key={component.label}>
                      <span>{component.label}</span>
                      <i>
                        <b style={{ width: `${(component.score / component.max) * 100}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
                <p>{assessment.facts.slice(0, 2).join(' · ')}</p>
                <span className="review-link">
                  Review explanation <ArrowRight size={15} />
                </span>
              </>
            ) : (
              <>
                <div className="signal-card-nodata">
                  <Database size={15} /> Signals need market data
                </div>
                <p>Add RSI / MACD / SMA columns to score this holding.</p>
              </>
            )}
          </button>
        ))}
      </div>
    </>
  )
}
