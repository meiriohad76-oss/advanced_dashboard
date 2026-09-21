import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, Check, CheckCircle2, History, Plus, RefreshCw, ShieldAlert, Sparkles, Trash2, TrendingUp, X } from 'lucide-react'
import { ModalOverlay } from './ModalOverlay'
import type { AlertHistoryEntry, AlertItem, Holding, RecommendedAlert, UserAlert } from '../types'
import { RecommendedTriggersView } from './RecommendedTriggers'
import { getAlertPlaybook } from '../domain/alertPlaybook'
import { api } from '../api/client'

export interface AlertPanelProps {
  alerts: AlertItem[]
  userAlerts: UserAlert[]
  holdings: Holding[]
  recommendations?: RecommendedAlert[]
  onClose: () => void
  onAddAlert: (alert: UserAlert) => void
  onDeleteAlert: (id: string) => void
  onAcknowledgeRecommendation?: (rec: RecommendedAlert) => void
  onDeclineRecommendation?: (rec: RecommendedAlert) => void
  onChangeRecommendation?: (rec: RecommendedAlert, customized: UserAlert) => void
  onInspectAlert?: (alert: AlertItem | UserAlert) => void
}

export function AlertPanel({
  alerts,
  userAlerts,
  holdings,
  recommendations = [],
  onClose,
  onAddAlert,
  onDeleteAlert,
  onAcknowledgeRecommendation,
  onDeclineRecommendation,
  onChangeRecommendation,
  onInspectAlert,
}: AlertPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'recommended' | 'create' | 'history'>('active')
  const [symbol, setSymbol] = useState(holdings[0]?.symbol || '')
  const [metric, setMetric] = useState<UserAlert['metric']>('PRICE')
  const [condition, setCondition] = useState<UserAlert['condition']>('ABOVE')
  const [targetValue, setTargetValue] = useState<number>(() => holdings[0]?.price || 50)
  const [severity, setSeverity] = useState<UserAlert['severity']>('warning')
  const [addedNotice, setAddedNotice] = useState(false)

  // Persistent History State
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)

  const pendingRecs = recommendations.filter((r) => r.status === 'PENDING')


  const selectedHolding = holdings.find((h) => h.symbol === symbol)

  const isIndicator = metric === 'MACD' || metric.startsWith('SMA')

  const handleMetricChange = (newMetric: UserAlert['metric']) => {
    setMetric(newMetric)
    if (newMetric === 'PRICE') setTargetValue(selectedHolding?.price || 100)
    else if (newMetric === 'RSI') setTargetValue(condition.includes('ABOVE') ? 70 : 30)
    else if (newMetric === 'VOLUME') setTargetValue(2.0)
    else if (newMetric === 'STOP_LOSS') setTargetValue(5.0)
    else setTargetValue(0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newAlert: UserAlert = {
      id: `usr_${Date.now()}`,
      symbol: symbol.toUpperCase(),
      metric,
      condition,
      targetValue: isIndicator ? 0 : Number(targetValue),
      severity,
      status: 'ARMED',
      createdAt: new Date().toISOString(),
    }
    onAddAlert(newAlert)
    setAddedNotice(true)
    setTimeout(() => {
      setAddedNotice(false)
      setActiveTab('active')
    }, 1200)
  }

  useEffect(() => {
    if (activeTab === 'history') {
      setHistoryLoading(true)
      api.getAlertHistory(100)
        .then((res) => {
          setHistory(res || [])
          setHistoryLoading(false)
        })
        .catch(() => {
          setHistoryLoading(false)
        })
    }
  }, [activeTab])

  const handleRecordAction = async (id: string, action: AlertHistoryEntry['action_taken']) => {
    try {
      setActionBusyId(id)
      const updated = await api.recordAlertAction(id, action)
      setHistory((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (err) {
      console.error('Failed to record action', err)
    } finally {
      setActionBusyId(null)
    }
  }

  const handleDeleteHistory = async (id: string) => {
    try {
      await api.deleteAlertHistoryEntry(id)
      setHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      console.error('Failed to delete history item', err)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all alert audit history?')) return
    try {
      await api.clearAlertHistory()
      setHistory([])
    } catch (err) {
      console.error('Failed to clear history', err)
    }
  }

  return (
    <ModalOverlay className="alert-drawer" label="Alert Management Panel" onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close alert panel"><X size={19} /></button>
      <div className="ask-heading">
        <span><Bell size={21} /></span>
        <div>
          <p>CUSTOM ALERTS &amp; MONITORS</p>
          <h2>Alert Center</h2>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: '14px', marginBottom: '16px' }}>
        <button className={activeTab === 'active' ? 'active' : ''} onClick={() => setActiveTab('active')}>Active ({alerts.length + userAlerts.length})</button>
        <button className={activeTab === 'recommended' ? 'active' : ''} onClick={() => setActiveTab('recommended')}>
          <Sparkles size={13} style={{ marginRight: '4px' }} /> Recommended ({pendingRecs.length})
        </button>
        <button className={activeTab === 'create' ? 'active' : ''} onClick={() => setActiveTab('create')}><Plus size={14} style={{ marginRight: '4px' }} /> Create Alert</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
      </div>

      {activeTab === 'recommended' && (
        <RecommendedTriggersView
          recommendations={recommendations}
          onAcknowledge={onAcknowledgeRecommendation || (() => {})}
          onDecline={onDeclineRecommendation || (() => {})}
          onChange={onChangeRecommendation || (() => {})}
        />
      )}

      {activeTab === 'create' && (
        <form className="alert-form" onSubmit={handleSubmit} style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--ink)' }}>Create Custom Stock Alert</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label htmlFor="alert-symbol-select" style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Symbol</label>
              <select id="alert-symbol-select" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--subtle)', color: 'var(--ink)' }}>
                {holdings.map((h) => (
                  <option key={h.symbol} value={h.symbol}>{h.symbol} — {h.name || h.symbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="alert-metric-select" style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Alert Type / Metric</label>
              <select id="alert-metric-select" value={metric} onChange={(e) => handleMetricChange(e.target.value as UserAlert['metric'])} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--subtle)', color: 'var(--ink)' }}>
                <option value="PRICE">Price Target ($)</option>
                <option value="SMA20">20-Day SMA Crossing</option>
                <option value="SMA50">50-Day SMA Crossing</option>
                <option value="SMA150">150-Day SMA Crossing</option>
                <option value="RSI">RSI Threshold (14d)</option>
                <option value="MACD">MACD Crossing Signal</option>
                <option value="VOLUME">Unusual Volume (&gt;2x)</option>
                <option value="STOP_LOSS">Trailing Stop Loss (%)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label htmlFor="alert-condition-select" style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Trigger Condition</label>
              <select id="alert-condition-select" value={condition} onChange={(e) => setCondition(e.target.value as UserAlert['condition'])} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--subtle)', color: 'var(--ink)' }}>
                <option value="ABOVE">{isIndicator ? 'Bullish / Crosses Above' : 'Rises Above (>)'}</option>
                <option value="BELOW">{isIndicator ? 'Bearish / Crosses Below' : 'Falls Below (<)'}</option>
                {!isIndicator && <option value="CROSS_ABOVE">Crosses Above (Bullish)</option>}
                {!isIndicator && <option value="CROSS_BELOW">Crosses Below (Bearish)</option>}
              </select>
            </div>

            <div>
              {isIndicator ? (
                <>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Threshold Value
                  </span>
                  <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--subtle)', border: '1px solid var(--line)', fontSize: '10px', color: 'var(--accent-dark)', fontWeight: 600, height: '35px', display: 'flex', alignItems: 'center' }}>
                    ✓ Crossover event (No number required)
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="alert-target-value-input" style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Target Threshold Value
                  </label>
                  <input 
                    id="alert-target-value-input"
                    type="number" 
                    step="0.01" 
                    value={targetValue} 
                    onChange={(e) => setTargetValue(Number(e.target.value))} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--subtle)', color: 'var(--ink)' }} 
                    placeholder={metric === 'PRICE' ? 'e.g. 150.00' : metric === 'RSI' ? 'e.g. 70' : metric === 'VOLUME' ? 'e.g. 2.0' : 'e.g. 5.0'} 
                    required
                  />
                </>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Severity Level</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['info', 'warning', 'critical'] as const).map((sev) => (
                <label key={sev} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="severity" checked={severity === sev} onChange={() => setSeverity(sev)} />
                  <span style={{ textTransform: 'capitalize' }}>{sev}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedHolding && (
            <div style={{ padding: '8px 12px', background: 'var(--subtle)', borderRadius: '6px', fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>
              Current Price: <strong>${selectedHolding.price.toFixed(2)}</strong> · RSI: <strong>{selectedHolding.rsi}</strong> · 50SMA: <strong>{selectedHolding.aboveSma50 ? 'Above' : 'Below'}</strong>
            </div>
          )}

          <button type="submit" className="ask-button" style={{ width: '100%', justifyContent: 'center' }}>
            {addedNotice ? <><Check size={16} /> Alert Created!</> : <><Plus size={16} /> Save Alert</>}
          </button>
        </form>
      )}

      {activeTab === 'active' && (
        <div className="alert-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {userAlerts.map((ua) => {
            const holding = holdings.find((h) => h.symbol.toUpperCase() === ua.symbol.toUpperCase())
            const playbook = getAlertPlaybook(ua, holding)
            const isTriggered = ua.status === 'TRIGGERED'
            const isInd = ua.metric === 'MACD' || ua.metric.startsWith('SMA')
            const isAbove = ua.condition.includes('ABOVE')
            const labelStr = isInd
              ? `${ua.symbol} · ${ua.metric} ${isAbove ? 'Bullish Crossover (Above)' : 'Bearish Crossover (Below)'}`
              : ua.metric === 'PRICE'
              ? `${ua.symbol} · Price ${isAbove ? '>' : '<'} $${ua.targetValue.toFixed(2)}`
              : ua.metric === 'RSI'
              ? `${ua.symbol} · RSI ${isAbove ? '> ' + ua.targetValue + ' (Overbought)' : '< ' + ua.targetValue + ' (Oversold)'}`
              : ua.metric === 'VOLUME'
              ? `${ua.symbol} · Volume > ${ua.targetValue}x`
              : `${ua.symbol} · Drawdown > ${ua.targetValue}%`

            return (
              <div 
                key={ua.id} 
                className="alert-row" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  padding: '12px', 
                  background: 'var(--panel)', 
                  borderRadius: '8px', 
                  border: isTriggered ? '1px solid var(--red-line)' : '1px solid var(--line)' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`attention-icon ${ua.severity}`}><Bell size={16} /></span>
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>{labelStr}</strong>
                      <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        {isTriggered 
                          ? '⚠️ Trigger condition fulfilled — Action required' 
                          : `User Alert · Armed ${new Date(ua.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-pill ${isTriggered ? 'triggered' : 'armed'}`}>
                      {isTriggered ? 'TRIGGERED' : 'ARMED'}
                    </span>
                    {isTriggered && (
                      <button
                        className="ask-button"
                        onClick={async () => {
                          await api.saveAlertHistoryEntry({
                            alert_id: ua.id,
                            symbol: ua.symbol,
                            title: labelStr,
                            category: ua.category || 'CUSTOM',
                            metric: ua.metric,
                            condition: ua.condition,
                            target_value: ua.targetValue,
                            triggered_price: holding?.price,
                            playbook_directive: playbook.primaryActionLabel || playbook.checklist[0],
                          })
                          setActiveTab('history')
                        }}
                        style={{ fontSize: '10px', padding: '4px 9px', background: 'var(--amber-soft)', color: '#92400e', borderColor: 'var(--amber-line)' }}
                        title="Log this trigger event into the Playbook Alpha audit history"
                      >
                        Log Event
                      </button>
                    )}
                    {onInspectAlert && (
                      <button 
                        className="ask-button"
                        onClick={() => onInspectAlert(ua)}
                        style={{ fontSize: '10px', padding: '4px 9px', gap: '3px' }}
                        title="View What Happened & Action Playbook"
                      >
                        Playbook
                      </button>
                    )}
                    <button className="icon-button" onClick={() => onDeleteAlert(ua.id)} title="Delete Alert"><Trash2 size={15} color="var(--red)" /></button>
                  </div>
                </div>

                {/* Directive & What to do banner */}
                <div style={{ 
                  fontSize: '11px', 
                  background: isTriggered ? 'var(--red-soft)' : 'var(--subtle)', 
                  padding: '6px 10px', 
                  borderRadius: '5px', 
                  color: isTriggered ? 'var(--red)' : 'var(--ink)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  lineHeight: 1.4
                }}>
                  <span>
                    <strong>{isTriggered ? '🚨 Action Playbook: ' : '🎯 Target Action: '}</strong>
                    {playbook.checklist[0]}
                  </span>
                </div>
              </div>
            )
          })}

          {alerts.map((alert) => {
            const holding = alert.symbol ? holdings.find((h) => h.symbol.toUpperCase() === alert.symbol!.toUpperCase()) : undefined
            const playbook = getAlertPlaybook(alert, holding)
            const isTriggered = alert.status === 'TRIGGERED'

            return (
              <div 
                key={alert.id} 
                className="alert-row" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  padding: '12px', 
                  background: 'var(--panel)', 
                  borderRadius: '8px', 
                  border: isTriggered ? '1px solid var(--amber-line)' : '1px solid var(--line)' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`attention-icon ${alert.severity}`}><Bell size={16} /></span>
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>
                        {alert.symbol ? `${alert.symbol} · ` : ''}{alert.title}
                      </strong>
                      <small style={{ fontSize: '10px', color: 'var(--muted)' }}>{alert.message}</small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-pill ${alert.status.toLowerCase()}`}>{alert.status}</span>
                    <time style={{ fontSize: '11px', color: 'var(--muted)' }}>{alert.time}</time>
                    {onInspectAlert && (
                      <button 
                        className="ask-button"
                        onClick={() => onInspectAlert(alert)}
                        style={{ fontSize: '10px', padding: '4px 9px', gap: '3px' }}
                        title="View What Happened & Action Playbook"
                      >
                        Playbook
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ 
                  fontSize: '11px', 
                  background: isTriggered ? 'var(--amber-soft)' : 'var(--subtle)', 
                  padding: '6px 10px', 
                  borderRadius: '5px', 
                  color: isTriggered ? '#92400e' : 'var(--ink)',
                  lineHeight: 1.4
                }}>
                  <span><strong>🎯 Recommended Action: </strong>{playbook.checklist[0]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header Action Bar & Summary Metrics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '14px', margin: 0, color: 'var(--ink)' }}>Triggered Alerts &amp; Playbook Alpha Log</h3>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
                Audit trail of historical trigger events, playbook recommendations, and user actions.
              </p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'var(--panel)',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Clear History
              </button>
            )}
          </div>

          {/* Metrics summary banner */}
          {history.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Events Logged</span>
                <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{history.length}</strong>
              </div>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Action Taken Rate</span>
                <strong style={{ fontSize: '16px', color: 'var(--green)' }}>
                  {Math.round((history.filter((h) => h.action_taken !== 'UNACKNOWLEDGED').length / history.length) * 100)}%
                </strong>
              </div>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Alpha Defense Status</span>
                <strong style={{ fontSize: '16px', color: 'var(--accent-dark)' }}>
                  {history.filter((h) => h.action_taken === 'STOPPED_OUT_CASH' || h.action_taken === 'TRIMMED').length} Protected
                </strong>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              <RefreshCw size={18} className="spin" style={{ marginBottom: '8px' }} />
              <p>Loading alert history…</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', background: 'var(--subtle)', borderRadius: '8px', border: '1px dashed var(--line)' }}>
              <History size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>No Triggered Alerts Logged Yet</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>
                When market prices hit armed stop-loss or profit-take thresholds, events are automatically saved here with their action playbooks.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map((entry) => {
                const isPending = entry.action_taken === 'UNACKNOWLEDGED'
                const isTrimmed = entry.action_taken === 'TRIMMED'
                const isExited = entry.action_taken === 'STOPPED_OUT_CASH'
                const isAck = entry.action_taken === 'ACKNOWLEDGED'
                const isIgnored = entry.action_taken === 'IGNORED'

                const actionBadgeBg = isPending ? 'rgba(245, 158, 11, 0.12)'
                  : isTrimmed ? 'rgba(16, 185, 129, 0.12)'
                  : isExited ? 'rgba(59, 130, 246, 0.12)'
                  : isAck ? 'rgba(14, 165, 233, 0.12)'
                  : 'rgba(156, 163, 175, 0.12)'

                const actionBadgeColor = isPending ? '#d97706'
                  : isTrimmed ? '#059669'
                  : isExited ? '#2563eb'
                  : isAck ? '#0284c7'
                  : '#6b7280'

                const actionLabel = isPending ? 'Action Required'
                  : isTrimmed ? 'Trimmed 33% (Locked Profit)'
                  : isExited ? 'Exited to Cash (Saved Loss)'
                  : isAck ? 'Acknowledged'
                  : 'Ignored'

                const dateStr = new Date(entry.triggered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                const timeStr = new Date(entry.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                return (
                  <div
                    key={entry.id}
                    style={{
                      background: 'var(--panel)',
                      border: isPending ? '1px solid #f59e0b' : '1px solid var(--line)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: 'var(--subtle)',
                          color: 'var(--ink)'
                        }}>
                          {entry.symbol}
                        </span>
                        <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{entry.title}</strong>
                        {entry.triggered_price ? (
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            @ ${entry.triggered_price.toFixed(2)} (Target: ${entry.target_value?.toFixed(2) || '—'})
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: actionBadgeBg,
                          color: actionBadgeColor,
                        }}>
                          {actionLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(entry.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}
                          title="Delete entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Playbook Directive Banner */}
                    {entry.playbook_directive && (
                      <div style={{
                        fontSize: '11px',
                        background: 'var(--subtle)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        color: 'var(--ink)',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '6px',
                      }}>
                        <strong style={{ color: 'var(--accent-dark)', whiteSpace: 'nowrap' }}>Recommended Playbook:</strong>
                        <span>{entry.playbook_directive}</span>
                      </div>
                    )}

                    {/* Action Selector Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        Triggered {dateStr} at {timeStr}
                        {entry.action_timestamp && ` · Action recorded ${new Date(entry.action_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={actionBusyId === entry.id}
                          onClick={() => handleRecordAction(entry.id, 'TRIMMED')}
                          style={{
                            fontSize: '10px',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: isTrimmed ? '1px solid #10b981' : '1px solid var(--line)',
                            background: isTrimmed ? 'rgba(16, 185, 129, 0.15)' : 'var(--panel)',
                            color: isTrimmed ? '#047857' : 'var(--ink)',
                            cursor: 'pointer',
                            fontWeight: isTrimmed ? 700 : 500,
                          }}
                        >
                          ✂️ Trimmed
                        </button>
                        <button
                          type="button"
                          disabled={actionBusyId === entry.id}
                          onClick={() => handleRecordAction(entry.id, 'STOPPED_OUT_CASH')}
                          style={{
                            fontSize: '10px',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: isExited ? '1px solid #2563eb' : '1px solid var(--line)',
                            background: isExited ? 'rgba(37, 99, 235, 0.15)' : 'var(--panel)',
                            color: isExited ? '#1d4ed8' : 'var(--ink)',
                            cursor: 'pointer',
                            fontWeight: isExited ? 700 : 500,
                          }}
                        >
                          🛡️ Exited Cash
                        </button>
                        <button
                          type="button"
                          disabled={actionBusyId === entry.id}
                          onClick={() => handleRecordAction(entry.id, 'ACKNOWLEDGED')}
                          style={{
                            fontSize: '10px',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: isAck ? '1px solid #0ea5e9' : '1px solid var(--line)',
                            background: isAck ? 'rgba(14, 165, 233, 0.15)' : 'var(--panel)',
                            color: isAck ? '#0369a1' : 'var(--ink)',
                            cursor: 'pointer',
                            fontWeight: isAck ? 700 : 500,
                          }}
                        >
                          ✓ Ack
                        </button>
                        <button
                          type="button"
                          disabled={actionBusyId === entry.id}
                          onClick={() => handleRecordAction(entry.id, 'IGNORED')}
                          style={{
                            fontSize: '10px',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: isIgnored ? '1px solid #9ca3af' : '1px solid var(--line)',
                            background: isIgnored ? 'rgba(156, 163, 175, 0.15)' : 'var(--panel)',
                            color: isIgnored ? '#4b5563' : 'var(--muted)',
                            cursor: 'pointer',
                            fontWeight: isIgnored ? 700 : 500,
                          }}
                        >
                          ✕ Ignore
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </ModalOverlay>
  )
}
