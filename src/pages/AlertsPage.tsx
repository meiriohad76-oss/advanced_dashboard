import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Compass,
  Gauge,
  Info,
  Plus,
  Radar,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { ModalOverlay } from '../components/ModalOverlay'
import { RecommendedTriggersView } from '../components/RecommendedTriggers'
import { resolveCompanyName } from '../data/companyNames'
import { getAlertPlaybook } from '../domain/alertPlaybook'
import { getPriceTargets } from '../domain/ratings'
import type { AlertItem, Holding, RecommendedAlert, UserAlert } from '../types'

interface AlertsPageProps {
  alerts: AlertItem[]
  userAlerts: UserAlert[]
  holdings: Holding[]
  recommendations: RecommendedAlert[]
  onSelect: (holding: Holding) => void
  onNavigate: (page: string) => void
  onOpenDecision: (holding: Holding) => void
  onOpenPanel: () => void
  onAcknowledgeRecommendation: (rec: RecommendedAlert) => void
  onDeclineRecommendation: (rec: RecommendedAlert) => void
  onChangeRecommendation: (rec: RecommendedAlert, customized: UserAlert) => void
  onRestoreRecommendation: (rec: RecommendedAlert) => void
  onOpenRebalance?: (symbol?: string) => void
}

function StatusPill({ state }: { state: string }) {
  const key = state.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill ${key}`}>{state}</span>
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: React.ReactNode
  value: string
  detail: string
  icon?: typeof Bell
  tone?: 'neutral' | 'good' | 'warning'
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-top">
        <span>{label}</span>
        {Icon && <Icon size={17} />}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function getOrBuildHolding(symbol: string, holdings: Holding[]): Holding {
  const sym = symbol.toUpperCase()
  const inHoldings = holdings.find((h) => h.symbol.toUpperCase() === sym)
  if (inHoldings) return inHoldings

  const targets = getPriceTargets(sym)
  const price = targets.saWallStreet || targets.zacks || 100
  return {
    symbol: sym,
    name: resolveCompanyName(sym) || sym,
    sector: 'Equities',
    price,
    quantity: 10,
    avgCost: price,
    weight: 2.0,
    dayChange: 0.0,
    rsi: 50,
    macdBullish: true,
    aboveSma50: true,
    aboveSma200: true,
    relativeVolume: 1.1,
    breakout20d: false,
    trendSlopePositive: true,
    hasSignalInputs: true,
  }
}

function AlertDetailModal({
  alert,
  holdings,
  onClose,
  onInspectSymbol,
  onNavigate,
  onOpenDecision,
  onOpenRebalance,
}: {
  alert: AlertItem | UserAlert
  holdings: Holding[]
  onClose: () => void
  onInspectSymbol: (symbol: string) => void
  onNavigate: (page: string) => void
  onOpenDecision: (holding: Holding) => void
  onOpenRebalance?: (symbol?: string) => void
}) {
  const isUserAlert = 'metric' in alert && 'createdAt' in alert
  const symbol = alert.symbol
  const isPortfolioAlert = !symbol || symbol.toUpperCase() === 'PORTFOLIO'
  const holding = symbol ? holdings.find((h) => h.symbol.toUpperCase() === symbol.toUpperCase()) : undefined
  const playbook = getAlertPlaybook(alert, holding)

  return (
    <ModalOverlay label="Alert Details" className="asset-drawer" onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close alert details">
        <X size={19} />
      </button>

      <div className="drawer-heading">
        <span
          className="attention-icon"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background:
              alert.severity === 'critical'
                ? 'var(--red-soft)'
                : alert.severity === 'warning'
                  ? 'var(--amber-soft)'
                  : 'var(--accent-soft)',
            color:
              alert.severity === 'critical'
                ? 'var(--red)'
                : alert.severity === 'warning'
                  ? 'var(--amber)'
                  : 'var(--accent-dark)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Bell size={22} />
        </span>
        <div>
          <span className="eyebrow">{playbook.categoryTitle.toUpperCase()}</span>
          <h2 style={{ margin: '4px 0', fontSize: '18px' }}>
            {isUserAlert ? `${alert.symbol} · ${alert.title || alert.metric + ' Alert'}` : alert.title}
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <StatusPill state={alert.status} />
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          {isUserAlert ? 'Automated Risk Monitor' : `Triggered: ${(alert as AlertItem).time}`}
        </span>
        {holding && (
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'var(--subtle)',
              color: 'var(--ink)',
              fontWeight: 600,
            }}
          >
            Market: ${holding.price.toFixed(2)} ({holding.dayChange >= 0 ? '+' : ''}
            {holding.dayChange}%)
          </span>
        )}
      </div>

      {/* 1. What is this alert about? */}
      <section className="drawer-section" style={{ marginBottom: '16px' }}>
        <span className="eyebrow" style={{ color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={13} /> WHAT IS THIS ALERT ABOUT?
        </span>
        <div style={{ background: 'var(--subtle)', padding: '14px', borderRadius: '10px', marginTop: '6px', border: '1px solid var(--line)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: 1.5, color: 'var(--ink)', fontWeight: 600 }}>
            {playbook.whatHappened}
          </p>
          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>{playbook.conditionDetail}</span>
            {isUserAlert && (alert as UserAlert).rationale && (
              <span>Thesis: {(alert as UserAlert).rationale}</span>
            )}
          </div>
        </div>
      </section>

      {/* 2. Strategic Context (What it means) */}
      <section className="drawer-section" style={{ marginBottom: '16px' }}>
        <span className="eyebrow" style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={13} /> STRATEGIC CONTEXT (WHAT IT MEANS)
        </span>
        <div style={{ background: 'var(--amber-soft)', padding: '14px', borderRadius: '10px', marginTop: '6px', border: '1px solid var(--amber-line)' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', lineHeight: 1.5, color: '#78350f' }}>
            {playbook.whatItMeans}
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#92400e', opacity: 0.9 }}>
            {playbook.technicalContext}
          </p>
        </div>
      </section>

      {/* 3. Action Playbook (What you should do now) */}
      <section className="drawer-section" style={{ marginBottom: '18px' }}>
        <span className="eyebrow" style={{ color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle2 size={13} /> ACTION PLAYBOOK: WHAT YOU SHOULD DO NOW
        </span>
        <div style={{ background: 'var(--panel)', padding: '14px', borderRadius: '10px', marginTop: '6px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {playbook.checklist.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', lineHeight: 1.5, color: 'var(--ink)' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--emerald-soft)',
                    color: 'var(--emerald)',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {idx + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Interactive Action Buttons */}
      <section className="drawer-section">
        <span className="eyebrow">EXECUTE DIRECTIVE</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {onOpenRebalance && (
            <button
              className="ask-button"
              style={{
                justifyContent: 'center',
                padding: '10px 16px',
                fontSize: '12.5px',
                background: 'var(--emerald)',
                borderColor: 'var(--emerald)',
                color: '#ffffff',
              }}
              onClick={() => {
                onClose()
                onOpenRebalance(symbol)
              }}
            >
              <Zap size={15} /> 1-Click Action: {playbook.primaryActionLabel} <ArrowRight size={14} />
            </button>
          )}

          {symbol && (
            <button
              className="ask-button"
              style={{ justifyContent: 'center', padding: '10px 16px', fontSize: '12.5px' }}
              onClick={() => {
                onClose()
                onInspectSymbol(symbol)
              }}
            >
              <Target size={15} /> Inspect {symbol} Setup &amp; Price Targets <ArrowRight size={14} />
            </button>
          )}

          {isPortfolioAlert && (
            <>
              <button
                className="ask-button"
                style={{ justifyContent: 'center', padding: '10px 16px', fontSize: '12.5px' }}
                onClick={() => {
                  onClose()
                  onNavigate('Analytics')
                }}
              >
                <TrendingUp size={15} /> Open Risk Analytics &amp; Stress Testing <ArrowRight size={15} />
              </button>
              <button
                className="ask-button"
                style={{ justifyContent: 'center', padding: '10px 16px', fontSize: '12.5px', background: 'var(--ink)' }}
                onClick={() => {
                  onClose()
                  const h = holdings.find((x) => x.sector === 'Semiconductors') || holdings[0]
                  onOpenDecision(h)
                }}
              >
                <Target size={15} /> Open Strategy Decision Directive <ArrowRight size={15} />
              </button>
            </>
          )}

          <button
            type="button"
            className="secondary-button"
            style={{ justifyContent: 'center', padding: '8px 14px', fontSize: '11px', marginTop: '4px' }}
            onClick={onClose}
          >
            Close Alert Directive
          </button>
        </div>
      </section>
    </ModalOverlay>
  )
}

export function AlertsPage({
  alerts,
  userAlerts,
  holdings,
  recommendations,
  onSelect,
  onNavigate,
  onOpenDecision,
  onOpenPanel,
  onAcknowledgeRecommendation,
  onDeclineRecommendation,
  onChangeRecommendation,
  onRestoreRecommendation,
  onOpenRebalance,
}: AlertsPageProps) {
  const [inspectingAlert, setInspectingAlert] = useState<AlertItem | UserAlert | null>(null)
  const totalCount = alerts.length + userAlerts.length

  const handleInspectSymbol = (sym: string) => {
    const h = getOrBuildHolding(sym, holdings)
    onSelect(h)
  }

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">CONTROLLED NOTIFICATIONS</span>
        <h2>Active Triggers &amp; Alerts</h2>
        <p>Every trigger is persisted, explained, and protected from repeat firing with institutional defense playbooks.</p>
      </div>

      <div className="alert-summary">
        <KpiCard
          label="Triggered"
          value={String(alerts.filter((a) => a.status === 'TRIGGERED').length + userAlerts.filter((a) => a.status === 'TRIGGERED').length)}
          detail="Action playbook active"
          icon={AlertTriangle}
          tone="warning"
        />
        <KpiCard label="Armed & Active" value={String(totalCount)} detail="Monitoring conditions" icon={Radar} />
        <KpiCard
          label="Cooldown"
          value={String(alerts.filter((a) => a.status === 'COOLDOWN').length)}
          detail="Repeat alerts suppressed"
          icon={Gauge}
        />
      </div>

      <RecommendedTriggersView
        recommendations={recommendations}
        onAcknowledge={onAcknowledgeRecommendation}
        onDecline={onDeclineRecommendation}
        onChange={onChangeRecommendation}
        onRestore={onRestoreRecommendation}
      />

      <section className="panel alerts-table">
        <div className="tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '22px' }}>
            <button className="active">Active ({totalCount})</button>
            <button>Triggered</button>
            <button>History</button>
          </div>
          <button className="ask-button" onClick={onOpenPanel} style={{ padding: '6px 12px', fontSize: '11px' }}>
            <Plus size={14} /> Create Custom Alert
          </button>
        </div>

        {userAlerts.map((ua) => {
          const h = ua.symbol ? holdings.find((x) => x.symbol.toUpperCase() === ua.symbol.toUpperCase()) : undefined
          const playbook = getAlertPlaybook(ua, h)
          const isTriggered = ua.status === 'TRIGGERED'

          return (
            <div
              className="alert-row"
              key={ua.id}
              role="button"
              tabIndex={0}
              onClick={() => setInspectingAlert(ua)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setInspectingAlert(ua)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <span className={`attention-icon ${ua.severity}`}>
                <Bell size={17} />
              </span>
              <span className="alert-copy">
                <strong>
                  {ua.symbol} · {ua.title || `${ua.metric} ${ua.condition} ${ua.targetValue}`}
                </strong>
                <small style={{ color: isTriggered ? 'var(--red)' : undefined }}>
                  {isTriggered ? `🚨 ACTION: ${playbook.checklist[0]}` : `🎯 Action: ${playbook.checklist[0]}`}
                </small>
              </span>
              <StatusPill state={ua.status} />
              <time>Now</time>
              <button
                className="icon-button"
                onClick={(e) => {
                  e.stopPropagation()
                  setInspectingAlert(ua)
                }}
                title={`Open Action Playbook for ${ua.symbol}`}
                aria-label={`Open Playbook for ${ua.symbol}`}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )
        })}

        {alerts.map((alert) => {
          const sym = alert.symbol?.toUpperCase()
          const h = sym ? holdings.find((x) => x.symbol.toUpperCase() === sym) : undefined
          const playbook = getAlertPlaybook(alert, h)
          const isTriggered = alert.status === 'TRIGGERED'

          return (
            <div
              className="alert-row"
              key={alert.id}
              role="button"
              tabIndex={0}
              onClick={() => setInspectingAlert(alert)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setInspectingAlert(alert)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <span className={`attention-icon ${alert.severity}`}>
                <Bell size={17} />
              </span>
              <span className="alert-copy">
                <strong>
                  {alert.symbol ? `${alert.symbol} · ` : ''}
                  {alert.title}
                </strong>
                <small style={{ color: isTriggered ? '#b45309' : undefined }}>
                  {isTriggered ? `🚨 ACTION: ${playbook.checklist[0]}` : alert.message}
                </small>
              </span>
              <StatusPill state={alert.status} />
              <time>{alert.time}</time>
              <button
                className="icon-button"
                onClick={(e) => {
                  e.stopPropagation()
                  setInspectingAlert(alert)
                }}
                title="Open Action Playbook"
                aria-label="Open Action Playbook"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )
        })}

        {userAlerts.length === 0 && alerts.length === 0 && (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              No active triggers or custom alerts
            </p>
            <p style={{ fontSize: '11px', maxWidth: '380px', margin: '0 auto 16px' }}>
              Your portfolio is operating within standard risk parameters. Create custom price, RSI, or breakout alerts to monitor specific holdings.
            </p>
            <button className="ask-button" onClick={onOpenPanel} style={{ padding: '7px 16px', fontSize: '11px', margin: '0 auto' }}>
              <Plus size={14} /> Create Your First Alert
            </button>
          </div>
        )}
      </section>

      {inspectingAlert && (
        <AlertDetailModal
          alert={inspectingAlert}
          holdings={holdings}
          onClose={() => setInspectingAlert(null)}
          onInspectSymbol={handleInspectSymbol}
          onNavigate={onNavigate}
          onOpenDecision={onOpenDecision}
          onOpenRebalance={onOpenRebalance}
        />
      )}
    </>
  )
}
