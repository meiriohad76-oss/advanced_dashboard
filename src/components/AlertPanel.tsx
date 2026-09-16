import { useState } from 'react'
import { AlertTriangle, Bell, Check, Plus, Trash2, X } from 'lucide-react'
import { ModalOverlay } from './ModalOverlay'
import type { AlertItem, Holding, UserAlert } from '../types'

export interface AlertPanelProps {
  alerts: AlertItem[]
  userAlerts: UserAlert[]
  holdings: Holding[]
  onClose: () => void
  onAddAlert: (alert: UserAlert) => void
  onDeleteAlert: (id: string) => void
}

export function AlertPanel({ alerts, userAlerts, holdings, onClose, onAddAlert, onDeleteAlert }: AlertPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'create' | 'history'>('active')
  const [symbol, setSymbol] = useState(holdings[0]?.symbol || 'CRDO')
  const [metric, setMetric] = useState<UserAlert['metric']>('PRICE')
  const [condition, setCondition] = useState<UserAlert['condition']>('ABOVE')
  const [targetValue, setTargetValue] = useState<number>(50)
  const [severity, setSeverity] = useState<UserAlert['severity']>('warning')
  const [addedNotice, setAddedNotice] = useState(false)

  const selectedHolding = holdings.find((h) => h.symbol === symbol)

  const isIndicator = metric === 'MACD' || metric.startsWith('SMA')

  const handleMetricChange = (newMetric: UserAlert['metric']) => {
    setMetric(newMetric)
    if (newMetric === 'PRICE') setTargetValue(selectedHolding?.price || 150)
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
        <button className={activeTab === 'create' ? 'active' : ''} onClick={() => setActiveTab('create')}><Plus size={14} style={{ marginRight: '4px' }} /> Create Alert</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
      </div>

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
              <div key={ua.id} className="alert-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--panel)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`attention-icon ${ua.severity}`}><Bell size={16} /></span>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>{labelStr}</strong>
                    <small style={{ fontSize: '10px', color: 'var(--muted)' }}>User Alert · Armed {new Date(ua.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-pill armed">ARMED</span>
                  <button className="icon-button" onClick={() => onDeleteAlert(ua.id)} title="Delete Alert"><Trash2 size={15} color="var(--red)" /></button>
                </div>
              </div>
            )
          })}

          {alerts.map((alert) => (
            <div key={alert.id} className="alert-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--panel)', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`attention-icon ${alert.severity}`}><Bell size={16} /></span>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>{alert.symbol ? `${alert.symbol} · ` : ''}{alert.title}</strong>
                  <small style={{ fontSize: '10px', color: 'var(--muted)' }}>{alert.message}</small>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-pill ${alert.status.toLowerCase()}`}>{alert.status}</span>
                <time style={{ fontSize: '11px', color: 'var(--muted)' }}>{alert.time}</time>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          <AlertTriangle size={24} style={{ marginBottom: '8px', opacity: 0.6 }} />
          <p>Past triggered alerts and webhook execution history are logged here.</p>
        </div>
      )}
    </ModalOverlay>
  )
}
