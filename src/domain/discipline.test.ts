import { describe, expect, it } from 'vitest'
import type { Holding, UserAlert } from '../types'
import { assessHoldingDiscipline, calculateDisciplineScorecard } from './discipline'

describe('Discipline Domain Engine', () => {
  const mockHolding: Holding = {
    symbol: 'ORCL',
    name: 'Oracle Corporation',
    quantity: 100,
    price: 90.0,
    avgCost: 84.0, // Cost basis $84.00
    sector: 'Software',
    dayChange: 1.2,
    weight: 10.0,
    rsi: 50,
    macdBullish: true,
    aboveSma50: true,
    aboveSma200: true,
    relativeVolume: 1.0,
    breakout20d: false,
    trendSlopePositive: true,
  }

  it('calculates default stop loss anchored to bought price (avgCost) when unprotected', () => {
    const discipline = assessHoldingDiscipline(mockHolding, [], [])
    expect(discipline).not.toBeNull()
    if (!discipline) return

    // 84 * 0.94 = 78.96
    expect(discipline.stopLossPrice).toBe(78.96)
    expect(discipline.isStopArmed).toBe(false)
    expect(discipline.stopStatus).toBe('UNPROTECTED')
    // Capital at risk: (84 - 78.96) * 100 = 504
    expect(discipline.capitalAtRisk).toBe(504)
    expect(discipline.hasActionRequired).toBe(false)
  })

  it('recognizes armed stop loss and detects BREACHED status when price drops below stop', () => {
    const armedAlert: UserAlert = {
      id: 'alert-orcl-stop',
      symbol: 'ORCL',
      metric: 'PRICE',
      condition: 'BELOW',
      targetValue: 80.0,
      severity: 'critical',
      status: 'ARMED',
      createdAt: '2026-10-13T00:00:00Z',
    }

    // Holding price is 78.0, which is below armed stop 80.0
    const breachedHolding: Holding = {
      ...mockHolding,
      price: 78.0,
    }

    const discipline = assessHoldingDiscipline(breachedHolding, [armedAlert], [])
    expect(discipline).not.toBeNull()
    if (!discipline) return

    expect(discipline.stopLossPrice).toBe(80.0)
    expect(discipline.isStopArmed).toBe(true)
    expect(discipline.stopStatus).toBe('BREACHED')
    expect(discipline.hasActionRequired).toBe(true)
    expect(discipline.actionDirective).toContain('EXIT NOW')
  })

  it('identifies TARGET_REACHED when market price exceeds take-profit objective', () => {
    const winningHolding: Holding = {
      ...mockHolding,
      price: 110.0, // Bought at 84, now at 110
    }

    const armedTarget: UserAlert = {
      id: 'alert-orcl-target',
      symbol: 'ORCL',
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: 105.0,
      severity: 'info',
      status: 'ARMED',
      createdAt: '2026-10-13T00:00:00Z',
    }

    const discipline = assessHoldingDiscipline(winningHolding, [armedTarget], [])
    expect(discipline).not.toBeNull()
    if (!discipline) return

    expect(discipline.takeProfitPrice).toBe(105.0)
    expect(discipline.takeProfitStatus).toBe('TARGET_REACHED')
    expect(discipline.hasActionRequired).toBe(true)
    expect(discipline.actionDirective).toContain('HARVEST PROFIT')
  })

  it('computes accurate discipline scorecard aggregates', () => {
    const h1: Holding = { ...mockHolding, symbol: 'AAPL', price: 150, avgCost: 150 }
    const h2: Holding = { ...mockHolding, symbol: 'MSFT', price: 300, avgCost: 320 } // losing
    const h3: Holding = { ...mockHolding, symbol: 'NVDA', price: 120, avgCost: 90 } // winning

    const alertH1: UserAlert = {
      id: 'a1',
      symbol: 'AAPL',
      metric: 'STOP_LOSS',
      condition: 'BELOW',
      targetValue: 141,
      severity: 'critical',
      status: 'ARMED',
      createdAt: '2026-10-13T00:00:00Z',
    }

    const items = [
      assessHoldingDiscipline(h1, [alertH1], []),
      assessHoldingDiscipline(h2, [], []),
      assessHoldingDiscipline(h3, [], []),
    ].filter((i): i is NonNullable<typeof i> => i !== null)

    const scorecard = calculateDisciplineScorecard(items)
    expect(scorecard.totalPositions).toBe(3)
    expect(scorecard.protectedPositions).toBe(1)
    expect(scorecard.unprotectedPositions).toBe(2)
    expect(scorecard.defenseCoveragePct).toBe(33) // 1/3 ~ 33%
    expect(scorecard.totalCapitalAtRisk).toBeGreaterThan(0)
  })

  it('ignores CASH holding', () => {
    const cash: Holding = {
      symbol: 'CASH',
      name: 'Cash',
      quantity: 5000,
      price: 1,
      avgCost: 1,
      weight: 5,
      sector: 'Cash',
      dayChange: 0,
      rsi: 50,
      macdBullish: true,
      aboveSma50: true,
      aboveSma200: true,
      relativeVolume: 1.0,
      breakout20d: false,
      trendSlopePositive: true,
    }
    expect(assessHoldingDiscipline(cash, [], [])).toBeNull()
  })
})
