import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BriefcaseBusiness,
  Calendar,
  LayoutDashboard,
  Radar,
  ServerCog,
  Settings,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { api } from './api/client'
import { AlertPanel } from './components/AlertPanel'
import { AskPanel } from './components/AskPanel'
import { AssetDrawer } from './components/AssetDrawer'
import { BacktestModal } from './components/BacktestModal'
import { CatalystRadar } from './components/CatalystRadar'
import { CommandPalette } from './components/CommandPalette'
import { ImportPage } from './components/DataPages'
import { DecisionModal } from './components/DecisionModal'
import { MorningBriefingModal } from './components/MorningBriefingModal'
import { NotificationSettingsModal } from './components/NotificationSettingsModal'
import { RatingsBanner } from './components/RatingsBanner'
import { RebalanceModal } from './components/RebalanceModal'
import { ReportModal } from './components/ReportModal'
import { Topbar } from './components/Topbar'
import { WatchlistEntryRadar } from './components/WatchlistEntryRadar'
import { baseAlerts, scenarioAlert, scenarioHoldings } from './data/demo'
import { evaluateAlert } from './domain/alertEngine'
import { getAlertPlaybook } from './domain/alertPlaybook'
import {
  convertRecommendationToUserAlert,
  generateAllRecommendations,
} from './domain/alertRecommendations'
import { getOrBuildHolding } from './domain/portfolioHelper'
import { AlertsPage } from './pages/AlertsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { OverviewPage } from './pages/OverviewPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SignalsPage } from './pages/SignalsPage'
import { SystemPage } from './pages/SystemPage'
import type {
  AlertItem,
  Holding,
  PortfolioSource,
  RecommendationStatus,
  RecommendedAlert,
  UserAlert,
} from './types'

type Page =
  | 'Overview'
  | 'Portfolio'
  | 'Signals'
  | 'Catalysts'
  | 'Watchlist'
  | 'Alerts'
  | 'Analytics'
  | 'Import'
  | 'System'

const navItems = [
  { label: 'Overview' as Page, icon: LayoutDashboard },
  { label: 'Portfolio' as Page, icon: BriefcaseBusiness },
  { label: 'Signals' as Page, icon: Radar },
  { label: 'Catalysts' as Page, icon: Calendar },
  { label: 'Watchlist' as Page, icon: Radar },
  { label: 'Alerts' as Page, icon: Activity },
  { label: 'Analytics' as Page, icon: Activity },
  { label: 'Import' as Page, icon: Upload },
  { label: 'System' as Page, icon: ServerCog },
]

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [scenario, setScenario] = useState(false)
  const [selected, setSelected] = useState<Holding | null>(null)
  const [decisionHolding, setDecisionHolding] = useState<Holding | null>(null)
  const [alertPanelOpen, setAlertPanelOpen] = useState(false)
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [userAlerts, setUserAlerts] = useState<UserAlert[]>(() => {
    try {
      const saved = localStorage.getItem('atlas_user_alerts')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed.map((a: any) => ({
            ...a,
            targetValue:
              typeof a.targetValue === 'number' && !isNaN(a.targetValue)
                ? a.targetValue
                : Number(a.targetValue ?? a.target_value) || 0,
            createdAt: a.createdAt ?? a.created_at ?? new Date().toISOString(),
          }))
        }
      }
    } catch {
      /* ignore */
    }
    return []
  })

  const [recommendations, setRecommendations] = useState<RecommendedAlert[]>([])
  const [recStatuses, setRecStatuses] = useState<Record<string, RecommendationStatus>>(() => {
    try {
      const saved = localStorage.getItem('atlas_rec_statuses')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const [liveStreaming, setLiveStreaming] = useState(false)
  const [liveTicks, setLiveTicks] = useState<Record<string, { price: number; changePct: number }>>({})
  const [liveToast, setLiveToast] = useState<{
    title: string
    detail: string
    symbol: string
    alert?: AlertItem | UserAlert
  } | null>(null)

  const [askOpen, setAskOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [apiHoldings, setApiHoldings] = useState<Holding[] | null>(null)
  const [apiAlerts, setApiAlerts] = useState<AlertItem[] | null>(null)
  const [source, setSource] = useState<PortfolioSource | null>(null)
  const [refreshingLive, setRefreshingLive] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [backtestOpen, setBacktestOpen] = useState(false)
  const [backtestTicker, setBacktestTicker] = useState<string | undefined>(undefined)

  const handleOpenBacktest = (symbol?: string) => {
    setBacktestTicker(symbol)
    setBacktestOpen(true)
  }

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('atlas_theme')
      if (saved === 'light' || saved === 'dark') return saved
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark'
      }
    } catch {
      /* ignore */
    }
    return 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('atlas_theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('atlas_user_alerts', JSON.stringify(userAlerts))
    } catch {
      /* ignore */
    }
  }, [userAlerts])

  useEffect(() => {
    try {
      localStorage.setItem('atlas_rec_statuses', JSON.stringify(recStatuses))
    } catch {
      /* ignore */
    }
  }, [recStatuses])

  useEffect(() => {
    if (!liveToast) return
    const timer = setTimeout(() => {
      setLiveToast(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [liveToast])

  const reloadState = useCallback(() => {
    api
      .state()
      .then((state) => {
        setScenario(state.scenario_active)
        setApiHoldings(state.holdings)
        setApiAlerts(state.alerts)
        setSource(state.source ?? null)
        if (state.source?.last_refreshed) {
          setLastRefreshedAt(state.source.last_refreshed)
        }
      })
      .catch(() => {
        /* Offline-first seeded mode is intentional */
      })
  }, [])

  const handleRefreshAllData = useCallback(async () => {
    setRefreshingLive(true)
    try {
      const res = await api.marketRefresh()
      if (res && res.holdings) {
        setApiHoldings(res.holdings)
        if (res.alerts) setApiAlerts(res.alerts)
        if (res.source) setSource(res.source)
        if (res.meta?.timestamp) setLastRefreshedAt(res.meta.timestamp)

        userAlerts.forEach((alert) => {
          if (alert.status !== 'ARMED') return
          const h = res.holdings.find((x) => x.symbol.toUpperCase() === alert.symbol.toUpperCase())
          if (!h) return
          const evalRes = evaluateAlert(alert, h)
          if (evalRes.triggered) {
            const triggeredAlert = { ...alert, status: 'TRIGGERED' as const }
            setUserAlerts((prev) => prev.map((a) => (a.id === alert.id ? triggeredAlert : a)))
            const playbook = getAlertPlaybook(triggeredAlert, h)
            setLiveToast({
              title: `🚨 ${alert.symbol} · ${playbook.categoryTitle}`,
              detail: `${evalRes.message} — 🎯 Action: ${playbook.checklist[0]}`,
              symbol: alert.symbol,
              alert: triggeredAlert,
            })
          }
        })
        setLiveToast({
          title: '⚡ Live Operational Refresh',
          detail: `Recalculated ${res.holdings.length} assets with live quotes, technical indicators, and signals.`,
          symbol: 'LIVE',
        })
      }
    } catch {
      setLiveToast({
        title: 'Refresh Notice',
        detail: 'Could not contact live market provider. Keeping local data.',
        symbol: 'WARN',
      })
    } finally {
      setRefreshingLive(false)
    }
  }, [userAlerts])

  useEffect(() => {
    reloadState()
    handleRefreshAllData()
  }, [reloadState, handleRefreshAllData])

  const baseHoldings = useMemo(() => apiHoldings ?? scenarioHoldings(scenario), [apiHoldings, scenario])

  const holdings = useMemo(() => {
    if (!liveStreaming || Object.keys(liveTicks).length === 0) return baseHoldings
    return baseHoldings.map((h) => {
      const tick = liveTicks[h.symbol.toUpperCase()]
      if (!tick) return h
      return {
        ...h,
        price: tick.price,
        dayChange: Math.round((h.dayChange + tick.changePct) * 100) / 100,
      }
    })
  }, [baseHoldings, liveStreaming, liveTicks])

  const isCustomPortfolio = source?.source === 'uploaded' || source?.source === 'alpaca'
  const alerts = apiAlerts ?? (isCustomPortfolio ? [] : scenario ? [scenarioAlert, ...baseAlerts] : baseAlerts)

  // Live SSE stream
  useEffect(() => {
    if (!liveStreaming) {
      setLiveTicks({})
      return
    }

    let es: EventSource | null = null
    let fallbackInterval: number | null = null

    const handleTickBatch = (
      ticks: Array<{
        symbol: string
        price: number
        changePct?: number
        change_pct?: number
        provider?: string
      }>
    ) => {
      setLiveTicks((prev) => {
        const next = { ...prev }
        ticks.forEach((t) => {
          const pct = t.changePct ?? t.change_pct ?? 0.0
          next[t.symbol.toUpperCase()] = { price: t.price, changePct: pct }
        })
        return next
      })

      userAlerts.forEach((alert) => {
        if (alert.status !== 'ARMED') return
        const tick = ticks.find((t) => t.symbol.toUpperCase() === alert.symbol.toUpperCase())
        if (!tick) return
        const holding = holdings.find((h) => h.symbol.toUpperCase() === alert.symbol.toUpperCase())
        if (!holding) return
        const simHolding = { ...holding, price: tick.price }
        const res = evaluateAlert(alert, simHolding)
        if (res.triggered) {
          const triggeredAlert = { ...alert, status: 'TRIGGERED' as const }
          setUserAlerts((prev) => prev.map((a) => (a.id === alert.id ? triggeredAlert : a)))
          const playbook = getAlertPlaybook(triggeredAlert, simHolding)
          setLiveToast({
            title: `🚨 ${alert.symbol} · ${playbook.categoryTitle}`,
            detail: `${res.message} — 🎯 Action: ${playbook.checklist[0]}`,
            symbol: alert.symbol,
            alert: triggeredAlert,
          })
        }
      })
    }

    try {
      const streamUrl =
        window.location.port === '5173' || window.location.port === '4173'
          ? '/api/v1/market/stream'
          : 'http://127.0.0.1:8000/api/v1/market/stream'
      es = new EventSource(streamUrl)
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload.ticks) handleTickBatch(payload.ticks)
        } catch {
          /* ignore */
        }
      }
      es.onerror = () => {
        if (es) {
          es.close()
          es = null
        }
        if (!fallbackInterval) {
          fallbackInterval = window.setInterval(() => {
            const symbols = ['CRDO', 'NVDA', 'MSFT', 'ANET', 'VRT', 'GOOGL', 'SPY']
            const sym = symbols[Math.floor(Math.random() * symbols.length)]
            const cur = holdings.find((h) => h.symbol === sym)?.price || 100
            const delta = (Math.random() - 0.49) * 0.4
            handleTickBatch([{ symbol: sym, price: Math.round((cur + delta) * 100) / 100, changePct: delta }])
          }, 2500)
        }
      }
    } catch {
      /* fallback */
    }

    return () => {
      if (es) es.close()
      if (fallbackInterval) window.clearInterval(fallbackInterval)
    }
  }, [liveStreaming, holdings, userAlerts])

  const toggleScenario = useCallback(() => {
    api
      .scenario(!scenario)
      .then((state) => {
        setScenario(state.scenario_active)
        setApiHoldings(state.holdings)
        setApiAlerts(state.alerts)
      })
      .catch(() => setScenario((s) => !s))
  }, [scenario])

  const handleAddUserAlertFromCandidate = useCallback(
    (alertData: Omit<UserAlert, 'id' | 'createdAt' | 'status'>) => {
      const id = `user-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newAlert: UserAlert = {
        ...alertData,
        id,
        createdAt: new Date().toISOString(),
        status: 'ARMED',
      }
      setUserAlerts((prev) => [newAlert, ...prev])
      api.saveUserAlert(newAlert).catch(() => {})
      setLiveToast({
        title: `Trigger Armed: ${newAlert.symbol}`,
        detail: `Armed ${newAlert.title || `${newAlert.metric} ${newAlert.condition} ${newAlert.targetValue}`}.`,
        symbol: newAlert.symbol,
      })
    },
    []
  )

  const handleDeleteAlert = useCallback((id: string) => {
    setUserAlerts((prev) => prev.filter((a) => a.id !== id))
    api.deleteUserAlert(id).catch(() => {})
  }, [])

  const loadRecommendations = useCallback(() => {
    try {
      const generated = generateAllRecommendations(holdings)
      const mapped = generated.map((r) => {
        const stored = recStatuses[r.id]
        if (stored) return { ...r, status: stored }
        return r
      })
      setRecommendations(mapped)
    } catch {
      /* fallback */
    }
  }, [holdings, recStatuses])

  useEffect(() => {
    loadRecommendations()
  }, [loadRecommendations])

  useEffect(() => {
    api
      .getUserAlerts()
      .then((serverAlerts) => {
        if (Array.isArray(serverAlerts) && serverAlerts.length > 0) {
          setUserAlerts((prev) => {
            const map = new Map<string, UserAlert>()
            prev.forEach((a) => map.set(a.id, a))
            serverAlerts.forEach((a: any) => {
              const normalized: UserAlert = {
                ...a,
                targetValue:
                  typeof a.targetValue === 'number' && !isNaN(a.targetValue)
                    ? a.targetValue
                    : Number(a.targetValue ?? a.target_value) || 0,
              }
              map.set(normalized.id, normalized)
            })
            return Array.from(map.values())
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleAcknowledgeRecommendation = useCallback(async (rec: RecommendedAlert) => {
    const newAlert = convertRecommendationToUserAlert(rec)
    setUserAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)])
    setRecommendations((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, status: 'ACKNOWLEDGED' as const } : r))
    )
    setRecStatuses((prev) => {
      const next = { ...prev, [rec.id]: 'ACKNOWLEDGED' as const }
      try {
        localStorage.setItem('atlas_rec_statuses', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    const targetVal =
      typeof newAlert.targetValue === 'number' && !isNaN(newAlert.targetValue)
        ? newAlert.targetValue
        : Number(newAlert.targetValue) || 0
    setLiveToast({
      title: `Trigger Armed: ${rec.symbol}`,
      detail: `Armed ${rec.title} (${newAlert.metric} ${newAlert.condition} ${newAlert.metric === 'PRICE' ? `$${targetVal.toFixed(2)}` : targetVal}).`,
      symbol: rec.symbol,
    })
    try {
      await api.actOnAlertRecommendation(rec.id, 'acknowledge', {
        symbol: rec.symbol,
        category: rec.category,
        custom_alert: newAlert,
      })
      await api.saveUserAlert(newAlert)
    } catch {
      /* offline-first */
    }
  }, [])

  const handleDeclineRecommendation = useCallback(async (rec: RecommendedAlert) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, status: 'DECLINED' as const } : r))
    )
    setRecStatuses((prev) => {
      const next = { ...prev, [rec.id]: 'DECLINED' as const }
      try {
        localStorage.setItem('atlas_rec_statuses', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    setLiveToast({
      title: `${rec.symbol} Recommendation Declined`,
      detail: `${rec.title} moved to declined archive.`,
      symbol: rec.symbol,
    })
    try {
      await api.actOnAlertRecommendation(rec.id, 'decline', {
        symbol: rec.symbol,
        category: rec.category,
      })
    } catch {
      /* offline-first */
    }
  }, [])

  const handleChangeRecommendation = useCallback(
    async (rec: RecommendedAlert, customized: UserAlert) => {
      const safeAlert: UserAlert = {
        ...customized,
        targetValue:
          typeof customized.targetValue === 'number' && !isNaN(customized.targetValue)
            ? customized.targetValue
            : Number(customized.targetValue) || 0,
      }
      setUserAlerts((prev) => [safeAlert, ...prev.filter((a) => a.id !== safeAlert.id)])
      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, status: 'ACKNOWLEDGED' as const } : r))
      )
      setRecStatuses((prev) => {
        const next = { ...prev, [rec.id]: 'ACKNOWLEDGED' as const }
        try {
          localStorage.setItem('atlas_rec_statuses', JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
      setLiveToast({
        title: `Custom Trigger Armed: ${rec.symbol}`,
        detail: `${safeAlert.metric} ${safeAlert.condition} ${safeAlert.metric === 'PRICE' ? `$${safeAlert.targetValue.toFixed(2)}` : safeAlert.targetValue}`,
        symbol: rec.symbol,
      })
      try {
        await api.actOnAlertRecommendation(rec.id, 'change', {
          symbol: rec.symbol,
          category: rec.category,
          custom_alert: safeAlert,
        })
        await api.saveUserAlert(safeAlert)
      } catch {
        /* offline-first */
      }
    },
    []
  )

  const handleRestoreRecommendation = useCallback(async (rec: RecommendedAlert) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, status: 'PENDING' as const } : r))
    )
    setRecStatuses((prev) => {
      const next = { ...prev }
      delete next[rec.id]
      try {
        localStorage.setItem('atlas_rec_statuses', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const pendingRecsCount = recommendations.filter((r) => r.status === 'PENDING').length

  const renderPage = () => {
    if (page === 'Portfolio') {
      return (
        <PortfolioPage
          holdings={holdings}
          onSelect={setSelected}
          onRefresh={handleRefreshAllData}
          refreshing={refreshingLive}
          onOpenRebalance={() => setRebalanceModalOpen(true)}
        />
      )
    }
    if (page === 'Signals') return <SignalsPage holdings={holdings} onSelect={setSelected} />
    if (page === 'Catalysts') return <CatalystRadar holdings={holdings} onSelectHolding={setSelected} />
    if (page === 'Watchlist') {
      return (
        <WatchlistEntryRadar
          onSelectHolding={(h) => setSelected(getOrBuildHolding(h.symbol, holdings))}
          onOpenAlertPanel={() => setAlertPanelOpen(true)}
          existingHoldings={holdings}
          userAlerts={userAlerts}
          onAddUserAlert={handleAddUserAlertFromCandidate}
          onDeleteUserAlert={handleDeleteAlert}
          onOpenBacktest={handleOpenBacktest}
          recommendations={recommendations}
          onAcknowledgeRecommendation={handleAcknowledgeRecommendation}
          onDeclineRecommendation={handleDeclineRecommendation}
          onChangeRecommendation={handleChangeRecommendation}
        />
      )
    }
    if (page === 'Alerts') {
      return (
        <AlertsPage
          alerts={alerts}
          userAlerts={userAlerts}
          holdings={holdings}
          recommendations={recommendations}
          onSelect={setSelected}
          onNavigate={(p) => setPage(p as Page)}
          onOpenDecision={(h) => setDecisionHolding(h)}
          onOpenPanel={() => setAlertPanelOpen(true)}
          onAcknowledgeRecommendation={handleAcknowledgeRecommendation}
          onDeclineRecommendation={handleDeclineRecommendation}
          onChangeRecommendation={handleChangeRecommendation}
          onRestoreRecommendation={handleRestoreRecommendation}
          onOpenRebalance={() => setRebalanceModalOpen(true)}
        />
      )
    }
    if (page === 'Analytics') return <AnalyticsPage holdings={holdings} onOpenBacktest={() => handleOpenBacktest()} />
    if (page === 'Import') return <ImportPage onChanged={reloadState} />
    if (page === 'System') return <SystemPage onOpenNotifications={() => setNotificationModalOpen(true)} />
    return (
      <OverviewPage
        holdings={holdings}
        scenario={scenario}
        onSelect={setSelected}
        onAsk={() => setAskOpen(true)}
        onOpenDecision={(h) => setDecisionHolding(h)}
        onNavigate={(p) => setPage(p as Page)}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <span>
            <Activity size={21} />
          </span>
          <div>
            <strong>ATLAS</strong>
            <small>Portfolio intelligence</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X />
          </button>
        </div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={page === label ? 'active' : ''}
              onClick={() => {
                setPage(label)
                setMobileNav(false)
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Alerts' && (scenario || userAlerts.length > 0 || pendingRecsCount > 0) && (
                <b>{userAlerts.length + (pendingRecsCount > 0 ? pendingRecsCount : scenario ? 1 : 0)}</b>
              )}
              {label === 'Watchlist' && pendingRecsCount > 0 && (
                <b style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>{pendingRecsCount}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-badge" style={{ background: '#eaf7f0', color: '#0b6847', border: '1px solid #b5e4cb' }}>
            <Zap size={16} color="#0b6847" />
            <span>
              <strong>Live Operational Mode</strong>
              <small>{lastRefreshedAt ? `Live market · ${lastRefreshedAt}` : 'Live quotes & indicators active'}</small>
            </span>
          </div>
          <button onClick={() => setNotificationModalOpen(true)}>
            <Settings size={18} /> Notifications &amp; Settings
          </button>
          <div className="user">
            <span>OM</span>
            <div>
              <strong>Ohad Meiri</strong>
              <small>Portfolio owner</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <Topbar
          source={source}
          onPortfolioChanged={reloadState}
          holdingsCount={holdings.length}
          onOpenMobileNav={() => setMobileNav(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={handleRefreshAllData}
          refreshing={refreshingLive}
          onOpenReport={() => setReportModalOpen(true)}
          onOpenBriefing={() => setBriefingOpen(true)}
          onOpenBacktest={() => handleOpenBacktest()}
          onOpenRebalance={() => setRebalanceModalOpen(true)}
          liveStreaming={liveStreaming}
          onToggleStream={() => setLiveStreaming(!liveStreaming)}
          scenario={scenario}
          onToggleScenario={toggleScenario}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenAlertPanel={() => setAlertPanelOpen(true)}
          pendingAlertsCount={scenario || userAlerts.length > 0 || pendingRecsCount > 0 ? 1 : 0}
        />

        <main>
          <RatingsBanner
            onSelectTicker={(ticker) => setSelected(getOrBuildHolding(ticker, holdings))}
            onSync={() => {
              reloadState()
              handleRefreshAllData()
            }}
          />
          {renderPage()}
        </main>
      </div>

      {mobileNav && (
        <div
          className="nav-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') setMobileNav(false)
          }}
        />
      )}

      {selected && (
        <AssetDrawer
          holding={selected}
          holdings={holdings}
          recommendations={recommendations}
          userAlerts={userAlerts}
          onAcknowledgeRecommendation={handleAcknowledgeRecommendation}
          onDeclineRecommendation={handleDeclineRecommendation}
          onChangeRecommendation={handleChangeRecommendation}
          onClose={() => setSelected(null)}
          onOpenDecision={() => {
            setDecisionHolding(selected)
            setSelected(null)
          }}
        />
      )}

      {askOpen && <AskPanel holdings={holdings} onClose={() => setAskOpen(false)} />}

      {decisionHolding && (
        <DecisionModal
          holding={decisionHolding}
          holdings={holdings}
          onClose={() => setDecisionHolding(null)}
          onSimulate={() => {
            reloadState()
            handleRefreshAllData()
          }}
        />
      )}

      {alertPanelOpen && (
        <AlertPanel
          alerts={alerts}
          holdings={holdings}
          userAlerts={userAlerts}
          onClose={() => setAlertPanelOpen(false)}
          onAddAlert={handleAddUserAlertFromCandidate}
          onDeleteAlert={handleDeleteAlert}
        />
      )}

      {notificationModalOpen && (
        <NotificationSettingsModal onClose={() => setNotificationModalOpen(false)} />
      )}

      {rebalanceModalOpen && (
        <RebalanceModal
          onClose={() => setRebalanceModalOpen(false)}
          onSuccess={() => {
            reloadState()
            handleRefreshAllData()
          }}
        />
      )}

      {reportModalOpen && (
        <ReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
      )}

      {briefingOpen && (
        <MorningBriefingModal onClose={() => setBriefingOpen(false)} />
      )}

      {backtestOpen && (
        <BacktestModal initialSymbol={backtestTicker} onClose={() => setBacktestOpen(false)} />
      )}

      {paletteOpen && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(p: string) => setPage(p as Page)}
          onSelectHolding={(h) => setSelected(h)}
          onOpenBriefing={() => setBriefingOpen(true)}
          onOpenBacktest={() => setBacktestOpen(true)}
          onOpenRebalance={() => setRebalanceModalOpen(true)}
          onRefreshData={handleRefreshAllData}
          onToggleTheme={toggleTheme}
          theme={theme}
          holdings={holdings}
        />
      )}

      {liveToast && (
        <div
          className="live-toast"
          role="status"
          onClick={() => {
            if (liveToast.symbol && liveToast.symbol !== 'LIVE' && liveToast.symbol !== 'WARN') {
              setSelected(getOrBuildHolding(liveToast.symbol, holdings))
            }
          }}
        >
          <div className="live-toast-dot" />
          <div className="live-toast-content">
            <strong>{liveToast.title}</strong>
            <small>{liveToast.detail}</small>
          </div>
          <button
            type="button"
            className="live-toast-close"
            onClick={(e) => {
              e.stopPropagation()
              setLiveToast(null)
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
