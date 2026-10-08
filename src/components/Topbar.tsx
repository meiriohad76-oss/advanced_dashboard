import React from 'react'
import { Bell, Menu, Moon, Search, Sun, Zap } from 'lucide-react'
import type { PortfolioSource } from '../types'
import { PortfolioSwitcher } from './PortfolioSwitcher'
import { QuickActionsMenu } from './QuickActionsMenu'

interface TopbarProps {
  source: PortfolioSource | null
  onPortfolioChanged: () => void
  holdingsCount: number
  onOpenMobileNav: () => void
  onOpenPalette: () => void
  lastRefreshedAt: string | null
  onRefresh: () => void
  refreshing: boolean
  onOpenReport: () => void
  onOpenBriefing: () => void
  onOpenBacktest: () => void
  onOpenRebalance: () => void
  liveStreaming: boolean
  onToggleStream: () => void
  scenario: boolean
  onToggleScenario: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenAlertPanel: () => void
  pendingAlertsCount: number
}

export function Topbar({
  source,
  onPortfolioChanged,
  holdingsCount,
  onOpenMobileNav,
  onOpenPalette,
  lastRefreshedAt,
  onRefresh,
  refreshing,
  onOpenReport,
  onOpenBriefing,
  onOpenBacktest,
  onOpenRebalance,
  liveStreaming,
  onToggleStream,
  scenario,
  onToggleScenario,
  theme,
  onToggleTheme,
  onOpenAlertPanel,
  pendingAlertsCount,
}: TopbarProps) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onOpenMobileNav} aria-label="Open mobile navigation">
        <Menu size={20} />
      </button>

      {/* Left: Portfolio Switcher & Source indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <PortfolioSwitcher currentSource={source} onPortfolioChanged={onPortfolioChanged} />
        <span className="source-badge live">
          {source?.source === 'uploaded'
            ? `${source.name ?? 'Uploaded'} · ${source.count} holdings · ⚡ Live`
            : source?.source === 'alpaca'
              ? `Alpaca · ${source.count} pos · ⚡ Live`
              : `Live Operational · ${holdingsCount} assets`}
        </span>
      </div>

      {/* Center: Command Palette Trigger */}
      <div style={{ margin: '0 auto', maxWidth: '320px', width: '100%', display: 'none' }} className="desktop-search-trigger">
        <button
          className="cmd-palette-trigger"
          onClick={onOpenPalette}
          title="Quick Search & Navigation (Ctrl+K / ⌘K)"
          aria-label="Quick Search"
          style={{ width: '100%' }}
        >
          <Search size={14} />
          <span>Search assets, tools...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      {/* Right: Actions, Refresh, Quick Actions dropdown, Theme, Bell */}
      <div className="topbar-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="cmd-palette-trigger"
          onClick={onOpenPalette}
          title="Quick Search & Navigation (Ctrl+K / ⌘K)"
          aria-label="Quick Search"
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>

        <span className="market-status" title={lastRefreshedAt ? `Last refreshed at ${lastRefreshedAt}` : 'Market open'}>
          <i /> {lastRefreshedAt ? `Live · ${lastRefreshedAt}` : 'Market open'}
        </span>

        <button
          className="refresh-data-btn"
          onClick={onRefresh}
          disabled={refreshing}
          title="Fetch fresh live quotes, calculate technical indicators & signals, and evaluate alerts"
        >
          <Zap size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : '⚡ Refresh'}
        </button>

        <QuickActionsMenu
          onOpenReport={onOpenReport}
          onOpenBriefing={onOpenBriefing}
          onOpenBacktest={onOpenBacktest}
          onOpenRebalance={onOpenRebalance}
          liveStreaming={liveStreaming}
          onToggleStream={onToggleStream}
          scenario={scenario}
          onToggleScenario={onToggleScenario}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />

        <button
          className="icon-button theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button className="icon-button" onClick={onOpenAlertPanel} title="Alert Center" aria-label="Alert Center">
          <Bell size={18} />
          {pendingAlertsCount > 0 && <i className="notification-dot" />}
        </button>
      </div>
    </header>
  )
}
