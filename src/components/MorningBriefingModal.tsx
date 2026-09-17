import React, { useEffect, useState } from 'react'
import { Check, Copy, Flame, HeartPulse, Send, ShieldAlert, X } from 'lucide-react'
import { api } from '../api/client'
import { ModalOverlay } from './ModalOverlay'
import type { DailyBriefing } from '../types'

interface MorningBriefingModalProps {
  onClose: () => void
}

export function MorningBriefingModal({ onClose }: MorningBriefingModalProps) {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    api.briefingDaily()
      .then((data) => {
        if (alive) {
          setBriefing(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const handleDispatchTelegram = async () => {
    setDispatching(true)
    setDispatchStatus(null)
    try {
      const res = await api.briefingDispatch()
      if (res.sent) {
        setDispatchStatus('✅ Executive briefing dispatched to Telegram!')
      } else {
        setDispatchStatus(`⚠️ Dispatch notice: ${res.error ?? 'Check bot token & chat ID'}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setDispatchStatus(`❌ Dispatch error: ${msg}`)
    } finally {
      setDispatching(false)
    }
  }

  const handleCopyMarkdown = () => {
    if (!briefing) return
    navigator.clipboard.writeText(briefing.telegram_markdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <ModalOverlay label="Daily Pre-Market Morning Briefing" className="decision-modal" onClose={onClose}>
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--line, #e2e8f0)', paddingBottom: '12px' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent, #0b6847)' }}>INSTITUTIONAL INTELLIGENCE</span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 0' }}>
              ☀️ Daily Pre-Market Executive Briefing
            </h2>
            <small style={{ color: 'var(--muted)' }}>{briefing?.date ?? 'Loading...'}</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
            Generating pre-market portfolio intelligence...
          </div>
        )}

        {!loading && briefing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Portfolio Pulse */}
            <section style={{ background: 'var(--card-bg, #f8fafc)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px' }}>
                  PORTFOLIO PULSE
                </span>
                <HeartPulse size={16} color="var(--accent, #0b6847)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '22px' }}>
                  ${Math.round(briefing.pulse.total_value).toLocaleString()}
                </strong>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '13px',
                    color: briefing.pulse.day_change_amount >= 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  {briefing.pulse.day_change_amount >= 0 ? '+' : ''}
                  ${briefing.pulse.day_change_amount.toFixed(2)} ({briefing.pulse.day_change_pct >= 0 ? '+' : ''}{briefing.pulse.day_change_pct.toFixed(2)}%)
                </span>
              </div>
              {briefing.pulse.top_gainer && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '12px' }}>
                  <span>
                    Top Gainer: <strong style={{ color: '#10b981' }}>{briefing.pulse.top_gainer.symbol} (+{briefing.pulse.top_gainer.change}%)</strong>
                  </span>
                  {briefing.pulse.top_loser && (
                    <span>
                      Laggard: <strong style={{ color: '#ef4444' }}>{briefing.pulse.top_loser.symbol} ({briefing.pulse.top_loser.change}%)</strong>
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* Top Signal Setups for Today */}
            <section style={{ background: 'var(--subtle)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                TOP ACTIONABLE SETUPS TODAY
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {briefing.top_setups.map((s) => (
                  <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--panel)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{s.symbol}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px', fontVariantNumeric: 'tabular-nums' }}>
                        ${s.price.toFixed(2)} · RSI {s.rsi.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-dark)', fontVariantNumeric: 'tabular-nums' }}>
                        {s.score}/100
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: s.score >= 80 ? 'var(--accent-soft)' : 'var(--subtle)', color: s.score >= 80 ? 'var(--accent-dark)' : 'var(--muted)' }}>
                        {s.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Imminent Catalysts */}
            {briefing.catalysts.earnings_soon.length > 0 && (
              <section style={{ background: 'var(--amber-soft)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--amber)', color: 'var(--ink)' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <Flame size={16} color="var(--amber)" />
                  <strong style={{ fontSize: '12px', color: 'var(--ink)' }}>Earnings Risk This Week (≤7 Days)</strong>
                </div>
                {briefing.catalysts.earnings_soon.map((e) => (
                  <div key={e.symbol} style={{ fontSize: '11px', marginTop: '2px', color: 'var(--ink)' }}>
                    • <strong>{e.symbol}</strong>: {e.earnings_date} ({e.days_until}d away, {e.timing}) · Implied Move ±{e.implied_move_pct}%
                  </div>
                ))}
              </section>
            )}

            {/* Risk Posture & Executive Stance */}
            <section style={{ background: 'var(--subtle)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <ShieldAlert size={16} color="var(--muted)" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px' }}>
                  RISK POSTURE &amp; EXECUTIVE DIRECTIVE
                </span>
              </div>
              <p style={{ margin: '4px 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                {briefing.risk.executive_stance}
              </p>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                1-Day 95% VaR: <strong style={{ color: 'var(--ink)' }}>${briefing.risk.var_95.toLocaleString()}</strong> · Beta: <strong style={{ color: 'var(--ink)' }}>{briefing.risk.beta.toFixed(2)}</strong>
              </div>
            </section>

            {/* Status notice */}
            {dispatchStatus && (
              <div style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '6px', background: dispatchStatus.startsWith('✅') ? 'var(--accent-soft)' : 'var(--red-soft)', color: dispatchStatus.startsWith('✅') ? 'var(--accent-dark)' : 'var(--red)' }}>
                {dispatchStatus}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                className="ask-button"
                onClick={handleDispatchTelegram}
                disabled={dispatching}
                style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
              >
                <Send size={15} />
                {dispatching ? 'Dispatching...' : 'Dispatch to Telegram'}
              </button>
              <button
                onClick={handleCopyMarkdown}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--ink)',
                }}
              >
                {copied ? <Check size={15} color="var(--accent-dark)" /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
