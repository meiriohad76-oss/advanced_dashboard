import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Edit3,
  Flame,
  Info,
  Layers,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { ModalOverlay } from './ModalOverlay'
import type { RecommendationCategory, RecommendationStatus, RecommendedAlert, UserAlert } from '../types'

interface RecommendedTriggersProps {
  recommendations: RecommendedAlert[]
  onAcknowledge: (rec: RecommendedAlert) => void
  onDecline: (rec: RecommendedAlert) => void
  onChange: (rec: RecommendedAlert, customized: UserAlert) => void
  onRestore?: (rec: RecommendedAlert) => void
}

type TabFilter = 'pending' | 'PROFIT_TARGET' | 'DIP_BUY' | 'STOP_LOSS' | 'BREAKOUT' | 'history'

export function RecommendedTriggersView({
  recommendations,
  onAcknowledge,
  onDecline,
  onChange,
  onRestore,
}: RecommendedTriggersProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL')
  const [editingRec, setEditingRec] = useState<RecommendedAlert | null>(null)

  // Counts
  const pendingCount = recommendations.filter((r) => r.status === 'PENDING').length
  const ackCount = recommendations.filter((r) => r.status === 'ACKNOWLEDGED').length
  const decCount = recommendations.filter((r) => r.status === 'DECLINED').length

  // Distinct symbols
  const allSymbols = useMemo(() => {
    const set = new Set<string>()
    recommendations.forEach((r) => set.add(r.symbol))
    return Array.from(set).sort()
  }, [recommendations])

  // Filtered items
  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      // Tab filter
      if (activeTab === 'pending' && r.status !== 'PENDING') return false
      if (activeTab === 'history' && r.status === 'PENDING') return false
      if (activeTab !== 'pending' && activeTab !== 'history') {
        if (r.category !== activeTab || r.status !== 'PENDING') return false
      }

      // Symbol filter
      if (selectedSymbol !== 'ALL' && r.symbol !== selectedSymbol) return false

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSym = r.symbol.toLowerCase().includes(q)
        const matchesTitle = r.title.toLowerCase().includes(q)
        const matchesRat = r.rationale.toLowerCase().includes(q)
        if (!matchesSym && !matchesTitle && !matchesRat) return false
      }

      return true
    })
  }, [recommendations, activeTab, selectedSymbol, searchQuery])

  const getCategoryMeta = (cat: RecommendationCategory) => {
    switch (cat) {
      case 'PROFIT_TARGET':
        return {
          label: 'Profit Target',
          icon: Crosshair,
          color: 'var(--accent-dark)',
          bg: 'var(--accent-soft)',
          border: 'var(--accent-line)',
        }
      case 'DIP_BUY':
        return {
          label: 'Dip Buy Entry',
          icon: TrendingDown,
          color: 'var(--emerald)',
          bg: 'var(--emerald-soft)',
          border: 'var(--emerald-line)',
        }
      case 'STOP_LOSS':
        return {
          label: 'Stop-Loss Defense',
          icon: Shield,
          color: 'var(--red)',
          bg: 'var(--red-soft)',
          border: 'var(--red-line)',
        }
      case 'BREAKOUT':
        return {
          label: 'Breakout Momentum',
          icon: Zap,
          color: 'var(--amber)',
          bg: 'var(--amber-soft)',
          border: 'var(--amber-line)',
        }
      case 'RSI_REVERSAL':
        return {
          label: 'RSI Reversal Warning',
          icon: AlertTriangle,
          color: 'var(--amber)',
          bg: 'var(--amber-soft)',
          border: 'var(--amber-line)',
        }
    }
  }

  return (
    <div className="recommended-triggers-section" style={{ marginBottom: '24px' }}>
      {/* Header & KPI Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent-dark)' }}>
            <Sparkles size={18} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
              Recommended Alerts &amp; Triggers
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
              Institutional rules generated for your active portfolio holdings &amp; watchlist candidates.
            </p>
          </div>
        </div>

        {/* Quick KPI badges */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'var(--amber-soft)', color: 'var(--amber)', border: '1px solid var(--amber-line)', fontWeight: 600 }}>
            {pendingCount} Pending Review
          </span>
          <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'var(--emerald-soft)', color: 'var(--emerald)', border: '1px solid var(--emerald-line)', fontWeight: 600 }}>
            {ackCount} Acknowledged &amp; Armed
          </span>
          {decCount > 0 && (
            <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--line)', fontWeight: 600 }}>
              {decCount} Declined
            </span>
          )}
        </div>
      </div>

      {/* Tabs & Search Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>
            Pending Review ({pendingCount})
          </button>
          <button className={activeTab === 'PROFIT_TARGET' ? 'active' : ''} onClick={() => setActiveTab('PROFIT_TARGET')}>
            🎯 Profit Targets
          </button>
          <button className={activeTab === 'DIP_BUY' ? 'active' : ''} onClick={() => setActiveTab('DIP_BUY')}>
            📉 Dip Buys
          </button>
          <button className={activeTab === 'STOP_LOSS' ? 'active' : ''} onClick={() => setActiveTab('STOP_LOSS')}>
            🛡️ Stop Loss
          </button>
          <button className={activeTab === 'BREAKOUT' ? 'active' : ''} onClick={() => setActiveTab('BREAKOUT')}>
            ⚡ Breakouts
          </button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
            History ({ackCount + decCount})
          </button>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {allSymbols.length > 1 && (
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Tickers ({allSymbols.length})</option>
              {allSymbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search recommendation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                fontSize: '11px',
                padding: '6px 8px 6px 26px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                width: '160px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Recommendations Card List */}
      {filteredRecs.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--panel)', borderRadius: '8px', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
          <Sparkles size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)' }}>
            {activeTab === 'pending'
              ? 'All recommendations acknowledged or declined!'
              : 'No recommendations found for this filter.'}
          </p>
          <small>
            {activeTab === 'pending'
              ? 'Your active portfolio and watchlist are fully guarded with configured triggers.'
              : 'Try changing your tab or ticker search filter above.'}
          </small>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '12px' }}>
          {filteredRecs.map((rec) => {
            const meta = getCategoryMeta(rec.category)
            const IconComponent = meta.icon
            const isPending = rec.status === 'PENDING'
            const isAck = rec.status === 'ACKNOWLEDGED'
            const isDec = rec.status === 'DECLINED'

            const isPriceMetric = rec.metric === 'PRICE'
            const isRsiMetric = rec.metric === 'RSI'

            return (
              <div
                key={rec.id}
                style={{
                  background: 'var(--panel)',
                  borderRadius: '10px',
                  border: isAck ? '1px solid var(--emerald-line)' : isDec ? '1px solid var(--line)' : '1px solid var(--accent-line)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  position: 'relative',
                  opacity: isDec ? 0.65 : 1,
                }}
              >
                <div>
                  {/* Top Bar: Ticker & Category Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: 'var(--ink)',
                          background: 'var(--subtle)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--line)',
                        }}
                      >
                        {rec.symbol}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                        {rec.name}
                      </span>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      <IconComponent size={11} />
                      {meta.label}
                    </span>
                  </div>

                  {/* Title & Trigger Condition Pill */}
                  <div style={{ marginBottom: '8px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                      {rec.title}
                    </h4>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'var(--subtle)',
                        color: 'var(--ink)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <span>
                        {rec.metric} {rec.condition === 'ABOVE' || rec.condition === 'CROSS_ABOVE' ? '>' : '<'}{' '}
                        {isPriceMetric ? `$${(rec.targetValue ?? rec.target_value ?? 0).toFixed(2)}` : (rec.targetValue ?? rec.target_value ?? 0)}
                      </span>
                      {(rec.potentialDeltaPct ?? rec.potential_delta_pct) !== null && (rec.potentialDeltaPct ?? rec.potential_delta_pct) !== undefined && (
                        <span style={{ color: (rec.potentialDeltaPct ?? rec.potential_delta_pct ?? 0) >= 0 ? 'var(--emerald)' : 'var(--red)' }}>
                          ({(rec.potentialDeltaPct ?? rec.potential_delta_pct ?? 0) >= 0 ? '+' : ''}{rec.potentialDeltaPct ?? rec.potential_delta_pct}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quant Rationale */}
                  <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.45 }}>
                    {rec.rationale}
                  </p>

                  {/* Current Value comparison */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--muted)', padding: '6px 8px', background: 'var(--subtle)', borderRadius: '5px', marginBottom: '12px' }}>
                    <span>Current: <strong>{isPriceMetric ? `$${(rec.currentValue ?? rec.current_value ?? 0).toFixed(2)}` : isRsiMetric ? `RSI ${(rec.currentValue ?? rec.current_value ?? 0).toFixed(1)}` : (rec.currentValue ?? rec.current_value ?? 0)}</strong></span>
                    <span>Target: <strong>{isPriceMetric ? `$${(rec.targetValue ?? rec.target_value ?? 0).toFixed(2)}` : (rec.targetValue ?? rec.target_value ?? 0)}</strong></span>
                  </div>
                </div>

                {/* User Action Footer: Acknowledge / Decline / Change */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                  {isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {/* 1. Arm Trigger */}
                      <button
                        className="ask-button"
                        onClick={() => onAcknowledge(rec)}
                        style={{
                          flex: '1 1 auto',
                          minWidth: '100px',
                          whiteSpace: 'nowrap',
                          background: 'var(--emerald)',
                          borderColor: 'var(--emerald)',
                          color: '#ffffff',
                          fontSize: '11px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Acknowledge and arm this trigger immediately"
                      >
                        <Check size={13} />
                        <span>Arm Trigger</span>
                      </button>

                      {/* 2. Change / Customize */}
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditingRec(rec)}
                        style={{
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          width: 'auto',
                          border: '1px solid var(--line)',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: 'var(--accent-dark)',
                          background: 'var(--accent-soft)',
                          cursor: 'pointer',
                        }}
                        title="Change trigger parameters before arming"
                      >
                        <Edit3 size={12} />
                        <span>Change</span>
                      </button>

                      {/* 3. Decline */}
                      <button
                        className="icon-button"
                        onClick={() => onDecline(rec)}
                        style={{
                          flexShrink: 0,
                          border: '1px solid var(--line)',
                          borderRadius: '6px',
                          padding: '6px 9px',
                          color: 'var(--muted)',
                          background: 'var(--panel)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Decline this recommendation"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {isAck && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--emerald)', fontWeight: 600 }}>
                        <CheckCircle2 size={13} />
                        Acknowledged &amp; Armed
                      </span>
                      <small style={{ fontSize: '10px', color: 'var(--muted)' }}>Active in User Alerts</small>
                    </div>
                  )}

                  {isDec && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)' }}>
                        <X size={13} />
                        Declined
                      </span>
                      {onRestore && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onRestore(rec)}
                          style={{ fontSize: '10px', color: 'var(--accent-dark)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '4px 8px', width: 'auto' }}
                        >
                          <RotateCcw size={10} /> Restore
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Customization Modal */}
      {editingRec && (
        <ChangeRecommendationModal
          recommendation={editingRec}
          onClose={() => setEditingRec(null)}
          onSave={(customizedAlert) => {
            onChange(editingRec, customizedAlert)
            setEditingRec(null)
          }}
        />
      )}
    </div>
  )
}

export interface ChangeRecommendationModalProps {
  recommendation: RecommendedAlert
  onClose: () => void
  onSave: (customAlert: UserAlert) => void
}

export function ChangeRecommendationModal({ recommendation, onClose, onSave }: ChangeRecommendationModalProps) {
  const [metric, setMetric] = useState<UserAlert['metric']>(recommendation.metric)
  const [condition, setCondition] = useState<UserAlert['condition']>(recommendation.condition)
  const [targetValue, setTargetValue] = useState<number>(recommendation.targetValue ?? recommendation.target_value ?? 0)
  const [severity, setSeverity] = useState<UserAlert['severity']>(recommendation.severity)

  const isIndicator = metric === 'MACD' || metric.startsWith('SMA')

  const handleMetricChange = (newMetric: UserAlert['metric']) => {
    setMetric(newMetric)
    if (newMetric === 'PRICE') setTargetValue(recommendation.currentValue ?? recommendation.current_value ?? 100)
    else if (newMetric === 'RSI') setTargetValue(condition.includes('ABOVE') ? 70 : 35)
    else if (newMetric === 'VOLUME') setTargetValue(2.0)
    else if (newMetric === 'STOP_LOSS') setTargetValue(6.0)
    else setTargetValue(0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const customized: UserAlert = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      symbol: recommendation.symbol.toUpperCase(),
      metric,
      condition,
      targetValue: isIndicator ? 0 : Number(targetValue),
      severity,
      status: 'ARMED',
      createdAt: new Date().toISOString(),
      title: recommendation.title,
      category: recommendation.category,
      rationale: recommendation.rationale,
    }
    onSave(customized)
  }

  return (
    <ModalOverlay className="alert-drawer" label="Customize Recommended Alert" onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close customizer">
        <X size={19} />
      </button>

      <div className="ask-heading">
        <span>
          <Edit3 size={21} />
        </span>
        <div>
          <p>TRIGGER CUSTOMIZER</p>
          <h2>Customize &amp; Arm: {recommendation.symbol}</h2>
        </div>
      </div>

      <div style={{ padding: '10px 12px', background: 'var(--subtle)', borderRadius: '8px', fontSize: '11px', color: 'var(--muted)', marginTop: '12px', marginBottom: '16px' }}>
        <strong>Original Thesis:</strong> {recommendation.rationale}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
              Metric / Trigger Type
            </label>
            <select
              value={metric}
              onChange={(e) => handleMetricChange(e.target.value as UserAlert['metric'])}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
            >
              <option value="PRICE">Price Target ($)</option>
              <option value="SMA50">50-Day SMA Crossing</option>
              <option value="RSI">RSI Threshold (14d)</option>
              <option value="VOLUME">Unusual Volume (&gt;2x)</option>
              <option value="STOP_LOSS">Trailing Stop Loss (%)</option>
              <option value="MACD">MACD Crossing Signal</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
              Trigger Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as UserAlert['condition'])}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
            >
              <option value="ABOVE">{isIndicator ? 'Bullish / Crosses Above' : 'Rises Above (>)'}</option>
              <option value="BELOW">{isIndicator ? 'Bearish / Crosses Below' : 'Falls Below (<)'}</option>
              {!isIndicator && <option value="CROSS_ABOVE">Crosses Above (Bullish)</option>}
              {!isIndicator && <option value="CROSS_BELOW">Crosses Below (Bearish)</option>}
            </select>
          </div>
        </div>

        {!isIndicator && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
              Target Threshold Value ({metric === 'PRICE' ? '$ Price' : metric === 'RSI' ? 'RSI 0-100' : metric === 'STOP_LOSS' ? '% Drawdown' : 'Multiplier'})
            </label>
            <input
              type="number"
              step="0.01"
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
              required
            />
          </div>
        )}

        <div>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Severity Level</span>
          <div style={{ display: 'flex', gap: '14px' }}>
            {(['info', 'warning', 'critical'] as const).map((sev) => (
              <label key={sev} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="radio" name="sev" checked={severity === sev} onChange={() => setSeverity(sev)} />
                <span style={{ textTransform: 'capitalize' }}>{sev}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="button" className="secondary-button" onClick={onClose} style={{ flex: 1, padding: '9px', justifyContent: 'center', border: '1px solid var(--line)', width: 'auto' }}>
            Cancel
          </button>
          <button type="submit" className="ask-button" style={{ flex: 2, justifyContent: 'center' }}>
            <Check size={16} /> Save &amp; Arm Trigger
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
