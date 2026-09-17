import type { EntryAssessment, EntryCriteria, EntrySignalState } from '../types'

export interface CandidateInput {
  symbol: string
  name?: string | null
  sector?: string | null
  price?: number
  dayChange?: number
  dayChangePct?: number
  rsi?: number
  aboveSma50?: boolean
  aboveSma200?: boolean
  macdBullish?: boolean
  relativeVolume?: number
  breakout20d?: boolean
  ratingsConsensus?: number | null
  ratingsConsensusLabel?: string | null
  targetPrice?: number | null
}

export function assessCandidateEntry(candidate: CandidateInput): EntryAssessment {
  const facts: string[] = []

  // 1. Ratings Consensus (Max 30 pts)
  const consensus = candidate.ratingsConsensus
  let ratingsScore = 15
  let ratingsDetail = 'Neutral or pending coverage'
  let ratingBullish = false

  if (consensus !== null && consensus !== undefined) {
    if (consensus >= 80) {
      ratingsScore = 30
      ratingsDetail = `Strong Buy consensus (${consensus.toFixed(1)}/100)`
      ratingBullish = true
      facts.push(`Multi-source ratings: Strong Buy (${candidate.ratingsConsensusLabel || 'Bullish'})`)
    } else if (consensus >= 65) {
      ratingsScore = 25
      ratingsDetail = `Solid Buy consensus (${consensus.toFixed(1)}/100)`
      ratingBullish = true
      facts.push(`Multi-source ratings: Buy consensus (${candidate.ratingsConsensusLabel || 'Buy'})`)
    } else if (consensus >= 50) {
      ratingsScore = 15
      ratingsDetail = `Hold / Neutral (${consensus.toFixed(1)}/100)`
      facts.push(`Ratings: Hold/Neutral (${candidate.ratingsConsensusLabel || 'Hold'})`)
    } else {
      ratingsScore = 5
      ratingsDetail = `Underperform / Sell (${consensus.toFixed(1)}/100)`
      facts.push(`Ratings: Cautious / Sell bias (${candidate.ratingsConsensusLabel || 'Sell'})`)
    }
  }

  // 2. Momentum & RSI Buy-Zone (Max 25 pts)
  const rsi = candidate.rsi ?? 50
  let momentumScore = 12
  let momentumDetail = `RSI ${rsi.toFixed(0)} neutral`
  let rsiInBuyZone = false

  if (rsi >= 38 && rsi <= 58) {
    momentumScore = 25
    momentumDetail = `RSI ${rsi.toFixed(0)} in ideal entry sweet spot (38-58)`
    rsiInBuyZone = true
    facts.push(`RSI ${rsi.toFixed(0)} is in optimal low-risk buy zone`)
  } else if (rsi < 38) {
    momentumScore = 20
    momentumDetail = `RSI ${rsi.toFixed(0)} oversold bounce opportunity`
    rsiInBuyZone = true
    facts.push(`RSI ${rsi.toFixed(0)} oversold pullback recovery`)
  } else if (rsi <= 66) {
    momentumScore = 12
    momentumDetail = `RSI ${rsi.toFixed(0)} moderate momentum`
    facts.push(`RSI ${rsi.toFixed(0)} showing positive momentum`)
  } else {
    momentumScore = 2
    momentumDetail = `RSI ${rsi.toFixed(0)} overbought — elevated risk of pullback`
    facts.push(`RSI ${rsi.toFixed(0)} is stretched/overbought`)
  }

  if (candidate.macdBullish) {
    momentumScore = Math.min(25, momentumScore + 3)
    facts.push('MACD histogram is bullish')
  }

  // 3. Trend Alignment (Max 20 pts)
  let trendScore = 0
  const trendFacts: string[] = []
  if (candidate.aboveSma200 !== false) {
    trendScore += 10
    trendFacts.push('Above 200-day moving average')
  }
  if (candidate.aboveSma50 !== false) {
    trendScore += 10
    trendFacts.push('Above 50-day moving average')
  }
  const trendAligned = candidate.aboveSma200 !== false
  if (trendFacts.length > 0) {
    facts.push(`Trend: ${trendFacts.join(' & ')}`)
  }

  // 4. Setup & Volume (Max 15 pts)
  let setupScore = 5
  let setupDetail = 'Consolidating support'
  const relVol = candidate.relativeVolume ?? 1.0
  const volumeActive = relVol >= 1.0

  if (candidate.breakout20d) {
    setupScore += 7
    setupDetail = '20-day breakout with volume'
    facts.push('20-day high breakout triggered')
  }
  if (relVol >= 1.2) {
    setupScore += 3
    facts.push(`Strong relative volume (${relVol.toFixed(2)}x) confirming interest`)
  }

  // 5. Target Upside Potential (Max 10 pts)
  let upsideScore = 4
  let upsideDetail = 'Upside in line with market'
  let upsideAttractive = false

  if (candidate.targetPrice && candidate.price && candidate.price > 0) {
    const upsidePct = ((candidate.targetPrice - candidate.price) / candidate.price) * 100
    if (upsidePct >= 25) {
      upsideScore = 10
      upsideDetail = `+${upsidePct.toFixed(1)}% to Wall St target ($${candidate.targetPrice.toFixed(2)})`
      upsideAttractive = true
      facts.push(`Substantial analyst upside (+${upsidePct.toFixed(1)}%) to $${candidate.targetPrice.toFixed(2)}`)
    } else if (upsidePct >= 15) {
      upsideScore = 8
      upsideDetail = `+${upsidePct.toFixed(1)}% to Wall St target ($${candidate.targetPrice.toFixed(2)})`
      upsideAttractive = true
      facts.push(`Attractive analyst upside (+${upsidePct.toFixed(1)}%)`)
    } else if (upsidePct >= 5) {
      upsideScore = 5
      upsideDetail = `+${upsidePct.toFixed(1)}% to target`
    } else {
      upsideScore = 1
      upsideDetail = `At or near target (${upsidePct.toFixed(1)}%)`
    }
  }

  const totalScore = Math.min(100, Math.round(ratingsScore + momentumScore + trendScore + setupScore + upsideScore))

  // Determine state
  let state: EntrySignalState = 'NO SETUP'
  if (rsi >= 68 && totalScore < 85) {
    state = 'WAIT FOR DIP'
  } else if (totalScore >= 80) {
    state = 'STRONG ENTRY'
  } else if (totalScore >= 70) {
    state = 'ENTRY'
  } else if (totalScore >= 55) {
    state = 'APPROACHING'
  } else if (totalScore >= 40) {
    state = 'WATCH'
  }

  const criteria: EntryCriteria = {
    ratingBullish,
    rsiInBuyZone,
    trendAligned,
    volumeActive,
    upsideAttractive,
  }

  return {
    score: totalScore,
    state,
    criteria,
    facts,
    components: {
      ratings: { score: ratingsScore, max: 30, detail: ratingsDetail },
      trend: { score: trendScore, max: 20, detail: trendFacts.join(', ') || 'Below moving averages' },
      momentum: { score: momentumScore, max: 25, detail: momentumDetail },
      setup: { score: setupScore, max: 15, detail: setupDetail },
      upside: { score: upsideScore, max: 10, detail: upsideDetail },
    },
  }
}
