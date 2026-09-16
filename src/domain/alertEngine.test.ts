import { describe, expect, it } from 'vitest'
import { evaluateAlert, evaluateAllAlerts } from './alertEngine'
import type { Holding, UserAlert } from '../types'

const sampleHolding: Holding = {
  symbol: 'NVDA',
  name: 'NVIDIA Corp',
  sector: 'Semiconductors',
  quantity: 100,
  price: 200.0,
  avgCost: 150.0,
  dayChange: 2.5,
  weight: 15.0,
  rsi: 72,
  macdBullish: true,
  aboveSma50: true,
  aboveSma200: true,
  relativeVolume: 2.4,
  breakout20d: true,
  trendSlopePositive: true,
  hasSignalInputs: true,
}

describe('alertEngine', () => {
  it('triggers price alert when price crosses above target', () => {
    const alert: UserAlert = {
      id: 'a1',
      symbol: 'NVDA',
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: 190.0,
      severity: 'critical',
      status: 'ARMED',
      createdAt: '2026-09-15T00:00:00Z',
    }

    const result = evaluateAlert(alert, sampleHolding)
    expect(result.triggered).toBe(true)
    expect(result.alert.status).toBe('TRIGGERED')
  })

  it('does not trigger price alert when price is below target', () => {
    const alert: UserAlert = {
      id: 'a2',
      symbol: 'NVDA',
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: 220.0,
      severity: 'critical',
      status: 'ARMED',
      createdAt: '2026-09-15T00:00:00Z',
    }

    const result = evaluateAlert(alert, sampleHolding)
    expect(result.triggered).toBe(false)
    expect(result.alert.status).toBe('ARMED')
  })

  it('triggers RSI overbought alert correctly', () => {
    const alert: UserAlert = {
      id: 'a3',
      symbol: 'NVDA',
      metric: 'RSI',
      condition: 'ABOVE',
      targetValue: 70,
      severity: 'warning',
      status: 'ARMED',
      createdAt: '2026-09-15T00:00:00Z',
    }

    const result = evaluateAlert(alert, sampleHolding)
    expect(result.triggered).toBe(true)
    expect(result.currentValue).toBe(72)
  })

  it('evaluates all alerts in batch across holdings', () => {
    const alerts: UserAlert[] = [
      {
        id: 'a1',
        symbol: 'NVDA',
        metric: 'PRICE',
        condition: 'ABOVE',
        targetValue: 190.0,
        severity: 'critical',
        status: 'ARMED',
        createdAt: '2026-09-15T00:00:00Z',
      },
      {
        id: 'a2',
        symbol: 'CRDO',
        metric: 'PRICE',
        condition: 'ABOVE',
        targetValue: 150.0,
        severity: 'warning',
        status: 'ARMED',
        createdAt: '2026-09-15T00:00:00Z',
      },
    ]

    const evaluated = evaluateAllAlerts(alerts, [sampleHolding])
    expect(evaluated).toHaveLength(2)
    expect(evaluated[0].triggered).toBe(true)
    expect(evaluated[1].triggered).toBe(false)
  })
})
