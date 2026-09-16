import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, CheckCircle2, Download, Globe,
  ListChecks, RefreshCw, ShieldCheck, Upload, Wifi, Zap
} from 'lucide-react'
import { api } from '../api/client'
import type {
  BrokerAlpacaStatus,
  MarketStatus,
  PortfolioSource,
  Quote,
  WatchlistData,
  WatchlistItem,
} from '../types'

const PORTFOLIO_TEMPLATE = `symbol,name,sector,quantity,price,avg_cost,weight,day_change,rsi,macd_bullish,above_sma_50,above_sma_200,relative_volume,breakout_20d,trend_slope_positive
NVDA,NVIDIA,Semiconductors,380,203.34,159.10,,2.31,61,true,true,true,1.18,false,true
MSFT,Microsoft,Software,145,519.72,438.25,,0.74,55,true,true,true,0.91,false,true
CASH,Cash balance,Cash,1,31200,31200,,0,,,,,,,
`
const WATCHLIST_TEMPLATE = `symbol,name,sector,note
AVGO,Broadcom,Semiconductors,AI networking exposure
PLTR,Palantir,Software,watching for pullback to SMA50
`

function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click()
  a.remove(); URL.revokeObjectURL(url)
}

function UploadCard({ title, hint, accepting, onUpload, onReset, onDownload, status, busy, sampleText, sampleName }: {
  title: string; hint: string; accepting: boolean
  onUpload: (file: File) => void; onReset: () => void; onDownload: () => void
  status: ReactNode; busy: boolean; sampleText?: string; sampleName?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onUpload(f)
  }
  const loadSample = () => {
    if (!sampleText || !sampleName) return
    const file = new File([sampleText], sampleName, { type: 'text/csv' })
    onUpload(file)
  }
  return (
    <section className={`panel import-card ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}>
      <div className="section-heading"><div><span className="eyebrow">{hint}</span><h2>{title}</h2></div></div>
      <input ref={input} type="file" accept=".csv,.xlsx,.xls" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = '' }} />
      <div className="import-actions">
        <button className="secondary-button" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} /> {busy ? 'Uploading…' : 'Choose CSV / Excel'}</button>
        {sampleText && <button className="secondary-button" disabled={busy} onClick={loadSample}>Load Sample</button>}
        <button className="text-button" onClick={onDownload}><Download size={14} /> Template</button>
        {accepting && <button className="text-button" onClick={onReset}><RefreshCw size={14} /> Revert to demo</button>}
      </div>
      <div className="import-status">{status}</div>
    </section>
  )
}

function Warnings({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null
  return <ul className="import-warnings">{warnings.map((w) => <li key={w}><AlertTriangle size={13} /> {w}</li>)}</ul>
}

// Import page: upload the real portfolio + watchlist. Uploaded lists become the source of
// truth for the whole dashboard (the backend prefers them over the seeded demo book).
export function ImportPage({ onChanged }: { onChanged: () => void }) {
  const [source, setSource] = useState<PortfolioSource | null>(null)
  const [watch, setWatch] = useState<WatchlistData | null>(null)
  const [pBusy, setPBusy] = useState(false)
  const [wBusy, setWBusy] = useState(false)
  const [pMsg, setPMsg] = useState<{ ok: boolean; text: string; warnings?: string[] } | null>(null)
  const [wMsg, setWMsg] = useState<{ ok: boolean; text: string; warnings?: string[] } | null>(null)

  // Alpaca Broker & Market Data states (§13, §14, §97)
  const [alpacaStatus, setAlpacaStatus] = useState<BrokerAlpacaStatus | null>(null)
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)
  const [alpacaBusy, setAlpacaBusy] = useState(false)
  const [alpacaMsg, setAlpacaMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [inspectSymbol, setInspectSymbol] = useState('SPY')
  const [inspectQuote, setInspectQuote] = useState<Quote | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)

  const reloadData = () => {
    api.portfolioSource().then(setSource).catch(() => setSource(null))
    api.watchlist().then(setWatch).catch(() => setWatch(null))
    api.brokerAlpacaStatus().then(setAlpacaStatus).catch(() => setAlpacaStatus(null))
    api.marketStatus().then(setMarketStatus).catch(() => setMarketStatus(null))
  }

  useEffect(() => {
    reloadData()
  }, [])

  const uploadPortfolio = (file: File) => {
    setPBusy(true); setPMsg(null)
    api.importPortfolio(file).then((s) => {
      setSource(s)
      setPMsg({ ok: true, text: `Loaded ${s.count} holdings from ${s.name}.${s.has_signal_inputs ? '' : ' No technical columns — signals will show “needs market data”.'}`, warnings: s.warnings })
      onChanged()
    }).catch((e) => setPMsg({ ok: false, text: String(e.message || e) })).finally(() => setPBusy(false))
  }
  const resetPortfolio = () => {
    setPBusy(true)
    api.resetPortfolio().then((s) => {
      setSource(s)
      setPMsg({ ok: true, text: 'Reverted to the seeded demo book.' })
      setAlpacaMsg(null)
      onChanged()
    }).finally(() => setPBusy(false))
  }
  const uploadWatchlist = (file: File) => {
    setWBusy(true); setWMsg(null)
    api.importWatchlist(file).then((w) => { setWatch(w); setWMsg({ ok: true, text: `Loaded ${w.count} watchlist symbols from ${w.name}.`, warnings: w.warnings }) })
      .catch((e) => setWMsg({ ok: false, text: String(e.message || e) })).finally(() => setWBusy(false))
  }
  const resetWatchlist = () => { setWBusy(true); api.resetWatchlist().then((w) => { setWatch(w); setWMsg({ ok: true, text: 'Watchlist cleared.' }) }).finally(() => setWBusy(false)) }

  const syncAlpaca = () => {
    setAlpacaBusy(true)
    setAlpacaMsg(null)
    api.brokerAlpacaSync().then((res) => {
      setAlpacaMsg({ ok: true, text: res.message })
      reloadData()
      onChanged()
    }).catch((err) => {
      setAlpacaMsg({ ok: false, text: String(err.message || err) })
    }).finally(() => setAlpacaBusy(false))
  }

  const checkLiveQuote = (sym: string) => {
    const clean = sym.trim().toUpperCase()
    if (!clean) return
    setQuoteBusy(true)
    api.marketQuote(clean).then((q) => {
      setInspectQuote(q)
    }).catch((err) => {
      alert(`Quote failed for ${clean}: ${err.message}`)
    }).finally(() => setQuoteBusy(false))
  }

  const isCustomPortfolio = source?.source === 'uploaded' || source?.source === 'alpaca'
  const isAlpacaActive = source?.source === 'alpaca'

  return (
    <>
      <PageHeading eyebrow="REAL DATA & BROKER" title="Portfolio & Market Data Integrations" copy="Connect to live market data feeds and synchronize your Alpaca paper or live broker portfolio with zero manual entry." />

      {/* Row 1: Alpaca Broker & Market Data Providers (§13, §14, §97) */}
      <div className="import-grid" style={{ marginBottom: '16px' }}>
        <section className="panel import-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">READ-ONLY BROKER SYNC (§97)</span>
              <h2>Alpaca Markets Integration</h2>
            </div>
            {alpacaStatus?.connected && (
              <span className="status-pill active" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <ShieldCheck size={12} /> {alpacaStatus.account_status}
              </span>
            )}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px' }}>
            Direct read-only synchronization of open positions and cash balances via Alpaca Trading API. No automated trade execution permitted.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', background: 'var(--subtle-bg, #111417)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <small style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Portfolio Value</small>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>
                {alpacaStatus ? `$${alpacaStatus.portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </strong>
            </div>
            <div>
              <small style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Cash Balance</small>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>
                {alpacaStatus ? `$${alpacaStatus.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </strong>
            </div>
            <div>
              <small style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Buying Power</small>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>
                {alpacaStatus ? `$${alpacaStatus.buying_power.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </strong>
            </div>
          </div>

          <div className="import-actions">
            <button className="primary-button" disabled={alpacaBusy || !alpacaStatus?.configured} onClick={syncAlpaca}>
              <RefreshCw size={14} className={alpacaBusy ? 'spin' : ''} /> {alpacaBusy ? 'Syncing Broker…' : 'Sync Alpaca Positions'}
            </button>
            {isAlpacaActive && (
              <button className="text-button" onClick={resetPortfolio}><RefreshCw size={14} /> Revert to demo</button>
            )}
          </div>

          <div className="import-status" style={{ marginTop: '10px' }}>
            <p className="import-current">
              {isAlpacaActive ? (
                <><CheckCircle2 size={14} /> Active Book: <strong>Alpaca Paper Portfolio</strong> · {source?.count} position(s)</>
              ) : (
                alpacaStatus?.configured ? 'Alpaca credentials configured. Ready to sync.' : 'Alpaca credentials missing in .env.'
              )}
            </p>
            {alpacaMsg && <p className={alpacaMsg.ok ? 'import-ok' : 'import-err'}>{alpacaMsg.text}</p>}
          </div>
        </section>

        <section className="panel import-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">QUOTE ENGINE (§13, §14)</span>
              <h2>Market Data Routing</h2>
            </div>
            <span className="status-pill active" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
              <Zap size={12} /> {marketStatus?.active_provider ? `${marketStatus.active_provider.toUpperCase()} PRIMARY` : 'STANDBY'}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px' }}>
            Dynamic provider fallback chain: Alpaca v2 Market Data (Primary) &rarr; Yahoo Finance (Zero-Key Fallback).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--subtle-bg, #111417)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wifi size={13} color="#22c55e" /> <strong>Alpaca Markets (v2)</strong>
              </span>
              <span style={{ fontSize: '11px', color: marketStatus?.alpaca?.healthy ? '#22c55e' : 'var(--muted)' }}>
                {marketStatus?.alpaca?.healthy ? 'Connected' : marketStatus?.alpaca?.configured ? 'Configured' : 'Offline'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--subtle-bg, #111417)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={13} color="#3b82f6" /> <strong>Yahoo Finance (Fallback)</strong>
              </span>
              <span style={{ fontSize: '11px', color: marketStatus?.yahoo?.healthy ? '#22c55e' : 'var(--muted)' }}>
                {marketStatus?.yahoo?.healthy ? 'Ready (Zero-Key)' : 'Standby'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={inspectSymbol}
              onChange={(e) => setInspectSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. SPY, NVDA"
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', width: '110px', fontSize: '12px' }}
            />
            <button className="secondary-button" disabled={quoteBusy} onClick={() => checkLiveQuote(inspectSymbol)}>
              <RefreshCw size={13} className={quoteBusy ? 'spin' : ''} /> {quoteBusy ? 'Fetching…' : 'Inspect Live Quote'}
            </button>
          </div>

          {inspectQuote && (
            <div style={{ marginTop: '10px', padding: '8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}>
              <strong>{inspectQuote.symbol}</strong>: ${inspectQuote.price.toFixed(2)}
              {inspectQuote.dayChangePct != null && (
                <span style={{ marginLeft: '8px', color: inspectQuote.dayChangePct >= 0 ? '#22c55e' : '#ef4444' }}>
                  {inspectQuote.dayChangePct >= 0 ? '+' : ''}{inspectQuote.dayChangePct.toFixed(2)}%
                </span>
              )}
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                Source: <em>{inspectQuote.provider}</em> · {inspectQuote.bid ? `Bid: $${inspectQuote.bid} / Ask: $${inspectQuote.ask}` : 'Market Price'}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Row 2: CSV / Excel Upload Cards */}
      <div className="import-grid">
        <UploadCard title="Manual Portfolio" hint="CSV / EXCEL" accepting={!!isCustomPortfolio}
          onUpload={uploadPortfolio} onReset={resetPortfolio} onDownload={() => downloadCsv('portfolio_template.csv', PORTFOLIO_TEMPLATE)} busy={pBusy}
          sampleText={PORTFOLIO_TEMPLATE} sampleName="portfolio_sample.csv"
          status={<>
            <p className="import-current">{source?.source === 'uploaded' ? <><CheckCircle2 size={14} /> Active: <strong>{source?.name}</strong> · {source?.count} holdings{source && !source.has_signal_inputs && ' · no technical inputs'}</> : isAlpacaActive ? 'Active: Alpaca Paper Broker' : 'Using seeded demo data.'}</p>
            {pMsg && <p className={pMsg.ok ? 'import-ok' : 'import-err'}>{pMsg.text}</p>}
            <Warnings warnings={pMsg?.warnings} />
          </>} />
        <UploadCard title="Watchlist" hint="TO WATCH" accepting={watch?.source === 'uploaded'}
          onUpload={uploadWatchlist} onReset={resetWatchlist} onDownload={() => downloadCsv('watchlist_template.csv', WATCHLIST_TEMPLATE)} busy={wBusy}
          sampleText={WATCHLIST_TEMPLATE} sampleName="watchlist_sample.csv"
          status={<>
            <p className="import-current">{watch?.source === 'uploaded' ? <><CheckCircle2 size={14} /> Active: <strong>{watch?.name}</strong> · {watch?.count} symbols</> : 'No watchlist uploaded yet.'}</p>
            {wMsg && <p className={wMsg.ok ? 'import-ok' : 'import-err'}>{wMsg.text}</p>}
            <Warnings warnings={wMsg?.warnings} />
          </>} />
      </div>

      <div className="import-grid" style={{ marginTop: '16px' }}>
        <section className="panel import-card">
          <div className="section-heading"><div><span className="eyebrow">INTEGRATION</span><h2>Live Ratings Extractor</h2></div></div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px' }}>Poll an external extractor service (HTTP endpoint or local path) to automatically update street consensus scores.</p>
          <div className="import-actions">
            <button className="secondary-button" onClick={() => {
              api.pollRatings().then((res) => alert(`Successfully polled ratings! ${res.imported_rows ?? 0} ratings imported.`))
                .catch((err) => alert(`Poll status: ${err.message}`))
            }}><RefreshCw size={14} /> Poll Extractor Endpoint</button>
          </div>
        </section>

        <section className="panel import-card">
          <div className="section-heading"><div><span className="eyebrow">ALERT DISPATCH</span><h2>Real-Time Webhooks</h2></div></div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px' }}>Test dispatching signal and concentration alert payloads to configured HTTP Webhooks.</p>
          <div className="import-actions">
            <button className="secondary-button" onClick={() => {
              api.testAlert().then((res) => alert(`Alert webhook test: status=${res.status}`))
                .catch((err) => alert(`Dispatch error: ${err.message}`))
            }}>Dispatch Test Alert</button>
          </div>
        </section>
      </div>

      <section className="panel import-help" style={{ marginTop: '16px' }}>
        <span className="eyebrow">ACCEPTED COLUMNS</span>
        <p><strong>Portfolio</strong> — <code>symbol</code> (required), plus optional <code>name, sector, quantity, price, avg_cost, weight, day_change</code>. Exposure is taken from <code>weight</code>, or computed from <code>quantity × price</code>. Optional technical columns drive signals: <code>rsi, macd_bullish, above_sma_50, above_sma_200, relative_volume, breakout_20d, trend_slope_positive</code>. Column names are flexible (Ticker=symbol, Shares=quantity, Cost=avg_cost…). Missing technical columns are never guessed — signals show “needs market data”.</p>
        <p><strong>Watchlist</strong> — <code>symbol</code> (required), plus optional <code>name, sector, note</code>.</p>
      </section>
    </>
  )
}

// Watchlist page: the uploaded watchlist as a simple table.
export function WatchlistPage() {
  const [watch, setWatch] = useState<WatchlistData | null>(null)
  useEffect(() => { api.watchlist().then(setWatch).catch(() => setWatch(null)) }, [])
  const items: WatchlistItem[] = watch?.items ?? []
  return (
    <>
      <PageHeading eyebrow="MONITORING" title="Watchlist" copy="Symbols you are tracking but do not yet hold." />
      {items.length === 0 ? (
        <section className="panel empty-state"><ListChecks size={22} /><h2>No watchlist yet</h2><p>Upload one on the Import page (symbol + optional name, sector, note).</p></section>
      ) : (
        <section className="panel table-panel">
          <div className="table-head watchlist-head"><span>Symbol</span><span>Name</span><span>Sector</span><span>Note</span></div>
          {items.map((item) => (
            <div className="holding-row watchlist-row" key={item.symbol}>
              <span className="asset-cell"><span className="asset-logo">{item.symbol[0]}</span><strong>{item.symbol}</strong></span>
              <span>{item.name || '—'}</span><span>{item.sector || '—'}</span><span className="watchlist-note">{item.note || '—'}</span>
            </div>
          ))}
        </section>
      )}
    </>
  )
}

function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="page-title-row simple"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></div>
}
