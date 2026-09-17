import { useEffect, useState } from 'react'
import { AlertTriangle, Database, ExternalLink, RefreshCw, TrendingUp, TrendingDown, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'
import type { RatingsStatus, RatingShiftItem } from '../types'

function formatWhen(iso: string | null): string {
  if (!iso) return 'never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function RatingsBanner({ onSelectTicker }: { onSelectTicker?: (ticker: string) => void }) {
  const [status, setStatus] = useState<RatingsStatus | null>(null)
  const [shifts, setShifts] = useState<RatingShiftItem[]>([])
  const [shiftsOpen, setShiftsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    api.ratingsStatus().then((s) => { if (alive) setStatus(s) }).catch(() => { if (alive) setStatus(null) })
    api.ratingsChanges().then((res) => { if (alive && res?.changes) setShifts(res.changes) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!status) return null

  const runExtraction = async () => {
    setLaunching(true)
    try {
      const res = await api.ensureExtractorRunning()
      const target = res?.url || status.extractor_url || 'http://127.0.0.1:8000/research'
      window.open(target, '_blank', 'noopener,noreferrer')
    } catch {
      const target = status.extractor_url || 'http://127.0.0.1:8000/research'
      window.open(target, '_blank', 'noopener,noreferrer')
    } finally {
      setLaunching(false)
    }
  }

  const autoSyncRanks = () => {
    setBusy(true)
    setMessage('')
    api.syncAutoRatings()
      .then((s) => {
        setStatus(s)
        setMessage(`Synced ranks for ${s.tickers} tickers from email analyzer`)
        api.ratingsChanges().then((res) => { if (res?.changes) setShifts(res.changes) }).catch(() => {})
      })
      .catch(() => setMessage('Auto-sync failed — check email article analyzer connection'))
      .finally(() => setBusy(false))
  }

  const importLatest = () => {
    setBusy(true)
    setMessage('')
    api.importRatings()
      .then((s) => { 
        setStatus(s) 
        setMessage(`Imported ${s.imported_rows ?? 0} ratings across ${s.tickers} tickers`)
        api.ratingsChanges().then((res) => { if (res?.changes) setShifts(res.changes) }).catch(() => {})
      })
      .catch(() => setMessage('Import failed — run an extraction, or check the extractor output path'))
      .finally(() => setBusy(false))
  }

  const age = status.age_days == null ? '' : ` · ${status.age_days.toFixed(status.age_days < 1 ? 1 : 0)}d ago`
  const headline = status.stale
    ? 'Ratings data is stale — sync fresh ranks'
    : 'Seeking Alpha, Zacks & Investing.com ranks active'

  const topShifts = shifts.slice(0, 8)

  return (
    <div style={{ marginBottom: '16px' }}>
      <div className={`ratings-banner ${status.stale ? 'stale' : 'fresh'}`} role="status">
        <span className="ratings-banner-icon">{status.stale ? <AlertTriangle size={16} /> : <Database size={16} />}</span>
        <span className="ratings-banner-text">
          <strong>{headline}</strong>
          <small>
            Last extracted {formatWhen(status.extracted_at)}{age} · {status.tickers} tickers covered · source: {status.source === 'db' ? 'email analyzer' : status.source}
            {shifts.length > 0 ? ` · ⚡ ${shifts.length} recent rating shifts` : ''}
            {message ? ` · ${message}` : ''}
          </small>
        </span>
        <div className="ratings-banner-actions">
          {shifts.length > 0 && (
            <button
              className="secondary-button"
              onClick={() => setShiftsOpen(!shiftsOpen)}
              style={{ background: shiftsOpen ? 'var(--accent-soft)' : undefined, color: shiftsOpen ? 'var(--accent-dark)' : undefined }}
              title="View recent upgrades & downgrades"
            >
              {shiftsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Rating Shifts ({shifts.length})
            </button>
          )}
          <button className="banner-primary" onClick={autoSyncRanks} disabled={busy} title="Directly sync ranks from email article analyzer">
            <RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Syncing…' : '⚡ Sync Ranks'}
          </button>
          <button className="secondary-button" onClick={importLatest} disabled={busy} title="Import output JSON files">
            <RefreshCw size={14} /> Import Files
          </button>
          <button className="secondary-button" onClick={runExtraction} disabled={launching} title="Ensure extractor is running and open research dashboard">
            <ExternalLink size={14} className={launching ? 'spin' : ''} /> {launching ? 'Launching…' : 'Open Extractor'}
          </button>
        </div>
      </div>

      {/* Shifts Feed Dropdown / Drawer */}
      {shiftsOpen && shifts.length > 0 && (
        <div style={{ background: 'var(--subtle)', border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              RECENT UPGRADES, DOWNGRADES &amp; TARGET REVISIONS
            </span>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
              Detected across consecutive runs in companion analyzer
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
            {topShifts.map((s, idx) => {
              const isUpgrade = s.direction === 'UPGRADE'
              const isDowngrade = s.direction === 'DOWNGRADE'
              return (
                <button
                  type="button"
                  key={`${s.ticker}-${s.provider}-${s.field}-${idx}`}
                  style={{
                    background: 'var(--panel)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: onSelectTicker ? 'pointer' : 'default',
                    textAlign: 'left',
                    font: 'inherit',
                    width: '100%',
                  }}
                  onClick={() => onSelectTicker && onSelectTicker(s.ticker)}
                  title={s.headline}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      display: 'grid',
                      placeItems: 'center',
                      background: isUpgrade ? 'rgba(52, 211, 153, 0.15)' : isDowngrade ? 'rgba(248, 113, 113, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isUpgrade ? 'var(--green)' : isDowngrade ? 'var(--red)' : '#2563eb',
                      flexShrink: 0,
                    }}
                  >
                    {isUpgrade ? <TrendingUp size={14} /> : isDowngrade ? <TrendingDown size={14} /> : <ArrowRight size={14} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12px', color: 'var(--ink)' }}>{s.ticker}</strong>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isUpgrade ? 'rgba(52, 211, 153, 0.2)' : isDowngrade ? 'rgba(248, 113, 113, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: isUpgrade ? '#065f46' : isDowngrade ? '#991b1b' : '#1e40af',
                        }}
                      >
                        {s.direction}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.field}: <span style={{ textDecoration: 'line-through' }}>{s.previous}</span> → <strong>{s.current}</strong>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

