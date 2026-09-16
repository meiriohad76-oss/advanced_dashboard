import type { AlertItem, Holding } from '../types'

// Semiconductors (CRDO + NVDA) stays at 36.2% so it remains the largest sector
// exposure — the concentration story the demo hinges on. AEM / NVO / RIO are
// diversifier holdings whose purpose is to overlap the external ratings extractor's
// coverage universe, so imported real ratings actually surface in the gauge (BL-005).
// Non-semiconductor weights were rebalanced to make room while keeping the book at
// 100% and Semiconductors first. Mirrors backend/app/data.py.
export const baseHoldings: Holding[] = [
  { symbol: 'CRDO', name: 'Credo Technology', sector: 'Semiconductors', quantity: 420, price: 143.20, avgCost: 108.40, dayChange: 4.82, weight: 17.4, rsi: 58, macdBullish: true, aboveSma50: true, aboveSma200: true, relativeVolume: 1.12, breakout20d: false, trendSlopePositive: false, returnsHistory: [0.03, 0.05, -0.02, 0.04, 0.02] },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Semiconductors', quantity: 380, price: 203.34, avgCost: 159.10, dayChange: 2.31, weight: 18.8, rsi: 61, macdBullish: true, aboveSma50: true, aboveSma200: true, relativeVolume: 1.18, breakout20d: false, trendSlopePositive: true, returnsHistory: [0.04, 0.06, -0.01, 0.05, 0.03] },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Software', quantity: 145, price: 519.72, avgCost: 438.25, dayChange: 0.74, weight: 13.0, rsi: 55, macdBullish: true, aboveSma50: true, aboveSma200: true, relativeVolume: 0.91, breakout20d: false, trendSlopePositive: true, returnsHistory: [0.01, 0.02, 0.00, 0.01, 0.01] },
  { symbol: 'ANET', name: 'Arista Networks', sector: 'Infrastructure', quantity: 310, price: 151.84, avgCost: 121.40, dayChange: 1.92, weight: 10.5, rsi: 57, macdBullish: true, aboveSma50: true, aboveSma200: true, relativeVolume: 1.05, breakout20d: true, trendSlopePositive: true, returnsHistory: [0.02, 0.03, -0.01, 0.02, 0.02] },
  { symbol: 'VRT', name: 'Vertiv Holdings', sector: 'Infrastructure', quantity: 255, price: 187.60, avgCost: 146.10, dayChange: -1.22, weight: 9.5, rsi: 48, macdBullish: false, aboveSma50: true, aboveSma200: true, relativeVolume: 1.37, breakout20d: false, trendSlopePositive: true, returnsHistory: [-0.01, 0.01, 0.02, -0.01, 0.00] },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Software', quantity: 210, price: 244.61, avgCost: 198.32, dayChange: 0.41, weight: 8.3, rsi: 52, macdBullish: false, aboveSma50: true, aboveSma200: true, relativeVolume: 0.82, breakout20d: false, trendSlopePositive: false, returnsHistory: [0.00, 0.01, 0.01, 0.00, 0.01] },
  { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'Diversified', quantity: 95, price: 682.15, avgCost: 618.80, dayChange: 0.36, weight: 7.0, rsi: 54, macdBullish: true, aboveSma50: true, aboveSma200: true, relativeVolume: 0.88, breakout20d: false, trendSlopePositive: true, returnsHistory: [0.01, 0.02, 0.00, 0.01, 0.01] },
  { symbol: 'AEM', name: 'Agnico Eagle Mines', sector: 'Metals & Mining', quantity: 520, price: 128.40, avgCost: 92.10, dayChange: 1.15, weight: 4.5, rsi: 62, macdBullish: true, aboveSma50: true, aboveSma200: true, relativeVolume: 1.08, breakout20d: false, trendSlopePositive: true, returnsHistory: [-0.02, -0.01, 0.03, -0.02, 0.01] },
  { symbol: 'NVO', name: 'Novo Nordisk', sector: 'Healthcare', quantity: 610, price: 58.20, avgCost: 71.40, dayChange: -0.64, weight: 3.5, rsi: 43, macdBullish: false, aboveSma50: false, aboveSma200: false, relativeVolume: 0.94, breakout20d: false, trendSlopePositive: false, returnsHistory: [-0.01, 0.00, -0.01, 0.01, -0.01] },
  { symbol: 'RIO', name: 'Rio Tinto', sector: 'Metals & Mining', quantity: 480, price: 64.80, avgCost: 61.20, dayChange: 0.32, weight: 2.5, rsi: 51, macdBullish: false, aboveSma50: true, aboveSma200: true, relativeVolume: 0.88, breakout20d: false, trendSlopePositive: false, returnsHistory: [-0.01, -0.02, 0.02, -0.01, 0.00] },
  { symbol: 'CASH', name: 'Cash balance', sector: 'Cash', quantity: 1, price: 31200, avgCost: 31200, dayChange: 0, weight: 5.0, rsi: 50, macdBullish: false, aboveSma50: false, aboveSma200: false, relativeVolume: 0, breakout20d: false, trendSlopePositive: false, returnsHistory: [0, 0, 0, 0, 0] },
]

export function scenarioHoldings(active: boolean): Holding[] {
  if (!active) return baseHoldings
  return baseHoldings.map((holding) => holding.symbol === 'CRDO'
    ? { ...holding, price: 145.10, dayChange: 6.21, relativeVolume: 1.42, breakout20d: true }
    : holding)
}

export const performance = {
  portfolio: [100, 102, 101, 104, 106, 105, 109, 108, 111, 113, 114, 119.4],
  benchmark: [100, 101, 100.5, 102.8, 103.4, 102.9, 105.1, 106.2, 107.6, 108.1, 110.3, 112.1],
}

export const baseAlerts: AlertItem[] = [
  { id: 'a1', symbol: 'ANET', title: '20-day breakout', message: 'Price remains above the prior 20-day high; cooldown ends tomorrow.', status: 'COOLDOWN', severity: 'info', time: '10:18 ET' },
  { id: 'a2', title: 'Sector concentration', message: 'Notify when semiconductor exposure exceeds 35%.', status: 'TRIGGERED', severity: 'warning', time: '09:47 ET' },
  { id: 'a3', symbol: 'VRT', title: 'Recover SMA50', message: 'Waiting for price to cross above SMA50 while above SMA200.', status: 'ARMED', severity: 'info', time: 'Monitoring' },
  { id: 'a4', title: 'Portfolio drawdown', message: 'Notify when drawdown exceeds 8%; current drawdown is 1.4%.', status: 'ARMED', severity: 'info', time: 'Monitoring' },
]

export const scenarioAlert: AlertItem = {
  id: 'scenario', symbol: 'CRDO', title: 'Entry threshold crossed',
  message: 'Score moved from 65 to 90 after a 20-day breakout on 1.42× volume.',
  status: 'TRIGGERED', severity: 'critical', time: 'Now',
}
