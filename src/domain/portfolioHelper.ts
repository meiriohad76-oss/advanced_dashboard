import { resolveCompanyName } from '../data/companyNames'
import { scenarioHoldings } from '../data/demo'
import { getPriceTargets } from './ratings'
import type { Holding } from '../types'

export function getOrBuildHolding(symbol: string, holdings: Holding[]): Holding {
  const sym = symbol.toUpperCase()
  const inHoldings = holdings.find((h) => h.symbol.toUpperCase() === sym)
  if (inHoldings) return inHoldings

  const inDemo = scenarioHoldings(true).find((h) => h.symbol.toUpperCase() === sym)
  if (inDemo) return inDemo

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
