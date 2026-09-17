import type { Holding, UserAlert } from '../types'

export interface EvaluatedAlert {
  alert: UserAlert
  triggered: boolean
  currentValue: number
  message: string
}

export function evaluateAlert(alert: UserAlert, holding?: Holding): EvaluatedAlert {
  if (!holding || holding.symbol.toUpperCase() !== alert.symbol.toUpperCase()) {
    return {
      alert,
      triggered: alert.status === 'TRIGGERED',
      currentValue: 0,
      message: `${alert.symbol} monitoring trigger (awaiting live market data).`,
    }
  }

  let currentValue = 0
  let triggered = false
  let detail = ''

  switch (alert.metric) {
    case 'PRICE':
      currentValue = holding.price
      if (alert.condition === 'ABOVE' || alert.condition === 'CROSS_ABOVE') {
        triggered = currentValue >= alert.targetValue
        detail = `Price $${currentValue.toFixed(2)} is ${triggered ? 'at/above' : 'below'} target $${alert.targetValue.toFixed(2)}`
      } else {
        triggered = currentValue <= alert.targetValue
        detail = `Price $${currentValue.toFixed(2)} is ${triggered ? 'at/below' : 'above'} target $${alert.targetValue.toFixed(2)}`
      }
      break

    case 'SMA20':
    case 'SMA50':
    case 'SMA150':
      currentValue = holding.aboveSma50 ? 1 : 0
      triggered = alert.condition.includes('ABOVE') ? holding.aboveSma50 : !holding.aboveSma50
      detail = `${alert.metric} trend condition is ${triggered ? 'ACTIVE' : 'not met'} (Price ${holding.aboveSma50 ? 'above' : 'below'} 50d SMA)`
      break

    case 'RSI':
      currentValue = holding.rsi
      if (alert.condition === 'ABOVE' || alert.condition === 'CROSS_ABOVE') {
        triggered = currentValue >= alert.targetValue
        detail = `RSI ${currentValue} is ${triggered ? 'Overbought (>= ' + alert.targetValue + ')' : 'below threshold'}`
      } else {
        triggered = currentValue <= alert.targetValue
        detail = `RSI ${currentValue} is ${triggered ? 'Oversold (<= ' + alert.targetValue + ')' : 'above threshold'}`
      }
      break

    case 'MACD':
      currentValue = holding.macdBullish ? 1 : 0
      triggered = alert.condition.includes('ABOVE') ? holding.macdBullish : !holding.macdBullish
      detail = `MACD is ${holding.macdBullish ? 'Bullish Crossover' : 'Bearish'}`
      break

    case 'VOLUME':
      currentValue = holding.relativeVolume || 1.0
      triggered = currentValue >= alert.targetValue
      detail = `Relative Volume ${currentValue.toFixed(1)}x is ${triggered ? 'Unusual (>= ' + alert.targetValue + 'x)' : 'normal'}`
      break

    case 'STOP_LOSS': {
      const cost = holding.avgCost || holding.price
      const dropPct = cost > 0 ? ((cost - holding.price) / cost) * 100 : 0
      currentValue = dropPct
      triggered = dropPct >= alert.targetValue
      detail = `Position drawdown ${dropPct.toFixed(1)}% ${triggered ? 'exceeded Stop Loss threshold of ' + alert.targetValue + '%' : 'within risk limit'}`
      break
    }

    default:
      currentValue = holding.price
      triggered = false
      detail = 'Monitoring condition'
  }

  return {
    alert: {
      ...alert,
      status: triggered ? 'TRIGGERED' : alert.status,
    },
    triggered,
    currentValue,
    message: detail,
  }
}

export function evaluateAllAlerts(alerts: UserAlert[], holdings: Holding[]): EvaluatedAlert[] {
  const holdingMap = new Map(holdings.map((h) => [h.symbol.toUpperCase(), h]))
  return alerts.map((alert) => evaluateAlert(alert, holdingMap.get(alert.symbol.toUpperCase())))
}
