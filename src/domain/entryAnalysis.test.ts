import { describe, expect, it } from 'vitest'
import { assessCandidateEntry } from './entryAnalysis'

describe('assessCandidateEntry', () => {
  it('identifies a STRONG ENTRY candidate when ratings, trend, rsi, and upside align', () => {
    const candidate = {
      symbol: 'NVDA',
      price: 180,
      targetPrice: 225, // 25% upside
      rsi: 48, // ideal buy zone (38-58)
      aboveSma50: true,
      aboveSma200: true,
      macdBullish: true,
      relativeVolume: 1.3,
      breakout20d: true,
      ratingsConsensus: 85, // Strong Buy
      ratingsConsensusLabel: 'Strong Buy',
    }

    const assessment = assessCandidateEntry(candidate)
    expect(assessment.score).toBeGreaterThanOrEqual(80)
    expect(assessment.state).toBe('STRONG ENTRY')
    expect(assessment.criteria.ratingBullish).toBe(true)
    expect(assessment.criteria.rsiInBuyZone).toBe(true)
    expect(assessment.criteria.trendAligned).toBe(true)
    expect(assessment.criteria.volumeActive).toBe(true)
    expect(assessment.criteria.upsideAttractive).toBe(true)
  })

  it('flags WAIT FOR DIP when RSI is heavily overbought', () => {
    const candidate = {
      symbol: 'HOT',
      price: 200,
      targetPrice: 210,
      rsi: 74, // overbought
      aboveSma50: true,
      aboveSma200: true,
      ratingsConsensus: 70,
    }

    const assessment = assessCandidateEntry(candidate)
    expect(assessment.state).toBe('WAIT FOR DIP')
    expect(assessment.criteria.rsiInBuyZone).toBe(false)
  })

  it('evaluates an approaching setup when consolidating near 50 SMA', () => {
    const candidate = {
      symbol: 'CRM',
      price: 260,
      targetPrice: 300,
      rsi: 42,
      aboveSma50: true,
      aboveSma200: true,
      ratingsConsensus: 67.4,
    }

    const assessment = assessCandidateEntry(candidate)
    expect(assessment.score).toBeGreaterThanOrEqual(65)
    expect(['ENTRY', 'APPROACHING', 'STRONG ENTRY']).toContain(assessment.state)
    expect(assessment.criteria.ratingBullish).toBe(true)
    expect(assessment.criteria.rsiInBuyZone).toBe(true)
  })
})
