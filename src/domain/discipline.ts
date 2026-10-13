import type { Holding, RecommendedAlert, UserAlert } from '../types'

export type StopLossStatus = 'BREACHED' | 'CRITICAL_ZONE' | 'PROTECTED' | 'UNPROTECTED'
export type TakeProfitStatus = 'TARGET_REACHED' | 'NEAR_TARGET' | 'ARMED' | 'UNARMED'

export interface HoldingDiscipline {
  holding: Holding
  costBasis: number
  currentPrice: number
  marketValue: number
  totalCost: number
  unrealizedPnL: number
  unrealizedPnLPct: number

  // Stop-Loss Defense
  stopLossPrice: number
  isStopArmed: boolean
  armedStopAlertId?: string
  stopDistancePct: number // % price cushion remaining before stop is breached
  capitalAtRisk: number // Maximum dollar risk if stop is triggered against cost basis
  stopStatus: StopLossStatus
  stopRationale: string

  // Take-Profit Target
  takeProfitPrice: number
  isTakeProfitArmed: boolean
  armedTakeProfitAlertId?: string
  targetDistancePct: number // % rise needed to reach target
  targetProfitPotential: number // Expected dollar profit if target is reached
  takeProfitStatus: TakeProfitStatus
  targetRationale: string

  // Action Flags
  hasActionRequired: boolean
  actionDirective?: string
}

export interface DisciplineScorecard {
  totalPositions: number
  protectedPositions: number
  unprotectedPositions: number
  defenseCoveragePct: number
  totalCapitalAtRisk: number
  totalUnrealizedPnL: number
  breachedStopsCount: number
  criticalZoneCount: number
  targetsReachedCount: number
  urgentActionsCount: number
}

/**
 * Assesses an individual holding for strict stop-loss defense and profit-taking discipline.
 */
export function assessHoldingDiscipline(
  holding: Holding,
  userAlerts: UserAlert[] = [],
  recommendations: RecommendedAlert[] = []
): HoldingDiscipline | null {
  if (holding.symbol === 'CASH') return null

  const costBasis = holding.avgCost > 0 ? holding.avgCost : holding.price
  const currentPrice = holding.price
  const marketValue = holding.quantity * currentPrice
  const totalCost = holding.quantity * costBasis
  const unrealizedPnL = marketValue - totalCost
  const unrealizedPnLPct = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

  // 1. Evaluate Stop-Loss Alert
  const armedStop = userAlerts.find(
    (a) =>
      a.symbol.toUpperCase() === holding.symbol.toUpperCase() &&
      (a.metric === 'STOP_LOSS' || (a.metric === 'PRICE' && a.condition === 'BELOW' && a.targetValue < costBasis))
  )

  const stopRec = recommendations.find(
    (r) => r.symbol.toUpperCase() === holding.symbol.toUpperCase() && r.category === 'STOP_LOSS'
  )

  let stopLossPrice: number
  let isStopArmed: boolean
  let armedStopAlertId: string | undefined

  if (armedStop) {
    stopLossPrice = armedStop.targetValue
    isStopArmed = true
    armedStopAlertId = armedStop.id
  } else if (stopRec) {
    stopLossPrice = Number((stopRec.targetValue ?? stopRec.target_value ?? (costBasis * 0.94)).toFixed(2))
    isStopArmed = false
  } else {
    stopLossPrice = Number((costBasis * 0.94).toFixed(2))
    isStopArmed = false
  }

  // Price cushion to stop-loss (positive means safe above stop; negative means breached)
  const stopDistancePct =
    currentPrice > 0 ? Number((((currentPrice - stopLossPrice) / currentPrice) * 100).toFixed(2)) : 0
  const capitalAtRisk =
    costBasis > stopLossPrice
      ? Math.round((costBasis - stopLossPrice) * holding.quantity * 100) / 100
      : Math.round(costBasis * 0.06 * holding.quantity * 100) / 100

  let stopStatus: StopLossStatus
  if (currentPrice <= stopLossPrice) {
    stopStatus = 'BREACHED'
  } else if (stopDistancePct <= 2.0) {
    stopStatus = 'CRITICAL_ZONE'
  } else if (isStopArmed) {
    stopStatus = 'PROTECTED'
  } else {
    stopStatus = 'UNPROTECTED'
  }

  const stopRationale =
    stopStatus === 'BREACHED'
      ? `BREACHED: Market price $${currentPrice.toFixed(2)} is at/below stop $${stopLossPrice.toFixed(2)}. Capital defense directive: Exit immediately.`
      : stopStatus === 'CRITICAL_ZONE'
        ? `CRITICAL: Price $${currentPrice.toFixed(2)} is within ${stopDistancePct.toFixed(1)}% of protective stop $${stopLossPrice.toFixed(2)}.`
        : isStopArmed
          ? `Armed capital protection at $${stopLossPrice.toFixed(2)} (${stopDistancePct.toFixed(1)}% cushion).`
          : `Unprotected: Recommended stop at $${stopLossPrice.toFixed(2)} (-6% from cost basis $${costBasis.toFixed(2)}).`

  // 2. Evaluate Take-Profit Target
  const armedTarget = userAlerts.find(
    (a) =>
      a.symbol.toUpperCase() === holding.symbol.toUpperCase() &&
      a.metric === 'PRICE' &&
      a.condition === 'ABOVE' &&
      a.targetValue > costBasis
  )

  const targetRec = recommendations.find(
    (r) => r.symbol.toUpperCase() === holding.symbol.toUpperCase() && r.category === 'PROFIT_TARGET'
  )

  let takeProfitPrice: number
  let isTakeProfitArmed: boolean
  let armedTakeProfitAlertId: string | undefined

  if (armedTarget) {
    takeProfitPrice = armedTarget.targetValue
    isTakeProfitArmed = true
    armedTakeProfitAlertId = armedTarget.id
  } else if (targetRec) {
    takeProfitPrice = Number((targetRec.targetValue ?? targetRec.target_value ?? (costBasis * 1.15)).toFixed(2))
    isTakeProfitArmed = false
  } else {
    takeProfitPrice = Number((costBasis * 1.15).toFixed(2))
    isTakeProfitArmed = false
  }

  const targetDistancePct =
    currentPrice > 0 ? Number((((takeProfitPrice - currentPrice) / currentPrice) * 100).toFixed(2)) : 0
  const targetProfitPotential =
    takeProfitPrice > costBasis
      ? Math.round((takeProfitPrice - costBasis) * holding.quantity * 100) / 100
      : 0

  let takeProfitStatus: TakeProfitStatus
  if (currentPrice >= takeProfitPrice) {
    takeProfitStatus = 'TARGET_REACHED'
  } else if (targetDistancePct <= 3.0 && targetDistancePct > 0) {
    takeProfitStatus = 'NEAR_TARGET'
  } else if (isTakeProfitArmed) {
    takeProfitStatus = 'ARMED'
  } else {
    takeProfitStatus = 'UNARMED'
  }

  const targetRationale =
    takeProfitStatus === 'TARGET_REACHED'
      ? `TARGET HIT: Market price $${currentPrice.toFixed(2)} has reached the $${takeProfitPrice.toFixed(2)} objective. Harvest gains / trim 50%.`
      : takeProfitStatus === 'NEAR_TARGET'
        ? `NEAR TARGET: Price is within ${targetDistancePct.toFixed(1)}% of target $${takeProfitPrice.toFixed(2)}.`
        : isTakeProfitArmed
          ? `Armed take-profit alert at $${takeProfitPrice.toFixed(2)} (+${targetDistancePct.toFixed(1)}% upside).`
          : `Unarmed objective: Target at $${takeProfitPrice.toFixed(2)} (+${targetDistancePct.toFixed(1)}% gain potential).`

  // 3. Action Directives
  const hasActionRequired = stopStatus === 'BREACHED' || stopStatus === 'CRITICAL_ZONE' || takeProfitStatus === 'TARGET_REACHED'
  let actionDirective: string | undefined

  if (stopStatus === 'BREACHED') {
    actionDirective = `EXIT NOW · Market price breached stop-loss $${stopLossPrice.toFixed(2)}`
  } else if (stopStatus === 'CRITICAL_ZONE') {
    actionDirective = `ALERT · Approaching stop-loss ($${currentPrice.toFixed(2)} vs $${stopLossPrice.toFixed(2)})`
  } else if (takeProfitStatus === 'TARGET_REACHED') {
    actionDirective = `HARVEST PROFIT · Target $${takeProfitPrice.toFixed(2)} reached (+${unrealizedPnLPct.toFixed(1)}% gain)`
  }

  return {
    holding,
    costBasis,
    currentPrice,
    marketValue,
    totalCost,
    unrealizedPnL,
    unrealizedPnLPct,
    stopLossPrice,
    isStopArmed,
    armedStopAlertId,
    stopDistancePct,
    capitalAtRisk,
    stopStatus,
    stopRationale,
    takeProfitPrice,
    isTakeProfitArmed,
    armedTakeProfitAlertId,
    targetDistancePct,
    targetProfitPotential,
    takeProfitStatus,
    targetRationale,
    hasActionRequired,
    actionDirective,
  }
}

/**
 * Computes portfolio-wide discipline KPIs across all assessed holdings.
 */
export function calculateDisciplineScorecard(items: HoldingDiscipline[]): DisciplineScorecard {
  const totalPositions = items.length
  const protectedPositions = items.filter((i) => i.isStopArmed).length
  const unprotectedPositions = totalPositions - protectedPositions
  const defenseCoveragePct = totalPositions > 0 ? Math.round((protectedPositions / totalPositions) * 100) : 100

  const totalCapitalAtRisk = Math.round(items.reduce((sum, i) => sum + i.capitalAtRisk, 0))
  const totalUnrealizedPnL = Math.round(items.reduce((sum, i) => sum + i.unrealizedPnL, 0))

  const breachedStopsCount = items.filter((i) => i.stopStatus === 'BREACHED').length
  const criticalZoneCount = items.filter((i) => i.stopStatus === 'CRITICAL_ZONE').length
  const targetsReachedCount = items.filter((i) => i.takeProfitStatus === 'TARGET_REACHED').length
  const urgentActionsCount = items.filter((i) => i.hasActionRequired).length

  return {
    totalPositions,
    protectedPositions,
    unprotectedPositions,
    defenseCoveragePct,
    totalCapitalAtRisk,
    totalUnrealizedPnL,
    breachedStopsCount,
    criticalZoneCount,
    targetsReachedCount,
    urgentActionsCount,
  }
}
