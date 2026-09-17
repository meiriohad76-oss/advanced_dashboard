import { useEffect, useState } from 'react'
import { buildTickerRatings } from '../domain/ratings'
import { api } from '../api/client'
import type { TickerRatings } from '../types'

// Maps a 0-100 normalized consensus onto the shared tone classes (same thresholds
// as RatingsGauge). Kept local so this compact card chip stays self-contained and
// doesn't force an export out of the gauge component (which would trip react-refresh).
function ratingTone(normalized: number): string {
  if (normalized >= 80) return 'strong-buy'
  if (normalized >= 60) return 'buy'
  if (normalized >= 40) return 'hold'
  if (normalized >= 20) return 'sell'
  return 'strong-sell'
}

// Compact external-ratings consensus chip for the Signals cards — the optional
// secondary placement from BL-001 (BL-007). Offline-first like RatingsGauge: render
// the seeded mirror immediately, then upgrade to the API's real (DB-backed) ratings
// when reachable, keeping the seed if the API is offline. Renders nothing when a
// symbol has no external coverage, so cards for uncovered tickers stay clean.
export function RatingsConsensusChip({ symbol }: { symbol: string }) {
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

  if (data.consensus === null || data.consensusLabel === null) return null
  return (
    <span
      className={`consensus-chip mini ${ratingTone(data.consensus)}`}
      title={`External ratings consensus for ${symbol}`}
    >
      {data.consensusLabel} · {data.consensus.toFixed(0)}
    </span>
  )
}
