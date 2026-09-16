export type TimeframeKey = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y'

export function getTimeframeSeries(portfolioFull: number[], benchmarkFull: number[], timeframe: TimeframeKey) {
  let count = portfolioFull.length
  if (timeframe === '1W') count = 2
  else if (timeframe === '1M') count = 3
  else if (timeframe === '3M') count = 4
  else if (timeframe === '6M') count = 7
  else if (timeframe === 'YTD') count = 9
  else count = portfolioFull.length // 1Y

  const portfolio = portfolioFull.slice(-count)
  const benchmark = benchmarkFull.slice(-count)

  const pStart = portfolio[0]
  const pEnd = portfolio[portfolio.length - 1]
  const bStart = benchmark[0]
  const bEnd = benchmark[benchmark.length - 1]

  const portfolioReturn = pStart ? ((pEnd - pStart) / pStart) * 100 : 0
  const benchmarkReturn = bStart ? ((bEnd - bStart) / bStart) * 100 : 0
  const alpha = portfolioReturn - benchmarkReturn

  return {
    portfolio,
    benchmark,
    portfolioReturn,
    benchmarkReturn,
    alpha,
  }
}
