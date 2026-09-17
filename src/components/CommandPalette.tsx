import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart2,
  Calendar,
  Flame,
  LayoutDashboard,
  ListChecks,
  Moon,
  Scale,
  Search,
  ServerCog,
  Sun,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import type { Holding } from '../types'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  holdings: Holding[]
  onSelectHolding: (holding: Holding) => void
  onNavigate: (page: string) => void
  onRefreshData: () => void
  onOpenBriefing: () => void
  onOpenBacktest: () => void
  onOpenRebalance: () => void
  onToggleTheme: () => void
  theme: 'light' | 'dark'
}

interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  category: 'Actions' | 'Navigation' | 'Holdings'
  icon: React.ElementType
  onSelect: () => void
}

export function CommandPalette({
  open,
  onClose,
  holdings,
  onSelectHolding,
  onNavigate,
  onRefreshData,
  onOpenBriefing,
  onOpenBacktest,
  onOpenRebalance,
  onToggleTheme,
  theme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Global keydown handler for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Build items list
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      // Actions
      {
        id: 'act-refresh',
        title: 'Refresh All Market Data',
        subtitle: 'Fetch live quotes, recalculate signals & evaluate alerts',
        category: 'Actions',
        icon: Zap,
        onSelect: () => {
          onClose()
          onRefreshData()
        },
      },
      {
        id: 'act-briefing',
        title: 'Pre-Market Morning Briefing',
        subtitle: 'Synthesize overnight pulse, catalysts & dispatch to Telegram',
        category: 'Actions',
        icon: Sun,
        onSelect: () => {
          onClose()
          onOpenBriefing()
        },
      },
      {
        id: 'act-backtest',
        title: 'Strategy Rule Backtester',
        subtitle: 'Run quantitative simulation vs SPY benchmark',
        category: 'Actions',
        icon: BarChart2,
        onSelect: () => {
          onClose()
          onOpenBacktest()
        },
      },
      {
        id: 'act-rebalance',
        title: 'Portfolio Rebalance Engine',
        subtitle: 'Model conviction rebalancing with Alpaca execution',
        category: 'Actions',
        icon: Scale,
        onSelect: () => {
          onClose()
          onOpenRebalance()
        },
      },
      {
        id: 'act-theme',
        title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Slate Dark Theme',
        subtitle: `Current active theme: ${theme.toUpperCase()}`,
        category: 'Actions',
        icon: theme === 'dark' ? Sun : Moon,
        onSelect: () => {
          onClose()
          onToggleTheme()
        },
      },

      // Navigation
      {
        id: 'nav-overview',
        title: 'Overview',
        subtitle: 'Portfolio summary, sparklines & asset allocation',
        category: 'Navigation',
        icon: LayoutDashboard,
        onSelect: () => {
          onClose()
          onNavigate('Overview')
        },
      },
      {
        id: 'nav-portfolio',
        title: 'Portfolio Holdings',
        subtitle: 'Asset weights, cost basis, P&L & positions table',
        category: 'Navigation',
        icon: Activity,
        onSelect: () => {
          onClose()
          onNavigate('Portfolio')
        },
      },
      {
        id: 'nav-signals',
        title: 'Signal Radar',
        subtitle: 'Atlas quant scores, setup stages & conviction breakdown',
        category: 'Navigation',
        icon: Flame,
        onSelect: () => {
          onClose()
          onNavigate('Signals')
        },
      },
      {
        id: 'nav-catalysts',
        title: 'Catalysts Radar & Dividends',
        subtitle: 'Earnings calendar, BMO/AMC badges & cashflow projections',
        category: 'Navigation',
        icon: Calendar,
        onSelect: () => {
          onClose()
          onNavigate('Catalysts')
        },
      },
      {
        id: 'nav-watchlist',
        title: 'Watchlist',
        subtitle: 'Candidate securities, technical notes & ratings',
        category: 'Navigation',
        icon: ListChecks,
        onSelect: () => {
          onClose()
          onNavigate('Watchlist')
        },
      },
      {
        id: 'nav-analytics',
        title: 'Risk Analytics & Heatmap',
        subtitle: 'Stress testing, 95% VaR & correlation matrix',
        category: 'Navigation',
        icon: BarChart2,
        onSelect: () => {
          onClose()
          onNavigate('Analytics')
        },
      },
      {
        id: 'nav-import',
        title: 'Import Data & CSV',
        subtitle: 'Upload broker export, custom portfolios & watchlists',
        category: 'Navigation',
        icon: Upload,
        onSelect: () => {
          onClose()
          onNavigate('Import')
        },
      },
      {
        id: 'nav-system',
        title: 'System Health & Runner',
        subtitle: 'Background scheduler, broker connection & data status',
        category: 'Navigation',
        icon: ServerCog,
        onSelect: () => {
          onClose()
          onNavigate('System')
        },
      },
    ]

    // Append holdings
    holdings.forEach((h) => {
      if (h.symbol === 'CASH') return
      items.push({
        id: `hold-${h.symbol}`,
        title: `${h.symbol} · ${h.name}`,
        subtitle: `$${h.price.toFixed(2)} · Score ${h.score ?? '—'} · ${h.weight.toFixed(1)}% portfolio weight`,
        category: 'Holdings',
        icon: Activity,
        onSelect: () => {
          onClose()
          onSelectHolding(h)
        },
      })
    })

    return items
  }, [holdings, onRefreshData, onOpenBriefing, onOpenBacktest, onOpenRebalance, onToggleTheme, theme, onNavigate, onSelectHolding, onClose])

  // Filter items by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase().trim()
    return allItems.filter(
      (item) => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    )
  }, [allItems, query])

  // Keyboard navigation through filtered items
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredItems[selectedIndex]
      if (selected) selected.onSelect()
    }
  }

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="cmd-palette-backdrop"
      role="presentation"
    >
      <div
        ref={modalRef}
        className="cmd-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="cmd-palette-input-wrap">
          <Search size={18} color="var(--muted)" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a ticker, command, or page (e.g. 'NVDA', 'Briefing', 'Catalysts')..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          <button className="icon-button" onClick={onClose} aria-label="Close Command Palette" style={{ width: '28px', height: '28px' }}>
            <X size={15} />
          </button>
        </div>

        <div className="cmd-palette-results">
          {filteredItems.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No matches found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIndex

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="cmd-palette-item-icon">
                    <Icon size={16} />
                  </span>
                  <div className="cmd-palette-item-content">
                    <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                    {item.subtitle && <small style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.subtitle}</small>}
                  </div>
                  <span className="cmd-palette-badge">{item.category}</span>
                  {isSelected && <ArrowRight size={14} color="var(--accent-dark)" style={{ marginLeft: '6px' }} />}
                </button>
              )
            })
          )}
        </div>

        <div className="cmd-palette-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
