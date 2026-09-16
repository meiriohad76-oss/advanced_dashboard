import type { FitFactor, Holding, PortfolioFit } from '../types'
import { assessHolding, classifyScore } from './engine'

// Portfolio-aware signal adjustment (spec section 25) + deterministic explanation
// (spec section 73). This is the offline-first mirror of backend/app/portfolio_fit.py:
// the same limits, the same formula, the same explanation — so the dashboard shows the
// portfolio-fit triad locally (exactly like the technical score via assessHolding),
// upgrading to nothing external because every input is already in the holdings list.
//
// Keep this in lockstep with the Python module; the vitest + pytest suites assert the
// same golden values (CRDO fit 94 / adjustment -6).

export const RISK_LIMITS = { maxSinglePositionPct: 20.0, maxTop5Pct: 70.0, maxSectorPct: 35.0 }
export const POINTS_PER_EXCESS_PCT = 10.0

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const round2 = (value: number) => Math.round(value * 100) / 100

function sectorWeights(holdings: Holding[]): Record<string, number> {
  return holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.sector] = (acc[h.sector] ?? 0) + h.weight
    return acc
  }, {})
}

export function computeCorrelation(returnsA: number[], returnsB: number[]): number {
  const n = Math.min(returnsA.length, returnsB.length)
  if (n < 2) return 0.0
  const meanA = returnsA.slice(0, n).reduce((a, b) => a + b, 0) / n
  const meanB = returnsB.slice(0, n).reduce((a, b) => a + b, 0) / n
  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    const diffA = returnsA[i] - meanA
    const diffB = returnsB[i] - meanB
    cov += diffA * diffB
    varA += diffA * diffA
    varB += diffB * diffB
  }
  const denom = Math.sqrt(varA * varB)
  if (denom === 0) return 0.0
  return Math.max(-1.0, Math.min(1.0, round2(cov / denom)))
}

export function computePortfolioFit(holding: Holding, holdings: Holding[]): PortfolioFit {
  const technical = assessHolding(holding).score
  const { maxSectorPct, maxSinglePositionPct, maxTop5Pct } = RISK_LIMITS

  const sectors = sectorWeights(holdings)
  const sectorTotal = sectors[holding.sector] ?? holding.weight
  const factors: FitFactor[] = []

  // 1. Sector limit — shared in proportion to the holding's weight within its sector.
  const sectorOverage = Math.max(0, sectorTotal - maxSectorPct)
  const sectorShare = sectorTotal > 0 ? holding.weight / sectorTotal : 0
  const sectorAttr = round2(sectorOverage * sectorShare)
  factors.push({
    label: 'Sector exposure',
    detail: sectorOverage > 0
      ? `${holding.sector} is ${sectorTotal.toFixed(1)}% of the book, ${sectorOverage.toFixed(1)}% over the ${maxSectorPct.toFixed(0)}% limit; ${holding.symbol} is ${(sectorShare * 100).toFixed(0)}% of that sector, so it carries ${sectorAttr.toFixed(1)}% of the excess.`
      : `${holding.sector} is ${sectorTotal.toFixed(1)}% of the book, within the ${maxSectorPct.toFixed(0)}% limit.`,
    points: sectorAttr,
    breached: sectorOverage > 0,
  })

  // 2. Single-position limit.
  const positionAttr = round2(Math.max(0, holding.weight - maxSinglePositionPct))
  factors.push({
    label: 'Position size',
    detail: positionAttr > 0
      ? `Position weight ${holding.weight.toFixed(1)}% is ${positionAttr.toFixed(1)}% over the ${maxSinglePositionPct.toFixed(0)}% single-position limit.`
      : `Position weight ${holding.weight.toFixed(1)}% is within the ${maxSinglePositionPct.toFixed(0)}% single-position limit.`,
    points: positionAttr,
    breached: positionAttr > 0,
  })

  // 3. Top-5 block limit — only members of the top-5 block share its overage.
  const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
  const top5 = sorted.slice(0, 5).reduce((sum, h) => sum + h.weight, 0)
  const top5Symbols = new Set(sorted.slice(0, 5).map((h) => h.symbol))
  const top5Overage = Math.max(0, top5 - maxTop5Pct)
  const inTop5 = top5Symbols.has(holding.symbol) && top5Overage > 0 && top5 > 0
  const top5Attr = inTop5 ? round2(top5Overage * (holding.weight / top5)) : 0
  factors.push({
    label: 'Top-5 concentration',
    detail: inTop5
      ? `Top-5 holdings total ${top5.toFixed(1)}%, ${top5Overage.toFixed(1)}% over the ${maxTop5Pct.toFixed(0)}% limit; ${holding.symbol} carries ${top5Attr.toFixed(1)}% of the excess.`
      : `Top-5 holdings total ${top5.toFixed(1)}%, within the ${maxTop5Pct.toFixed(0)}% limit.`,
    points: top5Attr,
    breached: inTop5,
  })

  // 4. Optional Systemic Correlation (Spec Section 37).
  const returns = (holding as unknown as { returnsHistory?: number[] }).returnsHistory
  const correlationAvailable = Array.isArray(returns) && returns.length >= 5
  let corrAttr = 0
  let corrVal = 0
  if (correlationAvailable && returns) {
    const nPts = returns.length
    const portfolioReturns = new Array(nPts).fill(0)
    const validHoldings = holdings.filter((h) => Array.isArray((h as unknown as { returnsHistory?: number[] }).returnsHistory))
    const totalWeight = validHoldings.reduce((sum, h) => sum + h.weight, 0) || 1.0
    for (const h of validHoldings) {
      const hRet = (h as unknown as { returnsHistory?: number[] }).returnsHistory!
      if (hRet.length === nPts) {
        const wNorm = h.weight / totalWeight
        for (let t = 0; t < nPts; t++) {
          portfolioReturns[t] += wNorm * hRet[t]
        }
      }
    }
    corrVal = computeCorrelation(returns, portfolioReturns)
    if (corrVal > 0.70) {
      corrAttr = round2((corrVal - 0.70) * 10.0)
      factors.push({
        label: 'Systemic correlation',
        detail: `Returns correlation with portfolio is +${corrVal.toFixed(2)}, ${corrAttr.toFixed(1)}% drag above the +0.70 threshold.`,
        points: corrAttr,
        breached: true,
      })
    } else {
      factors.push({
        label: 'Systemic correlation',
        detail: `Returns correlation with portfolio is +${corrVal.toFixed(2)}, within the +0.70 threshold.`,
        points: 0,
        breached: false,
      })
    }
  }

  const drag = round2(sectorAttr + positionAttr + top5Attr + corrAttr)
  const fitScore = clampScore(100 - drag * POINTS_PER_EXCESS_PCT)
  const concentrationAdjustment = fitScore - 100
  const combinedScore = clampScore(technical + concentrationAdjustment)

  const explanation = factors.map((f) => f.detail)
  if (correlationAvailable) {
    explanation.push(`Portfolio returns correlation is +${corrVal.toFixed(2)} (evaluated over ${returns!.length}-day return series).`)
  } else {
    explanation.push('Correlation with the portfolio needs a price history this dataset does not carry, so it is excluded rather than estimated.')
  }

  explanation.push(concentrationAdjustment < 0
    ? `Portfolio Fit ${fitScore}/100 → ${concentrationAdjustment} applied to the technical score (${technical} → ${combinedScore}).`
    : `No concentration drag — Portfolio Fit is ${fitScore}/100 and the combined score equals the technical score.`)

  return {
    symbol: holding.symbol,
    technicalScore: technical,
    fitScore,
    concentrationAdjustment,
    combinedScore,
    combinedState: classifyScore(combinedScore),
    factors,
    explanation,
    correlationAvailable,
  }
}
