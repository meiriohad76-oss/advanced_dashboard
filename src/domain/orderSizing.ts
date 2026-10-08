/**
 * Pure calculation domain for portfolio-aware order sizing and bracket execution.
 */

export interface OrderSizingResult {
  targetAllocationPct: number
  targetDollarAmount: number
  shares: number
  estimatedTotal: number
  actualAllocationPct: number
}

export interface BracketPricesResult {
  takeProfitPrice: number
  stopLossPrice: number
  potentialGainPerShare: number
  potentialLossPerShare: number
  potentialGainTotal: number
  potentialLossTotal: number
  riskRewardRatio: number
}

/**
 * Computes suggested share quantity and capital allocation given portfolio size and risk cap.
 */
export function calculateOrderSizing(
  portfolioValue: number,
  allocationPct: number,
  currentPrice: number
): OrderSizingResult {
  const safePortValue = Math.max(0, portfolioValue || 100000)
  const safeAllocPct = Math.min(100, Math.max(0.1, allocationPct))
  const safePrice = Math.max(0.01, currentPrice)

  const targetDollarAmount = (safePortValue * safeAllocPct) / 100
  const shares = Math.max(1, Math.floor(targetDollarAmount / safePrice))
  const estimatedTotal = Math.round(shares * safePrice * 100) / 100
  const actualAllocationPct = Math.round((estimatedTotal / safePortValue) * 10000) / 100

  return {
    targetAllocationPct: safeAllocPct,
    targetDollarAmount: Math.round(targetDollarAmount * 100) / 100,
    shares,
    estimatedTotal,
    actualAllocationPct,
  }
}

/**
 * Calculates bracket orders: profit target and defensive stop loss.
 * Defaults: +15% profit target, -6% stop loss.
 */
export function calculateBracketPrices(
  entryPrice: number,
  profitTargetPct = 15.0,
  stopLossPct = 6.0,
  shares = 1
): BracketPricesResult {
  const safePrice = Math.max(0.01, entryPrice)
  const safeProfitPct = Math.max(0.5, profitTargetPct)
  const safeLossPct = Math.max(0.5, stopLossPct)
  const safeShares = Math.max(1, shares)

  const takeProfitPrice = Math.round(safePrice * (1 + safeProfitPct / 100) * 100) / 100
  const stopLossPrice = Math.round(safePrice * (1 - safeLossPct / 100) * 100) / 100

  const potentialGainPerShare = Math.round((takeProfitPrice - safePrice) * 100) / 100
  const potentialLossPerShare = Math.round((safePrice - stopLossPrice) * 100) / 100

  const potentialGainTotal = Math.round(potentialGainPerShare * safeShares * 100) / 100
  const potentialLossTotal = Math.round(potentialLossPerShare * safeShares * 100) / 100

  const riskRewardRatio = potentialLossPerShare > 0
    ? Math.round((potentialGainPerShare / potentialLossPerShare) * 10) / 10
    : 0

  return {
    takeProfitPrice,
    stopLossPrice,
    potentialGainPerShare,
    potentialLossPerShare,
    potentialGainTotal,
    potentialLossTotal,
    riskRewardRatio,
  }
}
