import type { Rating, RatingSourceKey, TickerRatings } from '../types'

// TypeScript mirror of backend/app/ratings.py — kept in sync deliberately so the
// gauge renders identically offline and against the API (same pattern as engine.ts).
// Ratings are ingested external facts, not values Atlas computes. Each source has a
// different native scale/direction, so all are normalized to a common 0-100
// "bullishness" axis (100 = Strong Buy). Zacks Rank is inverted (1 = best).

const SEED_AS_OF = '2026-09-09T14:42:00Z'

export const SOURCE_META: { key: RatingSourceKey; display: string }[] = [
  { key: 'zacks', display: 'Zacks Rank' },
  { key: 'sa_quant', display: 'SA Quant' },
  { key: 'sa_analysts', display: 'SA Analysts' },
  { key: 'sa_wall_street', display: 'SA Wall St' },
  { key: 'investing', display: 'Investing.com' },
]

type RawRatings = Partial<Record<RatingSourceKey, number | string | null>>

// Seeded raw ratings. `null` = source did not cover that symbol (renders as an
// explicit "no data" row, never a guess). SPY has gaps on purpose. Replace this
// map with the external extraction project's output when it is integrated.
// AEM / NVO / RIO overlap the external extractor's coverage universe (BL-005) so the
// gauge shows real data once a run is imported. AEM's seed values are the actual
// figures the extractor produced end-to-end (consensus 64.5 "Buy"); Zacks and
// Investing.com were absent in that output, so they render "no data". NVO / RIO have
// no verified figures yet and show "no data" until a live extraction fills them — the
// seed must never fabricate a rating. Mirrors backend/app/ratings.py.
export const RAW_RATINGS: Record<string, RawRatings> = {
  CRDO: { zacks: 2, sa_quant: 4.6, sa_analysts: 4.1, sa_wall_street: 3.9, investing: 'Strong Buy' },
  NVDA: { zacks: 1, sa_quant: 4.8, sa_analysts: 4.5, sa_wall_street: 4.6, investing: 'Strong Buy' },
  MSFT: { zacks: 2, sa_quant: 3.8, sa_analysts: 4.2, sa_wall_street: 4.4, investing: 'Buy' },
  ANET: { zacks: 2, sa_quant: 4.88, sa_analysts: 3.75, sa_wall_street: 4.73, investing: 'Strong Buy' },
  VRT: { zacks: 3, sa_quant: 3.4, sa_analysts: 3.9, sa_wall_street: 4.0, investing: 'Neutral' },
  GOOGL: { zacks: 2, sa_quant: 4.0, sa_analysts: 4.3, sa_wall_street: 4.5, investing: 'Buy' },
  SPY: { zacks: 3, sa_quant: null, sa_analysts: null, sa_wall_street: 3.5, investing: 'Buy' },
  AEM: { zacks: null, sa_quant: 2.8, sa_analysts: 3.75, sa_wall_street: 4.27, investing: null },
  NVO: { zacks: null, sa_quant: null, sa_analysts: null, sa_wall_street: null, investing: null },
  RIO: { zacks: null, sa_quant: null, sa_analysts: null, sa_wall_street: null, investing: null },
}

const ZACKS_LABEL: Record<number, string> = { 1: 'Strong Buy', 2: 'Buy', 3: 'Hold', 4: 'Sell', 5: 'Strong Sell' }
const INVESTING_NORMALIZED: Record<string, number> = { 'Strong Sell': 0, Sell: 25, Neutral: 50, Buy: 75, 'Strong Buy': 100 }

const round1 = (n: number) => Math.round(n * 10) / 10

export const normalizeZacks = (rank: number) => round1(((5 - rank) / 4) * 100)
export const normalizeFive = (value: number) => round1(((value - 1) / 4) * 100)

export function labelFromNormalized(n: number): string {
  if (n >= 80) return 'Strong Buy'
  if (n >= 60) return 'Buy'
  if (n >= 40) return 'Hold'
  if (n >= 20) return 'Sell'
  return 'Strong Sell'
}

// Build one normalized Rating, or null when the source is missing OR the upstream
// value is malformed/out-of-range. RAW_RATINGS is designed to be replaced wholesale
// by the external extraction project's output, so this is the trust boundary for
// unvalidated data: an unknown label or out-of-range number is dropped (treated like
// "no coverage"), never coerced into a guessed bar. Mirrors backend _rating().
function buildRating(key: RatingSourceKey, display: string, raw: number | string | null | undefined): Rating | null {
  if (raw === null || raw === undefined) return null
  if (key === 'zacks') {
    const rank = Math.round(Number(raw))
    if (!Number.isFinite(rank) || rank < 1 || rank > 5) return null
    const normalized = normalizeZacks(rank)
    return { source: key, display, valueNative: String(rank), label: ZACKS_LABEL[rank] ?? labelFromNormalized(normalized), normalized, nativeScale: '1-5 (1 best)', asOf: SEED_AS_OF }
  }
  if (key === 'investing') {
    const text = String(raw).trim()
    const normalized = INVESTING_NORMALIZED[text]
    if (normalized === undefined) return null
    return { source: key, display, valueNative: text, label: text, normalized, nativeScale: 'Strong Sell-Strong Buy', asOf: SEED_AS_OF }
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1 || value > 5) return null
  const normalized = normalizeFive(value)

  const rawStr = String(raw).trim()
  const decimals = rawStr.includes('.') ? rawStr.split('.')[1].length : 0
  const valueNative = (decimals >= 2 || Math.round(value * 100) / 100 !== Math.round(value * 10) / 10)
    ? value.toFixed(2)
    : value.toFixed(1)

  // Seeking Alpha standard rating tiers
  let saLabel = 'Strong Sell'
  if (value >= 4.5) saLabel = 'Strong Buy'
  else if (value >= 3.5) saLabel = 'Buy'
  else if (value >= 2.5) saLabel = 'Hold'
  else if (value >= 1.5) saLabel = 'Sell'

  return { source: key, display, valueNative, label: saLabel, normalized, nativeScale: '1-5 (5 best)', asOf: SEED_AS_OF }
}

import { EXTRACTED_PRICE_TARGETS } from '../data/priceTargets'
import type { PriceTargetInfo } from '../data/priceTargets'

export type { PriceTargetInfo }

export function getPriceTargets(symbol: string, _currentPrice?: number): PriceTargetInfo {
  void _currentPrice
  const sym = symbol.toUpperCase()
  if (EXTRACTED_PRICE_TARGETS[sym]) {
    return EXTRACTED_PRICE_TARGETS[sym]
  }
  return {
    saWallStreet: null,
    saHigh: null,
    saLow: null,
    zacks: null,
    zacksHigh: null,
    zacksLow: null,
  }
}

export function buildTickerRatings(symbol: string): TickerRatings {
  const raw = RAW_RATINGS[symbol.toUpperCase()] ?? {}
  const ratings = SOURCE_META
    .map(({ key, display }) => buildRating(key, display, raw[key]))
    .filter((rating): rating is Rating => rating !== null)
  if (ratings.length === 0) {
    return { symbol: symbol.toUpperCase(), ratings, consensus: null, consensusLabel: null }
  }
  const consensus = round1(ratings.reduce((sum, rating) => sum + rating.normalized, 0) / ratings.length)
  return { symbol: symbol.toUpperCase(), ratings, consensus, consensusLabel: labelFromNormalized(consensus) }
}

