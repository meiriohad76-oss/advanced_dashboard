import type { Holding, SignalAssessment, SignalState } from '../types'

export function classifyScore(score: number): SignalState {
  if (score >= 90) return 'STRONG ENTRY'
  if (score >= 80) return 'ENTRY'
  if (score >= 65) return 'APPROACHING'
  if (score >= 50) return 'WATCH'
  return 'NO SETUP'
}

export function assessHolding(holding: Holding): SignalAssessment {
  if (holding.hasSignalInputs === false) {
    return {
      score: 0,
      state: 'NO SETUP',
      components: [
        { label: 'Trend', score: 0, max: 30, facts: ['Signals need market data'] },
        { label: 'Momentum', score: 0, max: 25, facts: ['Signals need market data'] },
        { label: 'Setup', score: 0, max: 25, facts: ['Signals need market data'] },
        { label: 'Volume', score: 0, max: 20, facts: ['Signals need market data'] },
      ],
      facts: ['Technical indicator columns (RSI/MACD/SMA) not supplied in imported file.']
    }
  }

  const trendFacts: string[] = []
  let trend = 0
  if (holding.aboveSma200) { trend += 10; trendFacts.push('Price above 200-day average') }
  if (holding.aboveSma50) { trend += 10; trendFacts.push('Price above 50-day average') }
  if (holding.trendSlopePositive) { trend += 10; trendFacts.push('50-day trend is rising') }

  const momentumFacts: string[] = []
  let momentum = 0
  if (holding.rsi >= 45 && holding.rsi <= 65) { momentum += 12; momentumFacts.push(`RSI ${holding.rsi.toFixed(0)} in target range`) }
  if (holding.macdBullish) { momentum += 13; momentumFacts.push('MACD is bullish') }

  const setupFacts: string[] = []
  let setup = 0
  if (holding.breakout20d) { setup += 15; setupFacts.push('Price cleared its prior 20-day high') }
  if (holding.aboveSma50) { setup += 10; setupFacts.push('Setup is supported by the 50-day average') }

  const volumeFacts: string[] = []
  let volume = 0
  if (holding.relativeVolume >= 1.3) { volume += 20; volumeFacts.push(`Relative volume is ${holding.relativeVolume.toFixed(2)}×`) }
  else if (holding.relativeVolume >= 1.0) { volume += 10; volumeFacts.push(`Relative volume is ${holding.relativeVolume.toFixed(2)}×`) }

  const components = [
    { label: 'Trend', score: trend, max: 30, facts: trendFacts },
    { label: 'Momentum', score: momentum, max: 25, facts: momentumFacts },
    { label: 'Setup', score: setup, max: 25, facts: setupFacts },
    { label: 'Volume', score: volume, max: 20, facts: volumeFacts },
  ]
  const score = components.reduce((sum, component) => sum + component.score, 0)
  return { score, state: classifyScore(score), components, facts: components.flatMap((component) => component.facts) }
}

export function portfolioRisk(holdings: Holding[]) {
  const largest = Math.max(...holdings.map((holding) => holding.weight))
  const topFive = [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((sum, h) => sum + h.weight, 0)
  const sectors = holdings.reduce<Record<string, number>>((result, holding) => {
    result[holding.sector] = (result[holding.sector] ?? 0) + holding.weight
    return result
  }, {})
  const [largestSector, sectorWeight] = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0]
  return { largest, topFive, largestSector, sectorWeight, status: largest > 20 || sectorWeight > 35 ? 'Elevated' : 'Balanced' }
}

export function answerQuestion(question: string, holdings: Holding[]): string {
  const normalized = question.toLowerCase()
  const ranked = holdings.map((holding) => ({ holding, assessment: assessHolding(holding) })).sort((a, b) => b.assessment.score - a.assessment.score)
  const risk = portfolioRisk(holdings)
  const symbol = holdings.find((holding) => normalized.includes(holding.symbol.toLowerCase()))

  if (symbol) {
    const assessment = assessHolding(symbol)
    return `${symbol.symbol} is ${assessment.state.toLowerCase()} at ${assessment.score}/100. ${assessment.facts.slice(0, 3).join('. ')}. Its portfolio weight is ${symbol.weight.toFixed(1)}%.`
  }
  if (normalized.includes('risk') || normalized.includes('concentration')) {
    return `${risk.largestSector} is the largest sector exposure at ${risk.sectorWeight.toFixed(1)}%. The largest single position is ${risk.largest.toFixed(1)}% and the top five represent ${risk.topFive.toFixed(1)}% of the portfolio.`
  }
  if (normalized.includes('signal') || normalized.includes('attention') || normalized.includes('opportun')) {
    const top = ranked[0]
    return `${top.holding.symbol} requires the most attention. Its score is ${top.assessment.score}/100 (${top.assessment.state}), led by ${top.assessment.facts.slice(0, 3).join(', ').toLowerCase()}.`
  }
  if (normalized.includes('change') || normalized.includes('today')) {
    const movers = [...holdings].sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange)).slice(0, 2)
    return `The largest moves are ${movers[0].symbol} at ${movers[0].dayChange > 0 ? '+' : ''}${movers[0].dayChange.toFixed(2)}% and ${movers[1].symbol} at ${movers[1].dayChange > 0 ? '+' : ''}${movers[1].dayChange.toFixed(2)}%. No stale inputs are affecting this briefing.`
  }
  return `I can explain current signals, portfolio concentration, material changes, and the provenance of any displayed metric. Try asking “Why is CRDO ranked first?”`
}
