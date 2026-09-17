import { useEffect, useState } from 'react'
import { AlertTriangle, Database, ExternalLink, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import type { RatingsStatus } from '../types'

// Freshness banner (BL-004): shows when ratings were last extracted and turns red
// when the data is older than the staleness threshold (3 days). "Run extraction"
// opens the local extractor (which runs in the user's Chrome); "Import latest" pulls
// its newest output into the dashboard DB.
function formatWhen(iso: string | null): string {
  if (!iso) return 'never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function RatingsBanner() {
  const [status, setStatus] = useState<RatingsStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    api.ratingsStatus().then((s) => { if (alive) setStatus(s) }).catch(() => { if (alive) setStatus(null) })
    return () => { alive = false }
  }, [])

  // API offline (deterministic local demo): show nothing rather than a broken banner.
  if (!status) return null

  const runExtraction = () => {
    if (status.extractor_url) window.open(status.extractor_url, '_blank', 'noopener,noreferrer')
  }

  const autoSyncRanks = () => {
    setBusy(true)
    setMessage('')
    api.syncAutoRatings()
      .then((s) => {
        setStatus(s)
        setMessage(`Synced ranks for ${s.tickers} tickers from email analyzer`)
      })
      .catch(() => setMessage('Auto-sync failed — check email article analyzer connection'))
      .finally(() => setBusy(false))
  }

  const importLatest = () => {
    setBusy(true)
    setMessage('')
    api.importRatings()
      .then((s) => { setStatus(s); setMessage(`Imported ${s.imported_rows ?? 0} ratings across ${s.tickers} tickers`) })
      .catch(() => setMessage('Import failed — run an extraction, or check the extractor output path'))
      .finally(() => setBusy(false))
  }

  const age = status.age_days == null ? '' : ` · ${status.age_days.toFixed(status.age_days < 1 ? 1 : 0)}d ago`
  const headline = status.stale
    ? 'Ratings data is stale — sync fresh ranks'
    : 'Seeking Alpha, Zacks & Investing.com ranks active'

  return (
    <div className={`ratings-banner ${status.stale ? 'stale' : 'fresh'}`} role="status">
      <span className="ratings-banner-icon">{status.stale ? <AlertTriangle size={16} /> : <Database size={16} />}</span>
      <span className="ratings-banner-text">
        <strong>{headline}</strong>
        <small>Last extracted {formatWhen(status.extracted_at)}{age} · {status.tickers} tickers covered · source: {status.source === 'db' ? 'email analyzer' : status.source}{message ? ` · ${message}` : ''}</small>
      </span>
      <div className="ratings-banner-actions">
        <button className="banner-primary" onClick={autoSyncRanks} disabled={busy} title="Directly sync ranks from email article analyzer">
          <RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Syncing…' : '⚡ Sync Ranks'}
        </button>
        <button className="secondary-button" onClick={importLatest} disabled={busy} title="Import output JSON files">
          <RefreshCw size={14} /> Import Files
        </button>
        <button className="secondary-button" onClick={runExtraction} title="Open browser extractor">
          <ExternalLink size={14} /> Open Extractor
        </button>
      </div>
    </div>
  )
}
