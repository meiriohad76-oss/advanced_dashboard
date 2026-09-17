import { useEffect, useState } from 'react'
import { Database, Info } from 'lucide-react'
import { SOURCE_META, buildTickerRatings } from '../domain/ratings'
import { api } from '../api/client'
import type { Rating, TickerRatings } from '../types'

// Maps a 0-100 normalized rating onto a shared tone so every source and the
// blended consensus read in the same visual direction (Zacks included).
function ratingTone(normalized: number): string {
  if (normalized >= 80) return 'strong-buy'
  if (normalized >= 60) return 'buy'
  if (normalized >= 40) return 'hold'
  if (normalized >= 20) return 'sell'
  return 'strong-sell'
}

function formatAsOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MeterRow({ display, rating }: { display: string; rating: Rating | undefined }) {
  if (!rating) {
    return (
      <div className="rating-meter no-data">
        <div className="rating-meter-top"><span>{display}</span><strong>—</strong></div>
        <div className="rating-track" aria-hidden="true"><span className="empty" /></div>
        <div className="rating-meter-foot"><small>No data</small></div>
      </div>
    )
  }
  const tone = ratingTone(rating.normalized)
  return (
    <div className="rating-meter">
      <div className="rating-meter-top"><span>{rating.display}</span><strong>{rating.valueNative}</strong></div>
      <div className="rating-track" role="meter" aria-label={rating.display} aria-valuenow={rating.normalized} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${rating.label}, ${rating.normalized} of 100`}>
        <span className={tone} style={{ width: `${rating.normalized}%` }} />
      </div>
      <div className="rating-meter-foot"><small className={`rating-label ${tone}`}>{rating.label}</small><small className="scale">{rating.nativeScale}</small></div>
    </div>
  )
}

export function RatingsGauge({ symbol }: { symbol: string }) {
  // Offline-first: render the seeded mirror immediately, then upgrade to the API's
  // real (DB-backed) ratings when reachable; keep the seed if the API is offline.
  const [data, setData] = useState<TickerRatings>(() => buildTickerRatings(symbol))
  useEffect(() => {
    let alive = true
    const fetchRatings = () => {
      api.ratings(symbol).then((real) => { if (alive) setData(real) }).catch(() => { /* keep seed */ })
    }
    setData(buildTickerRatings(symbol))
    fetchRatings()
    window.addEventListener('atlas:ratings-synced', fetchRatings)
    return () => {
      alive = false
      window.removeEventListener('atlas:ratings-synced', fetchRatings)
    }
  }, [symbol])
  const { ratings, consensus, consensusLabel } = data

  if (ratings.length === 0) {
    return (
      <section className="drawer-section ratings-gauge">
        <div className="section-heading"><div><span className="eyebrow">EXTERNAL RATINGS</span><h3>Street &amp; quant consensus</h3></div></div>
        <p className="ratings-empty"><Info size={15} /> No external ratings for {symbol}.</p>
      </section>
    )
  }

  const bySource = new Map(ratings.map((rating) => [rating.source, rating]))

  return (
    <section className="drawer-section ratings-gauge">
      <div className="section-heading">
        <div><span className="eyebrow">EXTERNAL RATINGS</span><h3>Street &amp; quant consensus</h3></div>
        {consensus !== null && (
          <span className={`consensus-chip ${ratingTone(consensus)}`}>{consensusLabel} · {consensus.toFixed(0)}</span>
        )}
      </div>
      <div className="rating-meters">
        {SOURCE_META.map(({ key, display }) => (
          <MeterRow key={key} display={display} rating={bySource.get(key)} />
        ))}
      </div>
      <p className="ratings-provenance">
        <Database size={13} /> External sources · normalized to a common Strong&nbsp;Sell→Strong&nbsp;Buy axis · as of {formatAsOf(ratings[0].asOf)}
      </p>
    </section>
  )
}
