import { describe, expect, it } from 'vitest'
import { RAW_RATINGS, buildTickerRatings, getPriceTargets, labelFromNormalized, normalizeFive, normalizeZacks } from './ratings'

describe('ratings engine', () => {
  it('normalizes every source onto the same higher-is-better axis', () => {
    // Zacks is inverted (1 = best) but must land on the same axis as the rest.
    expect(normalizeZacks(1)).toBe(100)
    expect(normalizeZacks(5)).toBe(0)
    expect(normalizeZacks(3)).toBe(50)
    expect(normalizeFive(5)).toBe(100)
    expect(normalizeFive(1)).toBe(0)
    expect(labelFromNormalized(83)).toBe('Strong Buy')
    expect(labelFromNormalized(50)).toBe('Hold')
  })

  it('builds five ratings and a blended consensus for a fully covered symbol', () => {
    const result = buildTickerRatings('CRDO')
    expect(result.ratings.map((r) => r.source)).toEqual(['zacks', 'sa_quant', 'sa_analysts', 'sa_wall_street', 'investing'])
    expect(result.consensus).toBe(83)
    expect(result.consensusLabel).toBe('Strong Buy')
    expect(result.ratings[0]).toMatchObject({ valueNative: '2', label: 'Buy', normalized: 75 })
  })

  it('drops missing sources without guessing (SPY has gaps)', () => {
    const result = buildTickerRatings('SPY')
    expect(result.ratings.map((r) => r.source)).toEqual(['zacks', 'sa_wall_street', 'investing'])
    expect(result.consensus).not.toBeNull()
  })

  it('drops malformed upstream values instead of guessing', () => {
    // Simulate real extracted data with bad values (out-of-range + unknown label).
    RAW_RATINGS.TEST = { zacks: 9, sa_quant: 7.5, sa_analysts: 3.0, sa_wall_street: null, investing: 'Outperform' }
    try {
      const result = buildTickerRatings('TEST')
      expect(result.ratings.map((r) => r.source)).toEqual(['sa_analysts'])
      expect(result.ratings[0].normalized).toBe(50)
    } finally {
      delete RAW_RATINGS.TEST
    }
  })

  it('handles categorical Seeking Alpha string ratings without numeric score', () => {
    RAW_RATINGS.CAT = { sa_quant: 'Hold', sa_analysts: 'Buy', sa_wall_street: 'Strong Buy' }
    try {
      const result = buildTickerRatings('CAT')
      const bySource = Object.fromEntries(result.ratings.map((r) => [r.source, r]))
      expect(bySource.sa_quant).toMatchObject({ label: 'Hold', normalized: 50, valueNative: '3.0' })
      expect(bySource.sa_analysts).toMatchObject({ label: 'Buy', normalized: 75, valueNative: '4.0' })
      expect(bySource.sa_wall_street).toMatchObject({ label: 'Strong Buy', normalized: 95, valueNative: '4.8' })
    } finally {
      delete RAW_RATINGS.CAT
    }
  })

  it('returns an empty set for an uncovered symbol', () => {
    const result = buildTickerRatings('CASH')
    expect(result.ratings).toHaveLength(0)
    expect(result.consensus).toBeNull()
    expect(result.consensusLabel).toBeNull()
  })

  it('provides accurate Zacks and Wall Street targets for AEM', () => {
    const targets = getPriceTargets('AEM', 180.48)
    expect(targets.zacks).toBe(220.78)
    expect(targets.saWallStreet).toBe(214.89)
    expect(targets.saHigh).toBe(300.0)
    expect(targets.saLow).toBe(87.0)
  })
})
