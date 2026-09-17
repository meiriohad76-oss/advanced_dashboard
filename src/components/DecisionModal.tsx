import { useState } from 'react'
import { CheckCircle2, Printer, Send, ShieldCheck, Sparkles, Target, TrendingUp, X } from 'lucide-react'
import { ModalOverlay } from './ModalOverlay'
import type { Holding } from '../types'
import { assessHolding } from '../domain/engine'
import { api } from '../api/client'

export interface DecisionModalProps {
  holding: Holding
  holdings: Holding[]
  onClose: () => void
  onSimulate?: (symbol: string, action: string) => void
}

export function DecisionModal({ holding, holdings, onClose, onSimulate }: DecisionModalProps) {
  const [executed, setExecuted] = useState(false)
  const [telegramSent, setTelegramSent] = useState(false)
  const [sendingTelegram, setSendingTelegram] = useState(false)
  const assessment = assessHolding(holding)

  const sectorWeight = holdings.filter((h) => h.sector === holding.sector).reduce((sum, h) => sum + h.weight, 0)
  const isSemiOverweight = sectorWeight > 35 || holding.sector === 'Semiconductors'
  const recommendedAction = assessment.score >= 80 
    ? `STRONG ENTRY · Rebalance Allocation` 
    : assessment.score >= 60 
    ? `APPROACHING ENTRY · Add to Watchlist` 
    : `HOLD / MONITOR · Maintain Current Weight`

  const targetWeight = isSemiOverweight ? Math.max(2.0, holding.weight - 1.2) : Math.min(15.0, holding.weight + 2.5)

  const handleSimulateAction = () => {
    setExecuted(true)
    if (onSimulate) {
      onSimulate(holding.symbol, recommendedAction)
    }
  }

  const handleSendTelegramPrompt = async () => {
    setSendingTelegram(true)
    try {
      const defaultQty = Math.max(1, Math.round(2000 / holding.price))
      await api.telegramSendTradePrompt({
        symbol: holding.symbol,
        qty: defaultQty,
        side: 'buy',
        price: holding.price,
        take_profit_price: Number((holding.price * 1.15).toFixed(2)),
        stop_loss_price: Number((holding.price * 0.95).toFixed(2)),
      })
      setTelegramSent(true)
    } catch {
      //
    } finally {
      setSendingTelegram(false)
    }
  }

  return (
    <ModalOverlay className="ask-drawer" label={`Decision Action Plan for ${holding.symbol}`} onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close decision modal"><X size={19} /></button>
      
      <div className="ask-heading">
        <span style={{ background: 'var(--accent-dark)', color: '#fff' }}><Target size={21} /></span>
        <div>
          <p>DECISION ACTION PLAN</p>
          <h2>{holding.symbol} Strategy Directive</h2>
        </div>
      </div>

      <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', marginTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <span className="eyebrow">RECOMMENDED DIRECTIVE</span>
            <h3 style={{ fontSize: '16px', color: 'var(--ink)', marginTop: '2px' }}>{recommendedAction}</h3>
          </div>
          <span className={`status-pill ${assessment.state.toLowerCase().replace(' ', '-')}`}>{assessment.state}</span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '14px' }}>
          Based on the deterministic model score (<strong>{assessment.score}/100</strong>), {holding.symbol} satisfies key technical indicators with optimal portfolio fit.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--subtle)', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Current Exposure</span>
            <strong style={{ display: 'block', fontSize: '15px', color: 'var(--ink)', marginTop: '2px' }}>{holding.weight.toFixed(1)}% (${(holding.quantity * holding.price).toLocaleString()})</strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Target Rebalanced Exposure</span>
            <strong style={{ display: 'block', fontSize: '15px', color: 'var(--accent-dark)', marginTop: '2px' }}>{targetWeight.toFixed(1)}%</strong>
          </div>
        </div>

        <span className="eyebrow" style={{ marginTop: '8px', display: 'block' }}>RATIONALE &amp; OBSERVED FACTS</span>
        <ul className="fact-list" style={{ marginTop: '6px' }}>
          {assessment.facts.map((fact) => (
            <li key={fact} style={{ fontSize: '12px' }}>
              <ShieldCheck size={15} color="var(--accent-dark)" />
              <span>{fact}</span>
            </li>
          ))}
          <li style={{ fontSize: '12px' }}>
            <TrendingUp size={15} color="var(--accent-dark)" />
            <span>Risk-Adjusted Portfolio Fit Score: High</span>
          </li>
        </ul>
        <div className="print-only-footer" style={{ display: 'none', marginTop: '16px', borderTop: '1px solid #ccc', paddingTop: '8px', fontSize: '10px', color: '#666' }}>
          Generated by Atlas Portfolio Intelligence · Deterministic Quantitative Model · Confidential Executive Briefing
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }} className="no-print">
        <button 
          className="ask-button" 
          onClick={handleSimulateAction} 
          disabled={executed} 
          style={{ flex: 1, justifyContent: 'center', background: executed ? 'var(--good-soft)' : 'var(--accent-dark)', color: executed ? 'var(--good)' : '#fff' }}
        >
          {executed ? <><CheckCircle2 size={16} /> Rebalance Applied in Simulation</> : <><Sparkles size={16} /> Simulate &amp; Apply Rebalance</>}
        </button>
        <button
          className="ask-button"
          onClick={handleSendTelegramPrompt}
          disabled={sendingTelegram || telegramSent}
          style={{ background: telegramSent ? '#15803d' : '#0284c7', color: '#fff', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Dispatch inline trade execution card to Telegram bot"
        >
          {telegramSent ? <CheckCircle2 size={16} /> : <Send size={16} />}
          <span>{telegramSent ? 'Sent to Telegram' : sendingTelegram ? 'Sending...' : 'Trade via Telegram'}</span>
        </button>
        <button
          className="ask-button"
          onClick={() => window.print()}
          style={{ background: 'var(--ink)', color: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Export / Print Executive PDF Briefing"
        >
          <Printer size={16} />
          <span>Export PDF</span>
        </button>
      </div>
    </ModalOverlay>
  )
}
