import type { Holding, RecommendedAlert, UserAlert, WatchlistItem } from '../types'

export function generateTickerRecommendations(
  symbol: string,
  name = '',
  price = 0,
  avgCost?: number,
  rsi = 50,
  aboveSma50 = true,
  aboveSma200 = true,
  relativeVolume = 1.0,
  targetPrice?: number | null,
  isOwned = false
): RecommendedAlert[] {
  const recs: RecommendedAlert[] = []
  const sym = symbol.trim().toUpperCase()
  if (!sym || sym === 'CASH' || price <= 0) return recs

  const now = new Date().toISOString()

  // 1. Profit Target / Exit Trigger
  if (targetPrice && targetPrice > price) {
    const deltaPct = ((targetPrice - price) / price) * 100
    recs.push({
      id: `rec-${sym}-profit-target`,
      symbol: sym,
      name: name || sym,
      category: 'PROFIT_TARGET',
      title: 'Consensus Price Target',
      rationale: `Wall Street consensus target of $${targetPrice.toFixed(2)} (+${deltaPct.toFixed(1)}% upside). Arm a profit-taking / scale-out alert.`,
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: Number(targetPrice.toFixed(2)),
      currentValue: Number(price.toFixed(2)),
      potentialDeltaPct: Number(deltaPct.toFixed(1)),
      severity: 'info',
      status: 'PENDING',
      createdAt: now,
    })
  } else {
    const techTarget = Number((price * 1.15).toFixed(2))
    recs.push({
      id: `rec-${sym}-profit-target`,
      symbol: sym,
      name: name || sym,
      category: 'PROFIT_TARGET',
      title: '15% Technical Target',
      rationale: `Technical extension target at $${techTarget.toFixed(2)} (+15.0% gain). Set trigger to secure profits.`,
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: techTarget,
      currentValue: Number(price.toFixed(2)),
      potentialDeltaPct: 15.0,
      severity: 'info',
      status: 'PENDING',
      createdAt: now,
    })
  }

  // 2. Dip-Buy / Support Entry
  if (aboveSma50) {
    const dipPrice = Number((price * 0.95).toFixed(2))
    const deltaPct = ((dipPrice - price) / price) * 100
    recs.push({
      id: `rec-${sym}-dip-buy`,
      symbol: sym,
      name: name || sym,
      category: 'DIP_BUY',
      title: '50-Day SMA Support Entry',
      rationale: `Pullback near the 50-day moving average support at $${dipPrice.toFixed(2)} (${deltaPct.toFixed(1)}% dip). High-conviction entry zone.`,
      metric: 'PRICE',
      condition: 'BELOW',
      targetValue: dipPrice,
      currentValue: Number(price.toFixed(2)),
      potentialDeltaPct: Number(deltaPct.toFixed(1)),
      severity: 'info',
      status: 'PENDING',
      createdAt: now,
    })
  } else if (rsi > 55) {
    recs.push({
      id: `rec-${sym}-dip-buy`,
      symbol: sym,
      name: name || sym,
      category: 'DIP_BUY',
      title: 'RSI Consolidation Buy-Zone',
      rationale: `RSI is cooling (${rsi.toFixed(0)}). Alert when RSI dips to 42.0 to catch the oversold rebound setup.`,
      metric: 'RSI',
      condition: 'BELOW',
      targetValue: 42.0,
      currentValue: Number(rsi.toFixed(1)),
      potentialDeltaPct: null,
      severity: 'info',
      status: 'PENDING',
      createdAt: now,
    })
  }

  // 3. Stop-Loss (for owned) or Breakout (for watchlist)
  if (isOwned) {
    const stopPrice = Number((price * 0.94).toFixed(2))
    const deltaPct = -6.0
    const costContext = avgCost && avgCost > 0 ? ` (entry cost $${avgCost.toFixed(2)})` : ''
    recs.push({
      id: `rec-${sym}-stop-loss`,
      symbol: sym,
      name: name || sym,
      category: 'STOP_LOSS',
      title: 'Protective Trailing Stop (6%)',
      rationale: `Capital protection trailing stop at $${stopPrice.toFixed(2)} (6.0% below current price $${price.toFixed(2)})${costContext}. Enforces downside discipline.`,
      metric: 'PRICE',
      condition: 'BELOW',
      targetValue: stopPrice,
      currentValue: Number(price.toFixed(2)),
      potentialDeltaPct: deltaPct,
      severity: 'critical',
      status: 'PENDING',
      createdAt: now,
    })
  } else {
    const breakoutPrice = Number((price * 1.035).toFixed(2))
    const deltaPct = ((breakoutPrice - price) / price) * 100
    recs.push({
      id: `rec-${sym}-breakout`,
      symbol: sym,
      name: name || sym,
      category: 'BREAKOUT',
      title: 'Resistance Breakout Trigger',
      rationale: `Key resistance trigger at $${breakoutPrice.toFixed(2)} (+${deltaPct.toFixed(1)}%). Alert when price clears consolidation with volume.`,
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: breakoutPrice,
      currentValue: Number(price.toFixed(2)),
      potentialDeltaPct: Number(deltaPct.toFixed(1)),
      severity: 'info',
      status: 'PENDING',
      createdAt: now,
    })
  }

  // 4. Overbought Warning if RSI >= 68
  if (rsi >= 68) {
    recs.push({
      id: `rec-${sym}-rsi-reversal`,
      symbol: sym,
      name: name || sym,
      category: 'RSI_REVERSAL',
      title: 'RSI Overbought Warning',
      rationale: `RSI is stretched at ${rsi.toFixed(0)}. Alert if RSI touches 75.0 to guard against momentum blow-off tops.`,
      metric: 'RSI',
      condition: 'ABOVE',
      targetValue: 75.0,
      currentValue: Number(rsi.toFixed(1)),
      potentialDeltaPct: null,
      severity: 'warning',
      status: 'PENDING',
      createdAt: now,
    })
  }

  return recs
}

export function generateAllRecommendations(
  holdings: Holding[],
  watchlistItems: Array<WatchlistItem & { price?: number; rsi?: number; targetPrice?: number }> = [],
  savedStatuses: Record<string, 'PENDING' | 'ACKNOWLEDGED' | 'DECLINED'> = {}
): RecommendedAlert[] {
  const allRecs: RecommendedAlert[] = []
  const seenIds = new Set<string>()

  // 1. Holdings
  for (const h of holdings) {
    if (h.symbol === 'CASH' || h.price <= 0) continue
    const recs = generateTickerRecommendations(
      h.symbol,
      h.name,
      h.price,
      h.avgCost,
      h.rsi,
      h.aboveSma50,
      h.aboveSma200,
      h.relativeVolume,
      undefined,
      true
    )
    for (const r of recs) {
      if (!seenIds.has(r.id)) {
        if (savedStatuses[r.id]) {
          r.status = savedStatuses[r.id]
        }
        seenIds.add(r.id)
        allRecs.push(r)
      }
    }
  }

  // 2. Watchlist
  const holdingSyms = new Set(holdings.map((h) => h.symbol.toUpperCase()))
  for (const w of watchlistItems) {
    const sym = w.symbol.toUpperCase()
    if (!sym || holdingSyms.has(sym)) continue
    const price = w.price || 50.0
    const rsi = w.rsi || 50.0
    const recs = generateTickerRecommendations(
      sym,
      w.name || sym,
      price,
      undefined,
      rsi,
      true,
      true,
      1.0,
      w.targetPrice,
      false
    )
    for (const r of recs) {
      if (!seenIds.has(r.id)) {
        if (savedStatuses[r.id]) {
          r.status = savedStatuses[r.id]
        }
        seenIds.add(r.id)
        allRecs.push(r)
      }
    }
  }

  return allRecs
}

export function convertRecommendationToUserAlert(
  rec: RecommendedAlert,
  customOverrides?: Partial<UserAlert>
): UserAlert {
  return {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    symbol: rec.symbol.toUpperCase(),
    metric: customOverrides?.metric || rec.metric,
    condition: customOverrides?.condition || rec.condition,
    targetValue: customOverrides?.targetValue !== undefined ? Number(customOverrides.targetValue) : rec.targetValue,
    severity: customOverrides?.severity || rec.severity,
    status: 'ARMED',
    createdAt: new Date().toISOString(),
    title: customOverrides?.title || rec.title,
    category: customOverrides?.category || rec.category,
    rationale: customOverrides?.rationale || rec.rationale,
  }
}
