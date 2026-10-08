import React, { useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Database,
  Edit3,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { CandleChart, type ChartTrigger } from './CandleChart'
import { ModalOverlay } from './ModalOverlay'
import { OrderStagingModal } from './OrderStagingModal'
import { PortfolioFitPanel } from './PortfolioFit'
import { RatingsGauge } from './RatingsGauge'
import { ChangeRecommendationModal } from './RecommendedTriggers'
import { StockPerformance } from './StockPerformance'
import { generateTickerRecommendations } from '../domain/alertRecommendations'
import { assessHolding } from '../domain/engine'
import { getPriceTargets } from '../domain/ratings'
import type { Holding, RecommendedAlert, ScoreComponent, UserAlert } from '../types'

interface AssetDrawerProps {
  holding: Holding
  holdings: Holding[]
  recommendations?: RecommendedAlert[]
  userAlerts?: UserAlert[]
  onAcknowledgeRecommendation?: (rec: RecommendedAlert) => void
  onDeclineRecommendation?: (rec: RecommendedAlert) => void
  onChangeRecommendation?: (rec: RecommendedAlert, customized: UserAlert) => void
  onClose: () => void
  onOpenDecision?: () => void
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
      {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

function ComponentBar({ component }: { component: ScoreComponent }) {
  return (
    <div className="component-bar">
      <div>
        <span>{component.label}</span>
        <strong>
          {component.score}
          <small>/{component.max}</small>
        </strong>
      </div>
      <div className="bar-track">
        <span style={{ width: `${(component.score / component.max) * 100}%` }} />
      </div>
    </div>
  )
}

export function AssetDrawer({
  holding,
  holdings,
  recommendations = [],
  userAlerts = [],
  onAcknowledgeRecommendation,
  onDeclineRecommendation,
  onChangeRecommendation,
  onClose,
  onOpenDecision,
}: AssetDrawerProps) {
  const [customizingRec, setCustomizingRec] = useState<RecommendedAlert | null>(null)
  const [stagingOpen, setStagingOpen] = useState(false)
  const assessment = assessHolding(holding)
  const ready = holding.hasSignalInputs !== false
  const targets = getPriceTargets(holding.symbol, holding.price)

  const saDiff = targets.saWallStreet ? targets.saWallStreet - holding.price : 0
  const saDiffPct = holding.price > 0 ? (saDiff / holding.price) * 100 : 0
  const zacksDiff = targets.zacks ? targets.zacks - holding.price : 0
  const zacksDiffPct = holding.price > 0 ? (zacksDiff / holding.price) * 100 : 0

  const portfolioTotalValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.quantity * h.price, 0) || 100000
  }, [holdings])

  const assetRecs = useMemo(() => {
    const list = recommendations.filter((r) => r.symbol.toUpperCase() === holding.symbol.toUpperCase())
    if (list.length > 0) return list
    return generateTickerRecommendations(
      holding.symbol,
      holding.name,
      holding.price,
      holding.avgCost,
      holding.rsi,
      holding.aboveSma50,
      holding.aboveSma200,
      holding.relativeVolume,
      targets.saWallStreet || targets.zacks,
      true
    )
  }, [recommendations, holding, targets])

  const chartTriggers = useMemo<ChartTrigger[]>(() => {
    const triggers: ChartTrigger[] = []
    assetRecs.forEach((rec) => {
      if (rec.status !== 'DECLINED' && rec.targetValue && rec.targetValue > 0) {
        const type: 'stop_loss' | 'profit_target' | 'dip_buy' | 'custom' =
          rec.category === 'STOP_LOSS'
            ? 'stop_loss'
            : rec.category === 'PROFIT_TARGET'
              ? 'profit_target'
              : rec.category === 'DIP_BUY'
                ? 'dip_buy'
                : 'custom'
        triggers.push({
          id: rec.id,
          type,
          price: rec.targetValue,
          label: rec.category.replace('_', ' '),
          actionDirective:
            rec.actionPlaybook?.directive || rec.actionPlaybook?.checklist?.[0] || rec.rationale,
        })
      }
    })
    userAlerts.forEach((ua) => {
      if (
        ua.symbol.toUpperCase() === holding.symbol.toUpperCase() &&
        ua.status === 'ARMED' &&
        ua.metric === 'PRICE' &&
        ua.targetValue > 0
      ) {
        const isStop = ua.condition === 'BELOW'
        const isTarget = ua.condition === 'ABOVE'
        triggers.push({
          id: ua.id,
          type: isStop ? 'stop_loss' : isTarget ? 'profit_target' : 'custom',
          price: ua.targetValue,
          label: `Alert ${ua.condition}`,
          actionDirective:
            ua.playbookDirective ||
            `Action required when price moves ${(ua.condition || '').toLowerCase()} $${(Number(ua.targetValue) || 0).toFixed(2)}`,
        })
      }
    })
    return triggers
  }, [assetRecs, userAlerts, holding.symbol])

  return (
    <ModalOverlay className="asset-drawer" label={`${holding.symbol} signal explanation`} onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close drawer">
        <X size={19} />
      </button>

      <div className="drawer-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="asset-logo large">{holding.symbol[0]}</span>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
              {holding.name && holding.name !== holding.symbol ? holding.name : 'HOLDING'}
            </p>
            <h2 style={{ margin: 0 }}>{holding.symbol}</h2>
          </div>
        </div>

        {holding.symbol !== 'CASH' && (
          <button
            type="button"
            className="banner-primary"
            onClick={() => setStagingOpen(true)}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Zap size={13} />
            <span>Stage Order</span>
          </button>
        )}
      </div>

      <div className="drawer-quote">
        <div>
          <span>Current price</span>
          <strong>{formatCurrency(holding.price)}</strong>
        </div>
        <Delta value={holding.dayChange} />
      </div>

      {ready ? (
        <>
          <section className="signal-verdict">
            <div className="score-ring">
              <strong>{assessment.score}</strong>
              <span>/100</span>
            </div>
            <div>
              <StatusPill state={assessment.state} />
              <h3>
                {assessment.state === 'ENTRY' || assessment.state === 'STRONG ENTRY'
                  ? 'Conditions align'
                  : 'Setup is developing'}
              </h3>
              <p>Deterministic model · default_swing_v1</p>
              {onOpenDecision && (
                <button
                  className="ask-button"
                  onClick={onOpenDecision}
                  style={{ marginTop: '8px', padding: '6px 10px', fontSize: '10px' }}
                >
                  <Target size={13} /> View Decision Directive
                </button>
              )}
            </div>
          </section>
          <section className="drawer-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SCORE BREAKDOWN</span>
                <h3>Why it ranked here</h3>
              </div>
            </div>
            {assessment.components.map((component) => (
              <ComponentBar key={component.label} component={component} />
            ))}
          </section>
          <section className="drawer-section">
            <span className="eyebrow">OBSERVED FACTS</span>
            <ul className="fact-list">
              {assessment.facts.map((fact) => (
                <li key={fact}>
                  <ShieldCheck size={16} />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="drawer-section signal-nodata">
          <Database size={17} />
          <div>
            <strong>Signals need market data</strong>
            <span>
              This uploaded holding has no technical columns (RSI / MACD / SMA). Value, weight, concentration and
              portfolio fit below are still exact.
            </span>
          </div>
        </section>
      )}

      {/* Wall Street & Zacks Price Targets Card */}
      {holding.symbol !== 'CASH' && (
        <section className="target-card">
          <div className="target-card-heading">
            <span className="eyebrow">ANALYST TARGETS &amp; SPREAD</span>
            <Target size={16} color="var(--accent-dark)" />
          </div>
          <div className="target-grid">
            <div className="target-box">
              <span>SA Wall St Consensus Target</span>
              <strong>{targets.saWallStreet != null ? formatCurrency(targets.saWallStreet) : '—'}</strong>
              {targets.saWallStreet != null ? (
                <small className={saDiff >= 0 ? 'upside-positive' : 'upside-negative'}>
                  {saDiff >= 0 ? '+' : ''}
                  {formatCurrency(saDiff)} ({saDiffPct >= 0 ? '+' : ''}
                  {saDiffPct.toFixed(1)}%)
                </small>
              ) : (
                <small style={{ color: 'var(--muted)' }}>No SA consensus target</small>
              )}
              {targets.saHigh != null && targets.saLow != null && (
                <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>
                  Range: ${targets.saLow} - ${targets.saHigh}
                </div>
              )}
            </div>
            <div className="target-box">
              <span>Zacks Target Price</span>
              <strong>{targets.zacks != null ? formatCurrency(targets.zacks) : '—'}</strong>
              {targets.zacks != null ? (
                <small className={zacksDiff >= 0 ? 'upside-positive' : 'upside-negative'}>
                  {zacksDiff >= 0 ? '+' : ''}
                  {formatCurrency(zacksDiff)} ({zacksDiffPct >= 0 ? '+' : ''}
                  {zacksDiffPct.toFixed(1)}%)
                </small>
              ) : (
                <small style={{ color: 'var(--muted)' }}>No Zacks target</small>
              )}
              <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>
                Quant Revision Signal
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recommended Alerts & Triggers Card */}
      {holding.symbol !== 'CASH' && assetRecs.length > 0 && (
        <section className="target-card" style={{ marginTop: '14px' }}>
          <div className="target-card-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--accent)" />
              <span className="eyebrow" style={{ margin: 0, color: 'var(--accent)' }}>
                RECOMMENDED ALERTS &amp; TRIGGERS
              </span>
            </div>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
              {assetRecs.filter((r) => r.status === 'PENDING').length} actionable
            </small>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {assetRecs.map((rec) => {
              const isAck = rec.status === 'ACKNOWLEDGED'
              const isDec = rec.status === 'DECLINED'
              const isPending = rec.status === 'PENDING'
              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isAck
                      ? 'rgba(16, 185, 129, 0.08)'
                      : isDec
                        ? 'rgba(156, 163, 175, 0.08)'
                        : 'var(--surface-hover)',
                    border: `1px solid ${isAck ? 'rgba(16, 185, 129, 0.3)' : isDec ? 'rgba(156, 163, 175, 0.2)' : 'var(--border)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    opacity: isDec ? 0.65 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                        }}
                      >
                        {rec.category.replace('_', ' ')}
                      </span>
                      <strong style={{ fontSize: '12px' }}>{rec.title}</strong>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {rec.metric === 'PRICE'
                        ? `$${(Number(rec.targetValue ?? (rec as any).target_value) || 0).toFixed(2)}`
                        : `${rec.metric} ${rec.condition} ${rec.targetValue ?? (rec as any).target_value ?? ''}`}
                      {rec.potentialDeltaPct != null && (
                        <span
                          style={{
                            marginLeft: '6px',
                            color: rec.potentialDeltaPct >= 0 ? 'var(--green)' : 'var(--red)',
                            fontSize: '11px',
                          }}
                        >
                          ({rec.potentialDeltaPct >= 0 ? '+' : ''}
                          {rec.potentialDeltaPct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>
                    {rec.rationale}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {isPending && (
                      <>
                        <button
                          type="button"
                          className="primary-button"
                          title="Acknowledge and arm this trigger immediately"
                          style={{
                            flex: '1 1 auto',
                            minWidth: '105px',
                            whiteSpace: 'nowrap',
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            background: 'var(--green, #10b981)',
                            borderColor: 'var(--green, #10b981)',
                            color: '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => onAcknowledgeRecommendation?.(rec)}
                        >
                          <Check size={13} />
                          <span>Arm Trigger</span>
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          title="Customize trigger thresholds"
                          style={{
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            width: 'auto',
                            padding: '6px 10px',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setCustomizingRec(rec)}
                        >
                          <Edit3 size={11} />
                          <span>Change</span>
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Decline this recommendation"
                          style={{
                            flexShrink: 0,
                            padding: '6px 9px',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border)',
                            color: 'var(--muted)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => onDeclineRecommendation?.(rec)}
                        >
                          <X size={13} />
                        </button>
                      </>
                    )}
                    {isAck && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--green)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} /> Trigger Armed &amp; Active
                        </span>
                        <button
                          type="button"
                          className="secondary-button"
                          title="Modify trigger parameters"
                          style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                          onClick={() => setCustomizingRec(rec)}
                        >
                          <Edit3 size={10} /> Edit
                        </button>
                      </div>
                    )}
                    {isDec && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Declined</span>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => onAcknowledgeRecommendation?.(rec)}
                        >
                          Restore
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Interactive Candlestick & Technical Indicator Chart */}
      {holding.symbol !== 'CASH' && <CandleChart symbol={holding.symbol} triggers={chartTriggers} />}

      {/* Stock Time-Related Performance Analysis */}
      {holding.symbol !== 'CASH' && <StockPerformance holding={holding} />}

      <PortfolioFitPanel holding={holding} holdings={holdings} />
      <RatingsGauge symbol={holding.symbol} />
      <section className="provenance">
        <Database size={17} />
        <div>
          <strong>Source is current</strong>
          <span>Live operational quote · technical calculations local</span>
        </div>
      </section>

      {/* Trigger Customizer Modal */}
      {customizingRec && (
        <ChangeRecommendationModal
          recommendation={customizingRec}
          onClose={() => setCustomizingRec(null)}
          onSave={(customizedAlert) => {
            onChangeRecommendation?.(customizingRec, customizedAlert)
            setCustomizingRec(null)
          }}
        />
      )}

      {/* 1-Click Order Staging Modal */}
      {stagingOpen && (
        <OrderStagingModal
          symbol={holding.symbol}
          name={holding.name}
          currentPrice={holding.price}
          portfolioValue={portfolioTotalValue}
          onClose={() => setStagingOpen(false)}
        />
      )}
    </ModalOverlay>
  )
}
