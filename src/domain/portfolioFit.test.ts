import { describe, expect, it } from 'vitest'
import { computeCorrelation, computePortfolioFit } from './portfolioFit'
import { assessHolding } from './engine'
import { baseHoldings, scenarioHoldings } from '../data/demo'

const bySymbol = (holdings = baseHoldings, symbol: string) => holdings.find((h) => h.symbol === symbol)!

describe('portfolio fit', () => {
  const noReturns = baseHoldings.map((h) => ({ ...h, returnsHistory: undefined }))

  it('gives a diversifier a perfect fit and no adjustment', () => {
    const fit = computePortfolioFit(bySymbol(noReturns, 'SPY'), noReturns)
    expect(fit.fitScore).toBe(100)
    expect(fit.concentrationAdjustment).toBe(0)
    expect(fit.combinedScore).toBe(fit.technicalScore)
    expect(fit.factors.every((f) => !f.breached)).toBe(true)
  })

  it('penalizes an over-limit sector member and matches the backend golden values', () => {
    const crdo = bySymbol(noReturns, 'CRDO')
    const fit = computePortfolioFit(crdo, noReturns)
    expect(fit.technicalScore).toBe(assessHolding(crdo).score)
    expect(fit.technicalScore).toBe(65)
    expect(fit.fitScore).toBe(94)
    expect(fit.concentrationAdjustment).toBe(-6)
    expect(fit.combinedScore).toBe(59)
    const sector = fit.factors.find((f) => f.label === 'Sector exposure')!
    expect(sector.breached).toBe(true)
    expect(sector.detail).toContain('Semiconductors')
    expect(fit.explanation.some((line) => line.includes('Portfolio Fit'))).toBe(true)
    expect(fit.correlationAvailable).toBe(false)
  })

  it('keeps the adjustment relationship and bounded scores for every holding', () => {
    for (const holding of baseHoldings) {
      const fit = computePortfolioFit(holding, baseHoldings)
      expect(fit.concentrationAdjustment).toBe(fit.fitScore - 100)
      expect(fit.fitScore).toBeGreaterThanOrEqual(0)
      expect(fit.fitScore).toBeLessThanOrEqual(100)
      expect(fit.combinedScore).toBeGreaterThanOrEqual(0)
      expect(fit.combinedScore).toBeLessThanOrEqual(100)
      expect(fit.concentrationAdjustment).toBeLessThanOrEqual(0)
    }
  })

  it('tracks the technical move in the demo scenario', () => {
    const active = scenarioHoldings(true).map((h) => ({ ...h, returnsHistory: undefined }))
    const fit = computePortfolioFit(bySymbol(active, 'CRDO'), active)
    expect(fit.technicalScore).toBe(90)
    expect(fit.concentrationAdjustment).toBe(-6)
    expect(fit.combinedScore).toBe(84)
  })

  it('calculates Pearson correlation coefficient and sets correlationAvailable when history is present', () => {
    expect(computeCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBe(1.0)
    expect(computeCorrelation([1, 2, 3, 4], [-1, -2, -3, -4])).toBe(-1.0)

    const h1 = { ...baseHoldings[0], returnsHistory: [0.01, 0.02, -0.01, 0.03, 0.01] }
    const h2 = { ...baseHoldings[1], returnsHistory: [0.01, 0.02, -0.01, 0.03, 0.01] }
    const fit = computePortfolioFit(h1, [h1, h2])
    expect(fit.correlationAvailable).toBe(true)
    expect(fit.explanation.some((line) => line.toLowerCase().includes('correlation'))).toBe(true)
  })
})

