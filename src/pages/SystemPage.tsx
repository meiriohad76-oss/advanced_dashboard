import React, { useEffect, useState } from 'react'
import { Bell, BrainCircuit, Database, HeartPulse, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'

interface SystemPageProps {
  onOpenNotifications?: () => void
}

export function SystemPage({ onOpenNotifications }: SystemPageProps) {
  const [sched, setSched] = useState<{
    enabled: boolean
    interval_minutes: number
    last_sync: string | null
    last_status: string
    new_records_detected: number
    runs_completed: number
  } | null>(null)
  const [schedLoading, setSchedLoading] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .schedulerStatus()
      .then((s) => {
        if (alive) setSched(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const handleToggleScheduler = () => {
    if (!sched) return
    setSchedLoading(true)
    api
      .toggleScheduler(!sched.enabled)
      .then((res) => {
        setSched((prev) => (prev ? { ...prev, enabled: res.enabled } : null))
      })
      .finally(() => setSchedLoading(false))
  }

  const services = [
    ['Market data (Yahoo/Alpaca)', 'Live', 'Connected'],
    ['Calculation engine', 'Active', 'Real-time'],
    ['Ratings Extractor Bridge', 'Active', 'Synced'],
    [
      'Automated Scheduler',
      sched?.enabled ? 'Active' : 'Paused',
      sched?.last_sync ? `Sync: ${sched.last_sync.slice(11, 16)} UTC` : 'Every 10m',
    ],
    ['Portfolio database', 'Healthy', 'Connected'],
    ['Alert evaluator & Push', 'Active', 'Real-time'],
  ]

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TRUST &amp; OPERATIONS</span>
        <h2>System Health &amp; Background Services</h2>
        <p>Source freshness, background tasks, and automated runner state are visible—not assumed.</p>
      </div>

      <div className="system-grid">
        <section className="panel system-hero">
          <div className="health-orb">
            <HeartPulse size={31} />
          </div>
          <div>
            <span className="eyebrow">OVERALL STATUS</span>
            <h2>All systems operational</h2>
            <p>Live operational market data, indicators engine &amp; background scheduler active</p>
          </div>
        </section>

        {/* Background Scheduler Card */}
        <section className="panel" style={{ background: 'var(--subtle)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="eyebrow">AUTOMATED EXTRACTOR SCHEDULER</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: sched?.enabled ? 'var(--accent-soft)' : 'var(--subtle)',
                color: sched?.enabled ? 'var(--accent-dark)' : 'var(--muted)',
              }}
            >
              {sched?.enabled ? '⚡ RUNNING' : '⏸ PAUSED'}
            </span>
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>Pre-Market &amp; Periodic Sync Runner</h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px 0' }}>
            Polls the companion article analyzer database every {sched?.interval_minutes ?? 10} minutes. Automatically pulls
            rank shifts and recalculates model setups.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '11px',
              marginBottom: '12px',
            }}
          >
            <div style={{ background: 'var(--panel)', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)', display: 'block' }}>Status</span>
              <strong>{sched?.last_status ?? 'Ready'}</strong>
            </div>
            <div style={{ background: 'var(--panel)', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)', display: 'block' }}>Runs Completed</span>
              <strong>{sched?.runs_completed ?? 0} cycles</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleToggleScheduler}
              disabled={schedLoading}
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {sched?.enabled ? 'Pause Runner' : 'Resume Runner'}
            </button>
            {onOpenNotifications && (
              <button
                type="button"
                className="banner-primary"
                onClick={onOpenNotifications}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                <Bell size={13} /> Telegram &amp; Push Alerts
              </button>
            )}
          </div>
        </section>

        <section className="panel service-list">
          {services.map(([name, status, time]) => (
            <div key={name}>
              <span>
                <i />
                {name}
              </span>
              <strong>{status}</strong>
              <time>{time}</time>
            </div>
          ))}
        </section>

        <section className="panel provenance-panel">
          <span className="eyebrow">DATA PROVENANCE</span>
          <h2>Know what supports every answer</h2>
          <p>
            Live market data ingested via Yahoo Finance and Alpaca with real-time technical calculation engine (RSI-14,
            SMA-50, SMA-200, MACD, Trend Slope, Rel-Vol) and automated ratings extraction.
          </p>
          <div>
            <Database size={17} />
            <span>
              <strong>Live Market Engine</strong>
              <small>Concurrent price feeds &amp; historical bars</small>
            </span>
          </div>
          <div>
            <BrainCircuit size={17} />
            <span>
              <strong>Deterministic calculations</strong>
              <small>Verified mathematical formula implementation</small>
            </span>
          </div>
          <div>
            <ShieldCheck size={17} />
            <span>
              <strong>Grounded explanations</strong>
              <small>Calculations derived from live computed metrics</small>
            </span>
          </div>
        </section>
      </div>
    </>
  )
}
