import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { resolveCompanyName } from '../data/companyNames'
import {
  assessHoldingDiscipline,
  calculateDisciplineScorecard,
  type HoldingDiscipline,
  type StopLossStatus,
  type TakeProfitStatus,
} from '../domain/discipline'
import type { Holding, RecommendedAlert, UserAlert } from '../types'

interface DisciplinePageProps {
  holdings: Holding[]
  userAlerts: UserAlert[]
  recommendations: RecommendedAlert[]
  onSelectHolding: (holding: Holding) => void
  onArmAllStops: () => void
  onArmIndividualStop: (item: HoldingDiscipline) => void
  onArmIndividualTakeProfit: (item: HoldingDiscipline) => void
  onOpenOrderStaging: (symbol: string, currentPrice: number, triggerPrice?: number) => void
  onOpenDecision: (holding: Holding) => void
}

type FilterTab = 'ALL' | 'URGENT' | 'STOPS' | 'TARGETS' | 'UNPROTECTED'

export function DisciplinePage({
  holdings,
  userAlerts,
  recommendations,
  onSelectHolding,
  onArmAllStops,
  onArmIndividualStop,
  onArmIndividualTakeProfit,
  onOpenOrderStaging,
  onOpenDecision,
}: DisciplinePageProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Assess all active equity / crypto holdings
  const disciplineItems = useMemo(() => {
    return holdings
      .map((h) => assessHoldingDiscipline(h, userAlerts, recommendations))
      .filter((item): item is HoldingDiscipline => item !== null)
  }, [holdings, userAlerts, recommendations])

  // Portfolio-wide discipline metrics scorecard
  const scorecard = useMemo(() => {
    return calculateDisciplineScorecard(disciplineItems)
  }, [disciplineItems])

  // Items requiring immediate discipline execution (breached stops or hit targets)
  const urgentItems = useMemo(() => {
    return disciplineItems.filter((i) => i.hasActionRequired)
  }, [disciplineItems])

  // Filter items based on active tab and search
  const filteredItems = useMemo(() => {
    let result = disciplineItems

    if (filterTab === 'URGENT') {
      result = result.filter((i) => i.hasActionRequired)
    } else if (filterTab === 'STOPS') {
      result = result.filter((i) => i.stopStatus === 'BREACHED' || i.stopStatus === 'CRITICAL_ZONE' || i.isStopArmed)
    } else if (filterTab === 'TARGETS') {
      result = result.filter((i) => i.takeProfitStatus === 'TARGET_REACHED' || i.takeProfitStatus === 'NEAR_TARGET' || i.isTakeProfitArmed)
    } else if (filterTab === 'UNPROTECTED') {
      result = result.filter((i) => !i.isStopArmed)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (i) =>
          i.holding.symbol.toLowerCase().includes(q) ||
          (i.holding.name && i.holding.name.toLowerCase().includes(q))
      )
    }

    // Sort priority: urgent actions first, then lowest cushion to stop
    return result.sort((a, b) => {
      if (a.hasActionRequired && !b.hasActionRequired) return -1
      if (!a.hasActionRequired && b.hasActionRequired) return 1
      return a.stopDistancePct - b.stopDistancePct
    })
  }, [disciplineItems, filterTab, searchQuery])

  return (
    <div className="discipline-cockpit" style={{ display: 'grid', gap: '16px' }}>
      {/* 1. Header & Quick Controls */}
      <div className="page-title-row" style={{ alignItems: 'center' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={13} color="var(--accent-dark)" />
            EXECUTION DISCIPLINE & CAPITAL DEFENSE
          </span>
          <h1>Discipline Cockpit</h1>
          <p>
            Strict downside defense & profit-taking objectives. Zero noise, 100% execution discipline.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {scorecard.unprotectedPositions > 0 && (
            <button
              onClick={onArmAllStops}
              className="scenario-button"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                padding: '9px 15px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontWeight: 650,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(5, 150, 105, 0.25)',
                border: 'none',
              }}
              title="Automatically arm 6% protective stop-losses on all unprotected positions"
            >
              <ShieldCheck size={16} />
              Arm All Protective Stops ({scorecard.unprotectedPositions})
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Discipline KPIs Scorecard */}
      <div className="kpi-grid">
        <article className={`kpi-card ${scorecard.defenseCoveragePct === 100 ? 'good' : 'warning'}`}>
          <div className="kpi-top">
            <span>DEFENSE COVERAGE</span>
            <ShieldCheck size={16} />
          </div>
          <strong>{scorecard.defenseCoveragePct}%</strong>
          <small>
            {scorecard.protectedPositions} / {scorecard.totalPositions} positions armed with stops
          </small>
        </article>

        <article className="kpi-card">
          <div className="kpi-top">
            <span>MAX CAPITAL AT RISK</span>
            <ShieldAlert size={16} />
          </div>
          <strong style={{ color: scorecard.totalCapitalAtRisk > 0 ? 'var(--amber)' : 'inherit' }}>
            ${scorecard.totalCapitalAtRisk.toLocaleString()}
          </strong>
          <small>Total loss if all stops trigger</small>
        </article>

        <article className="kpi-card">
          <div className="kpi-top">
            <span>UNREALIZED P&L</span>
            <TrendingUp size={16} />
          </div>
          <strong style={{ color: scorecard.totalUnrealizedPnL >= 0 ? 'var(--accent-dark)' : 'var(--red)' }}>
            {scorecard.totalUnrealizedPnL >= 0 ? '+' : ''}${scorecard.totalUnrealizedPnL.toLocaleString()}
          </strong>
          <small>Open positions value vs cost</small>
        </article>

        <article className={`kpi-card ${scorecard.breachedStopsCount > 0 ? 'warning' : ''}`}>
          <div className="kpi-top">
            <span>STOP DEFENSE</span>
            <AlertTriangle size={16} />
          </div>
          <strong style={{ color: scorecard.breachedStopsCount > 0 ? 'var(--red)' : 'var(--ink)' }}>
            {scorecard.breachedStopsCount > 0 ? `${scorecard.breachedStopsCount} Breached` : '0 Breaches'}
          </strong>
          <small>
            {scorecard.criticalZoneCount} position{scorecard.criticalZoneCount !== 1 ? 's' : ''} in critical zone (&le;2%)
          </small>
        </article>

        <article className={`kpi-card ${scorecard.urgentActionsCount > 0 ? 'warning' : 'good'}`}>
          <div className="kpi-top">
            <span>URGENT DIRECTIVES</span>
            <Zap size={16} />
          </div>
          <strong style={{ color: scorecard.urgentActionsCount > 0 ? 'var(--red)' : 'var(--accent-dark)' }}>
            {scorecard.urgentActionsCount}
          </strong>
          <small>
            {scorecard.targetsReachedCount} profit target{scorecard.targetsReachedCount !== 1 ? 's' : ''} reached
          </small>
        </article>
      </div>

      {/* 3. Pinned Urgent Action Queue (if any stops breached or targets reached) */}
      {urgentItems.length > 0 && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--red)',
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)', fontWeight: 750, fontSize: '13px' }}>
              <AlertTriangle size={17} />
              <span>IMMEDIATE DISCIPLINE ACTIONS REQUIRED ({urgentItems.length})</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Market price breached threshold — execute or trim according to plan
            </span>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {urgentItems.map((item) => (
              <div
                key={`urgent-${item.holding.symbol}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--subtle)',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${item.stopStatus === 'BREACHED' ? 'var(--red)' : item.takeProfitStatus === 'TARGET_REACHED' ? 'var(--accent)' : 'var(--amber)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '13px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'var(--panel)',
                      color: 'var(--ink)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    {item.holding.symbol}
                  </span>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>
                      {item.actionDirective}
                    </strong>
                    <small style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Cost: ${item.costBasis.toFixed(2)} · Price: ${item.currentPrice.toFixed(2)} · P&L: {item.unrealizedPnLPct >= 0 ? '+' : ''}{item.unrealizedPnLPct.toFixed(1)}% (${item.unrealizedPnL.toFixed(0)})
                    </small>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => onOpenDecision(item.holding)}
                    className="secondary-button"
                    style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px' }}
                  >
                    Playbook
                  </button>
                  <button
                    onClick={() => onOpenOrderStaging(item.holding.symbol, item.currentPrice, item.stopLossPrice)}
                    style={{
                      background: item.stopStatus === 'BREACHED' ? 'var(--red)' : 'var(--accent-dark)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Zap size={13} />
                    {item.stopStatus === 'BREACHED' ? 'Exit Position' : 'Harvest / Trim'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Filter Chips & Table Toolbar */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
          {/* Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setFilterTab('ALL')}
              className={`status-pill ${filterTab === 'ALL' ? 'armed' : ''}`}
              style={{ cursor: 'pointer', border: '1px solid var(--line)', background: filterTab === 'ALL' ? 'var(--ink)' : 'transparent', color: filterTab === 'ALL' ? 'white' : 'var(--muted)' }}
            >
              All Positions ({disciplineItems.length})
            </button>
            <button
              onClick={() => setFilterTab('URGENT')}
              className={`status-pill ${filterTab === 'URGENT' ? 'triggered' : ''}`}
              style={{ cursor: 'pointer', border: '1px solid var(--line)', background: filterTab === 'URGENT' ? 'var(--red)' : 'transparent', color: filterTab === 'URGENT' ? 'white' : 'var(--muted)' }}
            >
              🚨 Action Required ({scorecard.urgentActionsCount})
            </button>
            <button
              onClick={() => setFilterTab('STOPS')}
              className={`status-pill ${filterTab === 'STOPS' ? 'armed' : ''}`}
              style={{ cursor: 'pointer', border: '1px solid var(--line)', background: filterTab === 'STOPS' ? 'var(--ink)' : 'transparent', color: filterTab === 'STOPS' ? 'white' : 'var(--muted)' }}
            >
              🛡️ Stop-Loss Defense ({scorecard.protectedPositions})
            </button>
            <button
              onClick={() => setFilterTab('TARGETS')}
              className={`status-pill ${filterTab === 'TARGETS' ? 'armed' : ''}`}
              style={{ cursor: 'pointer', border: '1px solid var(--line)', background: filterTab === 'TARGETS' ? 'var(--ink)' : 'transparent', color: filterTab === 'TARGETS' ? 'white' : 'var(--muted)' }}
            >
              🎯 Take-Profits
            </button>
            <button
              onClick={() => setFilterTab('UNPROTECTED')}
              className={`status-pill ${filterTab === 'UNPROTECTED' ? 'approaching' : ''}`}
              style={{ cursor: 'pointer', border: '1px solid var(--line)', background: filterTab === 'UNPROTECTED' ? 'var(--amber)' : 'transparent', color: filterTab === 'UNPROTECTED' ? 'white' : 'var(--muted)' }}
            >
              ⚠️ Unprotected ({scorecard.unprotectedPositions})
            </button>
          </div>

          {/* Search Box */}
          <div className="search-box" style={{ width: '220px' }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Filter by symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 5. Discipline Execution Table */}
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(130px, 1fr) minmax(220px, 1.6fr) minmax(200px, 1.5fr) 130px',
              gap: '12px',
              padding: '10px 16px',
              background: 'var(--subtle)',
              borderBottom: '1px solid var(--line)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span>Asset</span>
            <span>Cost & Market</span>
            <span>Downside Defense (Stop-Loss)</span>
            <span>Upside Harvesting (Take-Profit)</span>
            <span style={{ textAlign: 'right' }}>Action</span>
          </div>

          {filteredItems.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No positions matching selected criteria.
            </div>
          ) : (
            filteredItems.map((item) => {
              const stopColor =
                item.stopStatus === 'BREACHED'
                  ? 'var(--red)'
                  : item.stopStatus === 'CRITICAL_ZONE'
                    ? 'var(--amber)'
                    : item.isStopArmed
                      ? 'var(--accent-dark)'
                      : 'var(--muted)'

              const targetColor =
                item.takeProfitStatus === 'TARGET_REACHED'
                  ? 'var(--accent-dark)'
                  : item.takeProfitStatus === 'NEAR_TARGET'
                    ? 'var(--accent)'
                    : item.isTakeProfitArmed
                      ? 'var(--accent-dark)'
                      : 'var(--muted)'

              return (
                <div
                  key={item.holding.symbol}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(130px, 1fr) minmax(220px, 1.6fr) minmax(200px, 1.5fr) 130px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderTop: '1px solid var(--line)',
                    background: item.hasActionRequired ? 'rgba(239, 68, 68, 0.03)' : 'var(--panel)',
                    fontSize: '12px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Asset */}
                  <div
                    onClick={() => onSelectHolding(item.holding)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <div className="asset-logo" style={{ width: '32px', height: '32px' }}>
                      {item.holding.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{item.holding.symbol}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                          {item.holding.quantity} shs
                        </span>
                      </div>
                      <small style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '140px' }}>
                        {item.holding.name || resolveCompanyName(item.holding.symbol)}
                      </small>
                    </div>
                  </div>

                  {/* Cost & Market */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>
                        ${item.currentPrice.toFixed(2)}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 650,
                          color: item.unrealizedPnLPct >= 0 ? 'var(--accent-dark)' : 'var(--red)',
                        }}
                      >
                        {item.unrealizedPnLPct >= 0 ? '+' : ''}{item.unrealizedPnLPct.toFixed(1)}%
                      </span>
                    </div>
                    <small style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                      Basis: ${item.costBasis.toFixed(2)} (${item.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </small>
                  </div>

                  {/* Downside Defense (Stop-Loss) */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: stopColor }}>
                        ${item.stopLossPrice.toFixed(2)}
                      </strong>

                      {item.isStopArmed ? (
                        <span className="status-pill armed" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          🛡️ Armed
                        </span>
                      ) : (
                        <button
                          onClick={() => onArmIndividualStop(item)}
                          className="text-button"
                          style={{
                            fontSize: '10px',
                            color: 'var(--accent-dark)',
                            fontWeight: 700,
                            padding: '2px 6px',
                            background: 'var(--accent-soft)',
                            borderRadius: '4px',
                          }}
                          title="Arm this protective 6% stop alert"
                        >
                          + Arm Stop
                        </button>
                      )}

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: item.stopDistancePct <= 2 ? 'var(--red)' : 'var(--muted)',
                          marginLeft: 'auto',
                        }}
                      >
                        {item.stopDistancePct > 0 ? `${item.stopDistancePct.toFixed(1)}% cushion` : 'BREACHED'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <div
                        style={{
                          flex: 1,
                          height: '4px',
                          background: 'var(--subtle)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, item.stopDistancePct * 10))}%`,
                            height: '100%',
                            background: item.stopDistancePct <= 2 ? 'var(--red)' : item.stopDistancePct <= 4 ? 'var(--amber)' : 'var(--accent)',
                          }}
                        />
                      </div>
                      <small style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        Risk: ${item.capitalAtRisk.toFixed(0)}
                      </small>
                    </div>
                  </div>

                  {/* Upside Harvesting (Take-Profit) */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: targetColor }}>
                        ${item.takeProfitPrice.toFixed(2)}
                      </strong>

                      {item.isTakeProfitArmed ? (
                        <span className="status-pill armed" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          🎯 Armed
                        </span>
                      ) : (
                        <button
                          onClick={() => onArmIndividualTakeProfit(item)}
                          className="text-button"
                          style={{
                            fontSize: '10px',
                            color: 'var(--accent-dark)',
                            fontWeight: 700,
                            padding: '2px 6px',
                            background: 'var(--accent-soft)',
                            borderRadius: '4px',
                          }}
                          title="Arm take profit target alert"
                        >
                          + Arm Target
                        </button>
                      )}

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: item.targetDistancePct <= 0 ? 'var(--accent-dark)' : 'var(--muted)',
                          marginLeft: 'auto',
                        }}
                      >
                        {item.targetDistancePct <= 0 ? 'REACHED' : `+${item.targetDistancePct.toFixed(1)}%`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <div
                        style={{
                          flex: 1,
                          height: '4px',
                          background: 'var(--subtle)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, (1 - item.targetDistancePct / 15) * 100))}%`,
                            height: '100%',
                            background: item.targetDistancePct <= 0 ? 'var(--accent-dark)' : 'var(--accent)',
                          }}
                        />
                      </div>
                      <small style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        Gain: +${item.targetProfitPotential.toFixed(0)}
                      </small>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      onClick={() => onOpenOrderStaging(item.holding.symbol, item.currentPrice, item.stopLossPrice)}
                      className="secondary-button"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Stage market or limit order with brackets"
                    >
                      <Zap size={12} color="var(--accent-dark)" />
                      Stage
                    </button>

                    <button
                      onClick={() => onOpenDecision(item.holding)}
                      className="icon-button"
                      style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                      title="View full decision playbook"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
