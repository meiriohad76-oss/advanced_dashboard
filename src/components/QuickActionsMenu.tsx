import React, { useEffect, useRef, useState } from 'react'
import {
  BarChart2,
  ChevronDown,
  Moon,
  Play,
  Radio,
  Scale,
  ShieldCheck,
  Sun,
  Zap,
} from 'lucide-react'

interface QuickActionsMenuProps {
  onOpenBriefing: () => void
  onOpenBacktest: () => void
  onOpenRebalance: () => void
  onToggleStream: () => void
  liveStreaming: boolean
  onToggleScenario: () => void
  scenario: boolean
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function QuickActionsMenu({
  onOpenBriefing,
  onOpenBacktest,
  onOpenRebalance,
  onToggleStream,
  liveStreaming,
  onToggleScenario,
  scenario,
  theme,
  onToggleTheme,
}: QuickActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="quick-actions-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="quick-actions-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Quick trading operations, simulation & briefings"
      >
        <Zap size={14} color="var(--accent-dark)" />
        <span>Quick Actions</span>
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div className="quick-actions-dropdown" role="menu">
          <button
            type="button"
            className="quick-action-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenBriefing()
            }}
          >
            <Sun size={15} color="#d97706" />
            <div>
              <strong>Pre-Market Morning Briefing</strong>
              <small>Synthesize overnight pulse, catalysts &amp; risk</small>
            </div>
          </button>

          <button
            type="button"
            className="quick-action-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenBacktest()
            }}
          >
            <BarChart2 size={15} color="#2563eb" />
            <div>
              <strong>Strategy Rule Backtester</strong>
              <small>Simulate score entries vs SPY benchmark</small>
            </div>
          </button>

          <button
            type="button"
            className="quick-action-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenRebalance()
            }}
          >
            <Scale size={15} color="#059669" />
            <div>
              <strong>Portfolio Rebalancing</strong>
              <small>Model conviction &amp; concentration rebalancing</small>
            </div>
          </button>

          <div className="quick-action-divider" />

          <button
            type="button"
            className="quick-action-item"
            role="menuitem"
            onClick={() => {
              onToggleStream()
            }}
          >
            <Radio size={15} color={liveStreaming ? '#10b981' : '#64748b'} />
            <div>
              <strong>Real-Time SSE Streaming</strong>
              <small>{liveStreaming ? 'Streaming active (live ticks)' : 'Paused (click to activate)'}</small>
            </div>
            <span className={`status-pill ${liveStreaming ? 'entry' : 'cooldown'}`} style={{ marginLeft: 'auto' }}>
              {liveStreaming ? 'LIVE' : 'PAUSED'}
            </span>
          </button>

          <button
            type="button"
            className="quick-action-item"
            role="menuitem"
            onClick={() => {
              onToggleScenario()
            }}
          >
            {scenario ? <ShieldCheck size={15} color="#10b981" /> : <Play size={15} color="#64748b" />}
            <div>
              <strong>Demo Decision Event</strong>
              <small>{scenario ? 'CRDO breakout event active' : 'Run simulated trigger'}</small>
            </div>
            <span className={`status-pill ${scenario ? 'entry' : 'cooldown'}`} style={{ marginLeft: 'auto' }}>
              {scenario ? 'ACTIVE' : 'IDLE'}
            </span>
          </button>

          <div className="quick-action-divider" />

          <button
            type="button"
            className="quick-action-item"
            role="menuitem"
            onClick={() => {
              onToggleTheme()
            }}
          >
            {theme === 'dark' ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="#6366f1" />}
            <div>
              <strong>{theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Slate Dark Theme'}</strong>
              <small>Current theme: {theme.toUpperCase()}</small>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
