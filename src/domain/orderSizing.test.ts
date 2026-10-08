import { describe, expect, it } from 'vitest'
import { calculateBracketPrices, calculateOrderSizing } from './orderSizing'

describe('orderSizing domain', () => {
  it('calculates order sizing correctly based on portfolio allocation percentage', () => {
    // $100,000 portfolio, 3% allocation = $3,000, price = $150 -> 20 shares ($3,000)
    const result = calculateOrderSizing(100000, 3, 150)
    expect(result.shares).toBe(20)
    expect(result.estimatedTotal).toBe(3000)
    expect(result.targetDollarAmount).toBe(3000)
    expect(result.actualAllocationPct).toBe(3)
  })

  it('handles fractional share truncation safely', () => {
    // $50,000 portfolio, 5% allocation = $2,500, price = $68.45 -> floor(2500 / 68.45) = 36 shares ($2,464.2)
    const result = calculateOrderSizing(50000, 5, 68.45)
    expect(result.shares).toBe(36)
    expect(result.estimatedTotal).toBe(2464.2)
  })

  it('calculates bracket prices with +15% profit target and -6% stop loss', () => {
    // Price = $100
    const bracket = calculateBracketPrices(100, 15, 6, 10)
    expect(bracket.takeProfitPrice).toBe(115)
    expect(bracket.stopLossPrice).toBe(94)
    expect(bracket.potentialGainPerShare).toBe(15)
    expect(bracket.potentialLossPerShare).toBe(6)
    expect(bracket.potentialGainTotal).toBe(150)
    expect(bracket.potentialLossTotal).toBe(60)
    expect(bracket.riskRewardRatio).toBe(2.5)
  })
})
