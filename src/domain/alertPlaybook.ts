import type { AlertItem, Holding, UserAlert } from '../types'

export interface AlertPlaybook {
  // 1. What is this alert about?
  categoryTitle: string
  whatHappened: string
  conditionDetail: string
  
  // 2. Strategic Context (What it means)
  whatItMeans: string
  technicalContext: string
  
  // 3. Action Playbook (What you should do now)
  primaryActionLabel: string
  actionUrgency: 'immediate' | 'high' | 'moderate' | 'review'
  checklist: string[]
  suggestedActionType: 'trade' | 'rebalance' | 'decision' | 'inspect'
}

export function getAlertPlaybook(
  alert: UserAlert | AlertItem,
  holding?: Holding
): AlertPlaybook {
  const isUserAlert = 'metric' in alert && 'createdAt' in alert
  const symbol = (alert.symbol || (holding ? holding.symbol : 'PORTFOLIO')).toUpperCase()
  const price = holding ? holding.price : 0
  const rsi = holding ? holding.rsi : 50
  const avgCost = holding ? holding.avgCost || price : price

  // Case A: Portfolio-level alerts
  if (!symbol || symbol === 'PORTFOLIO' || !isUserAlert) {
    const titleLower = alert.title?.toLowerCase() || ''
    const msgLower = (alert as AlertItem).message?.toLowerCase() || ''

    if (titleLower.includes('concentration') || titleLower.includes('exposure') || msgLower.includes('concentration') || msgLower.includes('sector')) {
      return {
        categoryTitle: 'Portfolio Exposure & Concentration Breach',
        whatHappened: (alert as AlertItem).message || 'Single sector or asset allocation has exceeded prudential diversification limits.',
        conditionDetail: 'Risk exposure ceiling breached (>35% sector concentration limit).',
        whatItMeans: 'A large concentration in one sector creates asymmetric downside vulnerability to sector-specific shocks (e.g. semiconductor downcycles or regulatory news).',
        technicalContext: 'High concentration directly elevates portfolio beta and 95% Parametric VaR, eroding capital preservation safeguards.',
        primaryActionLabel: 'Rebalance Portfolio Exposures',
        actionUrgency: 'high',
        checklist: [
          'Review Sector Exposure breakdown in Risk Analytics to identify the largest overweight positions.',
          'Trim 10% to 20% from the most extended sector leaders to bring sector weighting under the 35% ceiling.',
          'Reallocate trimmed capital to cash reserves or underweight defensive/value positions.',
        ],
        suggestedActionType: 'rebalance',
      }
    }

    if (titleLower.includes('drawdown') || titleLower.includes('shock') || titleLower.includes('var') || msgLower.includes('var')) {
      return {
        categoryTitle: 'Portfolio Value-at-Risk / Downside Alert',
        whatHappened: (alert as AlertItem).message || 'Portfolio drawdown or Value-at-Risk threshold has been tested.',
        conditionDetail: 'Drawdown limit triggered against baseline portfolio equity.',
        whatItMeans: 'Aggregate portfolio risk has accelerated. Continuing with current position sizes risks breaching maximum permissible risk drawdown.',
        technicalContext: 'Broad market volatility is transmitting directly to portfolio holdings via high-beta exposure.',
        primaryActionLabel: 'Open Risk Stress Simulator',
        actionUrgency: 'immediate',
        checklist: [
          'Run the -10% to -20% Market Shock Simulator in Risk Analytics to project dollar impact across holdings.',
          'Evaluate trailing stop readiness across all top-5 positions.',
          'Consider raising portfolio cash buffer to 10-15% until market volatility stabilizes.',
        ],
        suggestedActionType: 'decision',
      }
    }

    // Default portfolio/general alert
    return {
      categoryTitle: alert.title || 'Operational Portfolio Monitor',
      whatHappened: (alert as AlertItem).message || 'Operational trigger fired based on automated portfolio rules.',
      conditionDetail: `Alert status: ${alert.status} (${alert.severity} priority).`,
      whatItMeans: 'The system identified a state change that warrants operational review by the portfolio manager.',
      technicalContext: 'Triggered during real-time valuation and risk aggregation cycle.',
      primaryActionLabel: 'Review Portfolio Analytics',
      actionUrgency: alert.severity === 'critical' ? 'immediate' : 'review',
      checklist: [
        'Inspect triggered telemetry and verify data source integrity.',
        'Assess whether holding weights or risk scores require manual adjustment.',
        'Archive or acknowledge the alert once reviewed.',
      ],
      suggestedActionType: 'rebalance',
    }
  }

  // Case B: UserAlert on a specific stock
  const ua = alert as UserAlert
  const metric = ua.metric
  const condition = ua.condition
  const target = ua.targetValue
  const isAbove = condition.includes('ABOVE')

  // 1. STOP LOSS / DRAWDOWN
  if (metric === 'STOP_LOSS' || (metric === 'PRICE' && !isAbove && (ua.category === 'STOP_LOSS' || ua.severity === 'critical'))) {
    const currentPriceStr = price > 0 ? `$${price.toFixed(2)}` : 'Market'
    const targetPriceStr = `$${target.toFixed(2)}`
    const pnlPct = avgCost > 0 && price > 0 ? ((price - avgCost) / avgCost) * 100 : 0

    return {
      categoryTitle: 'Protective Stop-Loss Directive',
      whatHappened: `${symbol} fell to ${currentPriceStr}, breaching the protective trailing stop threshold of ${targetPriceStr} (${ua.severity === 'critical' ? 'Emergency' : 'Standard'} stop).`,
      conditionDetail: `Rule: Price <= ${targetPriceStr} | Position P&L: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% vs cost basis ($${avgCost.toFixed(2)}).`,
      whatItMeans: 'The stock has violated technical support or your maximum risk tolerance. Capital preservation requires disciplined risk containment.',
      technicalContext: holding ? `Price is ${holding.aboveSma50 ? 'above' : 'below'} 50-day SMA, RSI is ${rsi.toFixed(0)}, indicating ${rsi < 40 ? 'oversold downside breakdown' : 'downside selling pressure'}.` : 'Technical breakdown below risk threshold.',
      primaryActionLabel: 'Enforce Stop Loss (Trim/Exit)',
      actionUrgency: 'immediate',
      checklist: [
        `Step 1: Enforce risk discipline — execute an immediate market or tight limit sell to close or trim ${symbol}.`,
        'Step 2: Do NOT average down or add to this position while downside momentum is active.',
        'Step 3: Move proceeds to cash or wait for a confirmed consolidation base before reconsidering.',
      ],
      suggestedActionType: 'trade',
    }
  }

  // 2. PROFIT TARGET (PRICE ABOVE)
  if (metric === 'PRICE' && isAbove) {
    const currentPriceStr = price > 0 ? `$${price.toFixed(2)}` : 'Market'
    const targetPriceStr = `$${target.toFixed(2)}`
    const gainPct = avgCost > 0 && price > 0 ? ((price - avgCost) / avgCost) * 100 : 0

    return {
      categoryTitle: 'Profit Target & Resistance Objective',
      whatHappened: `${symbol} advanced to ${currentPriceStr}, achieving your upside target threshold of ${targetPriceStr}.`,
      conditionDetail: `Rule: Price >= ${targetPriceStr} | Unrealized Gain: ${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}% vs cost basis.`,
      whatItMeans: 'The stock has reached your target price or tested major resistance. Risk/reward for continued hold is now less favorable.',
      technicalContext: holding ? `RSI is currently ${rsi.toFixed(0)} (${rsi > 70 ? 'Overbought' : 'Bullish'}), relative volume is ${(holding.relativeVolume || 1).toFixed(1)}x.` : 'Target price objective fulfilled.',
      primaryActionLabel: 'Lock in Profits (Trim 25-50%)',
      actionUrgency: 'high',
      checklist: [
        `Step 1: Lock in gains: Sell 25% to 50% of your ${symbol} position to realize profit.`,
        `Step 2: Raise your trailing stop on remaining shares to breakeven or just below recent swing support.`,
        'Step 3: Reallocate locked-in capital to high-conviction watchlist candidates or cash.',
      ],
      suggestedActionType: 'trade',
    }
  }

  // 3. DIP BUY / RSI OVERSOLD
  if (metric === 'RSI' && !isAbove) {
    return {
      categoryTitle: 'Oversold Dip-Buy / Mean Reversion Setup',
      whatHappened: `${symbol} 14-day RSI dropped to ${rsi.toFixed(1)}, entering the oversold buy-zone (<= ${target}).`,
      conditionDetail: `Rule: RSI <= ${target} | Current RSI: ${rsi.toFixed(1)} | Current Price: $${price.toFixed(2)}.`,
      whatItMeans: 'Selling pressure is mathematically extended. Historically, oversold levels offer asymmetric risk/reward for swing entries or scaling into core holdings.',
      technicalContext: holding ? `Trend alignment: 50-day SMA is ${holding.aboveSma50 ? 'holding support' : 'lost'}; MACD is ${holding.macdBullish ? 'bullish' : 'bearish'}.` : 'RSI oversold reversal threshold met.',
      primaryActionLabel: 'Scale into Starter Position',
      actionUrgency: 'moderate',
      checklist: [
        'Step 1: Verify broader market context (ensure SPY / QQQ are not in a cascading market-wide selloff).',
        `Step 2: Initiate a measured starter tranche (e.g. 25% to 33% of intended size) at current levels.`,
        'Step 3: Set a strict invalidation stop 3% to 5% below today\'s low to manage downside risk.',
      ],
      suggestedActionType: 'trade',
    }
  }

  // 4. RSI OVERBOUGHT / REVERSAL WARNING
  if (metric === 'RSI' && isAbove) {
    return {
      categoryTitle: 'Overbought RSI Exhaustion Warning',
      whatHappened: `${symbol} 14-day RSI surged to ${rsi.toFixed(1)}, exceeding the overbought threshold (>= ${target}).`,
      conditionDetail: `Rule: RSI >= ${target} | Current RSI: ${rsi.toFixed(1)} | Current Price: $${price.toFixed(2)}.`,
      whatItMeans: 'Buying momentum has reached extreme levels. The probability of a short-term consolidation or pullback is significantly elevated.',
      technicalContext: 'Overbought readings in a strong uptrend can persist, but chasing new entry here incurs poor risk-to-reward ratio.',
      primaryActionLabel: 'Tighten Stops & Pause Chasing',
      actionUrgency: 'moderate',
      checklist: [
        'Step 1: Do NOT add new risk or chase long entries at extended RSI levels.',
        `Step 2: Tighten trailing stops on ${symbol} to the previous day\'s low to protect paper gains.`,
        'Step 3: Prepare to take partial profits if candle closes with a bearish reversal wick.',
      ],
      suggestedActionType: 'decision',
    }
  }

  // 5. UNUSUAL VOLUME / INSTITUTIONAL ACCUMULATION
  if (metric === 'VOLUME') {
    const relVol = holding?.relativeVolume || target
    return {
      categoryTitle: 'Unusual Institutional Volume Surge',
      whatHappened: `${symbol} trading volume surged to ${relVol.toFixed(1)}x its 20-day average (trigger target: >= ${target}x).`,
      conditionDetail: `Rule: Relative Volume >= ${target}x | Current Volume: ${relVol.toFixed(1)}x average.`,
      whatItMeans: 'Institutional participation has spiked dramatically. High volume surges often precede or confirm major directional trend breaks.',
      technicalContext: holding ? `Price is ${holding.dayChange >= 0 ? 'up' : 'down'} ${holding.dayChange > 0 ? '+' : ''}${holding.dayChange}% on elevated institutional flow.` : 'High volume breakout detected.',
      primaryActionLabel: 'Investigate Volume Catalyst',
      actionUrgency: 'high',
      checklist: [
        `Step 1: Check news headlines, earnings reports, or regulatory filings for ${symbol}.`,
        'Step 2: If price is breaking out upward with volume, let winners run and trail stops below the volume candle.',
        'Step 3: If price is breaking down on heavy volume, exit or trim immediately to avoid institutional liquidation.',
      ],
      suggestedActionType: 'inspect',
    }
  }

  // 6. MOVING AVERAGE CROSSING (SMA50, SMA20, SMA150)
  if (metric.startsWith('SMA')) {
    const isBullish = isAbove
    return {
      categoryTitle: `${metric} Trend Transition Signal`,
      whatHappened: `${symbol} has transitioned ${isBullish ? 'ABOVE' : 'BELOW'} its ${metric} benchmark line.`,
      conditionDetail: `Rule: Price crosses ${isBullish ? 'above' : 'below'} ${metric} | Bullish Status: ${isBullish ? 'ACTIVE' : 'INACTIVE'}.`,
      whatItMeans: `${isBullish ? 'The intermediate trend has turned bullish, indicating buyers have reclaimed control of the trend structure.' : 'Loss of trend support. The stock is entering a defensive or corrective phase.'}`,
      technicalContext: holding ? `Current Price: $${price.toFixed(2)} | 50 SMA: ${holding.aboveSma50 ? 'Reclaimed' : 'Broken'} | MACD: ${holding.macdBullish ? 'Bullish' : 'Bearish'}.` : 'Moving average crossover event.',
      primaryActionLabel: isBullish ? 'Review Bullish Trend Setup' : 'Review Trend Breakdown',
      actionUrgency: 'moderate',
      checklist: [
        'Step 1: Wait for the daily candle close to confirm the crossover is not a false intraday wick.',
        `${isBullish ? 'Step 2: Consider scaling in or increasing position size as trend alignment is confirmed.' : 'Step 2: Reduce exposure or tighten stops below the broken moving average.'}`,
        'Step 3: Verify whether sector peers are confirming the same directional trend movement.',
      ],
      suggestedActionType: 'inspect',
    }
  }

  // 7. MACD CROSSOVER
  if (metric === 'MACD') {
    const isBull = isAbove
    return {
      categoryTitle: 'MACD Momentum Crossover',
      whatHappened: `${symbol} MACD signal line triggered a ${isBull ? 'Bullish' : 'Bearish'} momentum crossover.`,
      conditionDetail: `Rule: MACD ${isBull ? 'Bullish' : 'Bearish'} Crossover detected.`,
      whatItMeans: `${isBull ? 'Short-term momentum has accelerated above longer-term trend inertia, favoring upside continuation.' : 'Momentum has decelerated, signaling potential trend stall or reversal.'}`,
      technicalContext: holding ? `RSI is ${rsi.toFixed(0)} | Price: $${price.toFixed(2)}.` : 'Momentum vector shift.',
      primaryActionLabel: 'Review Momentum Signal',
      actionUrgency: 'moderate',
      checklist: [
        `${isBull ? 'Step 1: Align position sizing to take advantage of the emerging upward impulse.' : 'Step 1: Protect current gains by tightening stop loss levels.'}`,
        'Step 2: Check volume confirmation to ensure momentum has institutional sponsorship.',
        'Step 3: Re-evaluate target prices against overhead resistance.',
      ],
      suggestedActionType: 'inspect',
    }
  }

  // Fallback for custom price or other triggers
  return {
    categoryTitle: `${symbol} Alert Directive`,
    whatHappened: `${symbol} trigger condition met: ${metric} ${condition} ${target}. Current reading is ${price > 0 ? `$${price.toFixed(2)}` : 'active'}.`,
    conditionDetail: `User Rule: ${metric} ${condition} ${target}.`,
    whatItMeans: 'Your pre-set monitoring rule has been satisfied by live market data.',
    technicalContext: `Live market evaluation at ${new Date().toLocaleTimeString()}.`,
    primaryActionLabel: `Inspect ${symbol} Setup`,
    actionUrgency: ua.severity === 'critical' ? 'immediate' : 'review',
    checklist: [
      `Step 1: Open the ${symbol} asset drawer to review the current chart and technical posture.`,
      'Step 2: Compare current price against your entry thesis and risk targets.',
      'Step 3: Adjust or re-arm the trigger if you decide to keep holding.',
    ],
    suggestedActionType: 'inspect',
  }
}
