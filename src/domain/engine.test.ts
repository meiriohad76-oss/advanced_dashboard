import { describe, expect, it } from 'vitest'
import { answerQuestion, assessHolding, classifyScore, portfolioRisk } from './engine'
import { baseHoldings, scenarioHoldings } from '../data/demo'

describe('signal engine', () => {
  it('classifies threshold boundaries', () => {
    expect(classifyScore(49)).toBe('NO SETUP')
    expect(classifyScore(65)).toBe('APPROACHING')
    expect(classifyScore(80)).toBe('ENTRY')
    expect(classifyScore(90)).toBe('STRONG ENTRY')
  })

  it('records an explainable score change in the demo scenario', () => {
    const before = assessHolding(baseHoldings[0])
    const after = assessHolding(scenarioHoldings(true)[0])
    expect(before.score).toBe(65)
    expect(after.score).toBe(90)
    expect(after.facts).toContain('Price cleared its prior 20-day high')
  })

  it('calculates portfolio risk and grounded answers', () => {
    expect(portfolioRisk(baseHoldings).largestSector).toBe('Semiconductors')
    expect(answerQuestion('Why is CRDO ranked first?', scenarioHoldings(true))).toContain('90/100')
  })
})
