import { describe, expect, it } from 'vitest'
import {
  convertRecommendationToUserAlert,
  generateAllRecommendations,
  generateTickerRecommendations,
} from './alertRecommendations'
import type { Holding } from '../types'

const mockHolding: Holding = {
  symbol: 'NVDA',
  name: 'NVIDIA Corp',
  sector: 'Semiconductors',
  quantity: 50,
  price: 150.0,
  avgCost: 120.0,
  dayChange: 2.0,
  weight: 12.0,
  rsi: 72.0,
  macdBullish: true,
  aboveSma50: true,
  aboveSma200: true,
  relativeVolume: 1.8,
  breakout20d: true,
  trendSlopePositive: true,
}

describe('alertRecommendations domain service', () => {
  it('generates high-conviction profit target, dip buy, stop loss, and overbought alerts for owned stock', () => {
    const recs = generateTickerRecommendations(
      'NVDA',
      'NVIDIA Corp',
      150.0,
      120.0,
      72.0,
      true,
      true,
      1.8,
      180.0,
      true
    )

    expect(recs.length).toBeGreaterThanOrEqual(3)
    const categories = recs.map((r) => r.category)
    expect(categories).toContain('PROFIT_TARGET')
    expect(categories).toContain('DIP_BUY')
    expect(categories).toContain('STOP_LOSS')
    expect(categories).toContain('RSI_REVERSAL') // Because RSI is 72

    const pt = recs.find((r) => r.category === 'PROFIT_TARGET')!
    expect(pt.targetValue).toBe(180.0)
    expect(pt.potentialDeltaPct).toBe(20.0)
    expect(pt.status).toBe('PENDING')

    const sl = recs.find((r) => r.category === 'STOP_LOSS')!
    expect(sl.targetValue).toBe(112.8) // 120.0 * 0.94 = 112.8 (from bought price $120)
    expect(sl.potentialDeltaPct).toBe(-24.8)
    expect(sl.severity).toBe('critical')
    expect(sl.title).toBe('Protective Stop-Loss (6% from Buy)')
  })

  it('calculates stop-loss from bought price (cost basis) rather than current price', () => {
    // Current price is $15.37, bought price (cost basis) is $28.35
    const recs = generateTickerRecommendations('PLTR', 'Palantir', 15.37, 28.35, 42.0, false, true, 1.1, undefined, true)
    const sl = recs.find((r) => r.category === 'STOP_LOSS')!
    expect(sl.targetValue).toBe(26.65) // 28.35 * 0.94 = 26.649 -> 26.65
    expect(sl.potentialDeltaPct).toBe(73.4)
    expect(sl.title).toBe('Protective Stop-Loss (6% from Buy)')
    expect(sl.rationale).toContain('6.0% below bought price $28.35')
  })

  it('converts recommendation to an armed UserAlert seamlessly', () => {
    const recs = generateTickerRecommendations('PLTR', 'Palantir', 30.0, 25.0, 50.0, true, true, 1.0, 36.0, true)
    const pt = recs.find((r) => r.category === 'PROFIT_TARGET')!

    const userAlert = convertRecommendationToUserAlert(pt)
    expect(userAlert.symbol).toBe('PLTR')
    expect(userAlert.metric).toBe('PRICE')
    expect(userAlert.condition).toBe('ABOVE')
    expect(userAlert.targetValue).toBe(36.0)
    expect(userAlert.status).toBe('ARMED')
  })

  it('supports custom user overrides during conversion', () => {
    const recs = generateTickerRecommendations('PLTR', 'Palantir', 30.0, 25.0, 50.0, true, true, 1.0, 36.0, true)
    const pt = recs.find((r) => r.category === 'PROFIT_TARGET')!

    const customizedAlert = convertRecommendationToUserAlert(pt, {
      targetValue: 40.0,
      severity: 'critical',
    })
    expect(customizedAlert.targetValue).toBe(40.0)
    expect(customizedAlert.severity).toBe('critical')
    expect(customizedAlert.status).toBe('ARMED')
  })

  it('generates all recommendations across holdings and watchlist candidates', () => {
    const all = generateAllRecommendations([mockHolding], [{ symbol: 'CRM', name: 'Salesforce', price: 250.0 }])
    expect(all.length).toBeGreaterThan(0)
    const symbols = new Set(all.map((r) => r.symbol))
    expect(symbols.has('NVDA')).toBe(true)
    expect(symbols.has('CRM')).toBe(true)
  })

  it('safely handles backend snake_case recommendations without throwing in getAlertPlaybook', async () => {
    const { getAlertPlaybook } = await import('./alertPlaybook')
    const backendRec = {
      id: 'rec-SCHY-profit-target',
      symbol: 'SCHY',
      name: 'Schwab International Dividend',
      category: 'PROFIT_TARGET' as const,
      title: '15% Technical Target',
      rationale: 'Technical momentum target at $37.39 (+15.0% expansion).',
      metric: 'PRICE' as const,
      condition: 'ABOVE' as const,
      target_value: 37.39,
      current_value: 32.51,
      severity: 'info' as const,
      status: 'PENDING' as const,
      created_at: '2026-09-21T13:35:56Z',
    }

    // @ts-expect-error test snake_case from backend
    const userAlert = convertRecommendationToUserAlert(backendRec)
    expect(userAlert.targetValue).toBe(37.39)
    expect(userAlert.status).toBe('ARMED')

    // Verify getAlertPlaybook executes without throwing
    const playbook = getAlertPlaybook(userAlert)
    expect(playbook).toBeDefined()
    expect(playbook.whatHappened).toContain('$37.39')
  })
})

