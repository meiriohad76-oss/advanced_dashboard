import { AlertTriangle, Layers, ShieldCheck } from 'lucide-react'
import { computePortfolioFit } from '../domain/portfolioFit'
import type { Holding } from '../types'

// Portfolio-aware signal adjustment (spec section 25) + deterministic explanation
// (spec section 73). Computed locally from the holdings the app already has — exactly
// like the technical score (assessHolding) — so there is nothing to fetch.

function fitTone(fitScore: number): string {
  if (fitScore >= 100) return 'good'
  if (fitScore >= 90) return 'warning'
  return 'bad'
}

// Drawer section: the Technical / Portfolio Fit / Combined triad plus the deterministic
// "why". Hidden for CASH, which has no tradable setup.
export function PortfolioFitPanel({ holding, holdings }: { holding: Holding; holdings: Holding[] }) {
  if (holding.symbol === 'CASH') return null
  const fit = computePortfolioFit(holding, holdings)
  const adjusted = fit.concentrationAdjustment < 0
  const ready = holding.hasSignalInputs !== false // technical/combined need market-data columns
  const notes = fit.explanation.slice(fit.factors.length) // correlation + summary lines
  return (
    <section className="drawer-section fit-panel">
      <div className="section-heading"><div><span className="eyebrow">PORTFOLIO-AWARE</span><h3>Fit in this portfolio</h3></div><Layers size={17} /></div>
      {ready ? (
        <div className="fit-triad">
          <div className="fit-tile"><span>Technical</span><strong>{fit.technicalScore}</strong></div>
          <div className={`fit-tile ${fitTone(fit.fitScore)}`}><span>Portfolio fit</span><strong>{fit.fitScore}</strong></div>
          <div className="fit-tile combined"><span>Combined</span><strong>{fit.combinedScore}</strong>{adjusted && <em className="fit-adjust">{fit.concentrationAdjustment}</em>}</div>
        </div>
      ) : (
        <div className="fit-triad one">
          <div className={`fit-tile ${fitTone(fit.fitScore)}`}><span>Portfolio fit</span><strong>{fit.fitScore}</strong></div>
          <p className="fit-note">Technical &amp; combined scores need market-data columns (RSI / MACD / SMA); portfolio fit below is exact from weights and sector.</p>
        </div>
      )}
      <ul className="fact-list fit-factors">
        {fit.factors.map((factor) => (
          <li key={factor.label} className={factor.breached ? 'breached' : ''}>
            {factor.breached ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            <span>{factor.detail}</span>
          </li>
        ))}
      </ul>
      {notes.map((note) => <p key={note} className="fit-note">{note}</p>)}
    </section>
  )
}

// Compact card chip: shows the portfolio fit only when concentration drags it below 100,
// so cards for clean-fit holdings stay uncluttered (same discipline as the ratings chip).
export function PortfolioFitTag({ holding, holdings }: { holding: Holding; holdings: Holding[] }) {
  if (holding.symbol === 'CASH') return null
  const fit = computePortfolioFit(holding, holdings)
  if (fit.concentrationAdjustment === 0) return null
  return (
    <span className={`fit-tag ${fitTone(fit.fitScore)}`} title={`Portfolio fit ${fit.fitScore}/100 · ${fit.concentrationAdjustment} to combined (${fit.combinedScore})`}>
      Fit {fit.fitScore}
    </span>
  )
}
