import { describe, expect, it } from 'vitest'
import { getAlertPlaybook } from './alertPlaybook'
import type { Holding, UserAlert, AlertItem } from '../types'

const mockHolding: Holding = {
  symbol: 'PLTR',
  name: 'Palantir Technologies',
  sector: 'Software',
  quantity: 100,
  price: 15.0,
  avgCost: 20.0,
  dayChange: -2.5,
  weight: 8.0,
  rsi: 38.0,
  macdBullish: false,
  aboveSma50: false,
  aboveSma200: true,
  relativeVolume: 1.6,
  breakout20d: false,
  trendSlopePositive: false,
}

describe('alertPlaybook domain service', () => {
  it('generates clear What Happened and What To Do for a Stop-Loss trigger', () => {
    const slAlert: UserAlert = {
      id: 'sl-1',
      symbol: 'PLTR',
      metric: 'STOP_LOSS',
      condition: 'BELOW',
      targetValue: 14.1,
      severity: 'critical',
      status: 'TRIGGERED',
      createdAt: new Date().toISOString(),
    }

    const playbook = getAlertPlaybook(slAlert, mockHolding)
    expect(playbook.categoryTitle).toContain('Protective Stop-Loss')
    expect(playbook.whatHappened).toContain('PLTR fell to $15.00')
    expect(playbook.whatItMeans).toContain('Capital preservation')
    expect(playbook.checklist.length).toBe(3)
    expect(playbook.checklist[0]).toContain('Step 1')
    expect(playbook.checklist[0]).toContain('execute an immediate')
    expect(playbook.actionUrgency).toBe('immediate')
    expect(playbook.suggestedActionType).toBe('trade')
  })

  it('generates clear What Happened and What To Do for a Profit Target trigger', () => {
    const ptAlert: UserAlert = {
      id: 'pt-1',
      symbol: 'NVDA',
      metric: 'PRICE',
      condition: 'ABOVE',
      targetValue: 180.0,
      severity: 'info',
      status: 'TRIGGERED',
      createdAt: new Date().toISOString(),
    }

    const nvdaHolding: Holding = {
      ...mockHolding,
      symbol: 'NVDA',
      price: 182.0,
      avgCost: 120.0,
      rsi: 74.0,
    }

    const playbook = getAlertPlaybook(ptAlert, nvdaHolding)
    expect(playbook.categoryTitle).toContain('Profit Target')
    expect(playbook.whatHappened).toContain('NVDA advanced to $182.00')
    expect(playbook.checklist[0]).toContain('Lock in gains')
    expect(playbook.checklist[0]).toContain('Sell 25% to 50%')
    expect(playbook.primaryActionLabel).toContain('Lock in Profits')
    expect(playbook.suggestedActionType).toBe('trade')
  })

  it('generates clear What Happened and What To Do for an RSI Dip-Buy trigger', () => {
    const rsiAlert: UserAlert = {
      id: 'rsi-1',
      symbol: 'AMD',
      metric: 'RSI',
      condition: 'BELOW',
      targetValue: 35.0,
      severity: 'info',
      status: 'TRIGGERED',
      createdAt: new Date().toISOString(),
    }

    const amdHolding: Holding = {
      ...mockHolding,
      symbol: 'AMD',
      price: 130.0,
      rsi: 32.0,
    }

    const playbook = getAlertPlaybook(rsiAlert, amdHolding)
    expect(playbook.categoryTitle).toContain('Oversold Dip-Buy')
    expect(playbook.whatHappened).toContain('RSI dropped to 32.0')
    expect(playbook.checklist[1]).toContain('starter tranche')
    expect(playbook.suggestedActionType).toBe('trade')
  })

  it('generates clear What Happened and What To Do for a Portfolio Concentration alert', () => {
    const portAlert: AlertItem = {
      id: 'alert-sec-conc',
      title: 'Sector Concentration Warning',
      message: 'Semiconductor exposure has reached 38.4%, exceeding maximum target ceiling of 35%.',
      status: 'TRIGGERED',
      severity: 'warning',
      time: '10:00 AM',
    }

    const playbook = getAlertPlaybook(portAlert)
    expect(playbook.categoryTitle).toContain('Concentration')
    expect(playbook.whatHappened).toContain('Semiconductor exposure has reached 38.4%')
    expect(playbook.checklist[0]).toContain('Risk Analytics')
    expect(playbook.checklist[1]).toContain('Trim 10% to 20%')
    expect(playbook.suggestedActionType).toBe('rebalance')
  })
})
