import { useState } from 'react'
import { FileText, Download, Send, CheckCircle, AlertTriangle, ShieldCheck, PieChart, Activity, X } from 'lucide-react'
import { api } from '../api/client'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioValue?: number
}

export function ReportModal({ isOpen, onClose, portfolioValue }: ReportModalProps) {
  const [sendingTelegram, setSendingTelegram] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState<{ success: boolean; message: string } | null>(null)

  if (!isOpen) return null

  const handleDownload = () => {
    const url = api.reportsWeeklyPdfUrl()
    const a = document.createElement('a')
    a.href = url
    a.download = `Atlas_Defense_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleSendTelegram = async () => {
    setSendingTelegram(true)
    setTelegramStatus(null)
    try {
      const res = await api.reportsSendTelegram()
      if (res.success) {
        setTelegramStatus({ success: true, message: 'PDF report dispatched successfully to your Telegram chat!' })
      } else {
        setTelegramStatus({
          success: false,
          message: res.error || 'Failed to dispatch report. Please verify Telegram Bot Token and Chat ID in Settings.',
        })
      }
    } catch (err: any) {
      setTelegramStatus({
        success: false,
        message: err.message || 'Error communicating with Telegram dispatch API.',
      })
    } finally {
      setSendingTelegram(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--panel)',
          borderRadius: '16px',
          border: '1px solid var(--line)',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.25)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Executive Performance &amp; Defense Report
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Publication-grade vector PDF export with full audit telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Briefing summary banner */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--accent-dark)" />
              <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                Comprehensive Institutional Portfolio Intelligence
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Generates an executive-ready multi-page report detailing portfolio valuation
              {portfolioValue ? ` ($${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''},
              net day return, active holdings health matrix, risk limit compliance, and the historical Alpha Audit log.
            </p>
          </div>

          {/* Section preview checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--subtle)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <Activity size={16} color="#0284c7" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Executive Summary</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Valuation, P&amp;L, Cash allocation, SPY benchmark comparison</div>
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--subtle)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <ShieldCheck size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Playbook Defense Audit</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Stops respected, trims banked, alpha saved, action rate %</div>
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--subtle)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <FileText size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Holdings Health Matrix</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>5-point scores, RSI, SMA-50/200 trends, armed triggers</div>
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--subtle)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <PieChart size={16} color="#8b5cf6" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Concentration Guardrails</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Sector distribution vs. 25% guideline compliance</div>
              </div>
            </div>
          </div>

          {/* Telegram status message */}
          {telegramStatus && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: telegramStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${telegramStatus.success ? '#10b981' : '#ef4444'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: telegramStatus.success ? '#047857' : '#b91c1c',
              }}
            >
              {telegramStatus.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{telegramStatus.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--subtle)',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              color: 'var(--muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSendTelegram}
              disabled={sendingTelegram}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'rgba(2, 132, 199, 0.1)',
                border: '1px solid var(--accent-dark)',
                color: 'var(--accent-dark)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: sendingTelegram ? 'not-allowed' : 'pointer',
                opacity: sendingTelegram ? 0.7 : 1,
              }}
            >
              <Send size={14} />
              {sendingTelegram ? 'Sending to Telegram…' : 'Send to Telegram'}
            </button>

            <button
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                background: 'var(--accent-dark)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Download size={14} />
              Download PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
