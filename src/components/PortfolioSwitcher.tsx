import React, { useState, useEffect, useRef } from 'react'
import {
  Briefcase,
  ChevronDown,
  Check,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react'
import { api } from '../api/client'
import { PortfolioSource, SavedPortfolioItem } from '../types'

interface PortfolioSwitcherProps {
  currentSource: PortfolioSource | null
  onPortfolioChanged: () => void | Promise<void>
}

const formatCompactCurrency = (value: number) => {
  if (!value || isNaN(value)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

const formatDate = (isoString: string) => {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export const PortfolioSwitcher: React.FC<PortfolioSwitcherProps> = ({
  currentSource,
  onPortfolioChanged,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [portfolios, setPortfolios] = useState<SavedPortfolioItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState<number | 'reset' | 'upload' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const isDemoActive = currentSource?.source !== 'uploaded' && currentSource?.source !== 'alpaca'
  const isAlpacaActive = currentSource?.source === 'alpaca'
  const activeName = currentSource?.source === 'uploaded'
    ? (currentSource.name ?? 'Custom Portfolio')
    : isAlpacaActive
      ? 'Alpaca Paper Account'
      : 'Unified Benchmark Demo'

  const activeHoldingsCount = currentSource?.count ?? 0

  const loadSavedPortfolios = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await api.getSavedPortfolios()
      setPortfolios(res.portfolios || [])
    } catch {
      setErrorMessage('Failed to fetch saved portfolios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSavedPortfolios()
    } else {
      setEditingId(null)
      setDeleteConfirmId(null)
      setErrorMessage(null)
    }
  }, [isOpen])

  // Focus rename input on editingId change
  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus()
    }
  }, [editingId])

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleActivate = async (id: number) => {
    setActionBusy(id)
    setErrorMessage(null)
    try {
      await api.activateSavedPortfolio(id)
      await onPortfolioChanged()
      await loadSavedPortfolios()
      setIsOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate portfolio.'
      setErrorMessage(msg)
    } finally {
      setActionBusy(null)
    }
  }

  const handleResetToDemo = async () => {
    setActionBusy('reset')
    setErrorMessage(null)
    try {
      await api.resetPortfolio()
      await onPortfolioChanged()
      await loadSavedPortfolios()
      setIsOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch to demo book.'
      setErrorMessage(msg)
    } finally {
      setActionBusy(null)
    }
  }

  const startRename = (p: SavedPortfolioItem) => {
    setEditingId(p.id)
    setEditingName(p.name)
    setDeleteConfirmId(null)
  }

  const saveRename = async (id: number, e: React.FormEvent) => {
    e.preventDefault()
    if (!editingName.trim()) return
    try {
      await api.renameSavedPortfolio(id, editingName.trim())
      setEditingId(null)
      await onPortfolioChanged()
      await loadSavedPortfolios()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rename portfolio.'
      setErrorMessage(msg)
    }
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  const confirmDelete = (id: number) => {
    setDeleteConfirmId(id)
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    setActionBusy(id)
    setErrorMessage(null)
    try {
      await api.deleteSavedPortfolio(id)
      setDeleteConfirmId(null)
      await onPortfolioChanged()
      await loadSavedPortfolios()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete portfolio.'
      setErrorMessage(msg)
    } finally {
      setActionBusy(null)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActionBusy('upload')
    setErrorMessage(null)
    try {
      await api.importPortfolio(file)
      await onPortfolioChanged()
      await loadSavedPortfolios()
      setIsOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import CSV portfolio.'
      setErrorMessage(msg)
    } finally {
      setActionBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="portfolio-switcher-container" ref={dropdownRef}>
      {/* Hidden file upload input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Main Topbar Trigger Button */}
      <button
        type="button"
        className={`portfolio-switcher-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Switch or manage portfolio profiles"
      >
        <div className="portfolio-switcher-icon-wrap">
          <Briefcase size={15} className="portfolio-switcher-icon" />
        </div>
        <div className="portfolio-switcher-label">
          <span className="portfolio-switcher-sub">PORTFOLIO</span>
          <strong className="portfolio-switcher-name">
            {activeName}
          </strong>
        </div>
        <span className="portfolio-switcher-badge">
          {activeHoldingsCount} pos
        </span>
        <ChevronDown size={14} className={`portfolio-switcher-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="portfolio-switcher-dropdown" role="region" aria-label="Portfolio Switcher">
          <div className="portfolio-switcher-header">
            <div className="portfolio-switcher-title">
              <Briefcase size={14} />
              <span>Portfolio Profiles ({portfolios.length + 1})</span>
            </div>
            <button
              type="button"
              className="portfolio-switcher-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close switcher"
            >
              <X size={14} />
            </button>
          </div>

          {errorMessage && (
            <div className="portfolio-switcher-error">
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action indicator if global operation running */}
          {actionBusy && (
            <div className="portfolio-switcher-busy-banner">
              <Loader2 size={13} className="spin" />
              <span>Updating active portfolio & calculating live signals...</span>
            </div>
          )}

          <div className="portfolio-switcher-list">
            {/* 1. Default Benchmark Demo Portfolio Item */}
            <button
              type="button"
              className={`portfolio-switcher-item ${isDemoActive ? 'selected' : ''}`}
              onClick={handleResetToDemo}
            >
              <div className="portfolio-item-left">
                <span className={`portfolio-item-radio ${isDemoActive ? 'checked' : ''}`}>
                  {isDemoActive && <Check size={12} />}
                </span>
                <div className="portfolio-item-info">
                  <div className="portfolio-item-name-row">
                    <span className="portfolio-item-name">Unified Benchmark Demo</span>
                    <span className="portfolio-item-tag benchmark">Preset</span>
                  </div>
                  <span className="portfolio-item-meta">
                    Seeded multi-asset portfolio · 12 holdings
                  </span>
                </div>
              </div>
              {actionBusy === 'reset' && <Loader2 size={14} className="spin" />}
            </button>

            {/* 2. Alpaca Paper Account (if active) */}
            {isAlpacaActive && (
              <div className="portfolio-switcher-item selected">
                <div className="portfolio-item-left">
                  <span className="portfolio-item-radio checked">
                    <Check size={12} />
                  </span>
                  <div className="portfolio-item-info">
                    <div className="portfolio-item-name-row">
                      <span className="portfolio-item-name">Alpaca Paper Account</span>
                      <span className="portfolio-item-tag live">Broker API</span>
                    </div>
                    <span className="portfolio-item-meta">
                      Live broker sync · {activeHoldingsCount} positions
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Section Divider */}
            <div className="portfolio-switcher-section-title">
              <span>SAVED CUSTOM PORTFOLIOS</span>
            </div>

            {/* 3. Saved Custom Portfolios */}
            {loading ? (
              <div className="portfolio-switcher-empty">
                <Loader2 size={16} className="spin" />
                <span>Loading portfolios...</span>
              </div>
            ) : portfolios.length === 0 ? (
              <div className="portfolio-switcher-empty-prompt">
                <FileSpreadsheet size={20} className="portfolio-empty-icon" />
                <p>No saved custom portfolios yet.</p>
                <small>Upload a CSV file below to create a switchable portfolio profile.</small>
              </div>
            ) : (
              portfolios.map((p) => {
                const isItemActive = currentSource?.source === 'uploaded' && (currentSource.id === p.id || (!currentSource.id && p.is_active))
                const isEditing = editingId === p.id
                const isDeleting = deleteConfirmId === p.id
                const isBusy = actionBusy === p.id

                return (
                  <div
                    key={p.id}
                    className={`portfolio-switcher-item ${isItemActive ? 'selected' : ''}`}
                  >
                    {isEditing ? (
                      <form
                        className="portfolio-rename-form"
                        onSubmit={(e) => saveRename(p.id, e)}
                      >
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="portfolio-rename-input"
                          placeholder="Portfolio name"
                          maxLength={40}
                        />
                        <button
                          type="submit"
                          className="portfolio-rename-btn save"
                          title="Save name"
                          aria-label="Save portfolio name"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          className="portfolio-rename-btn cancel"
                          onClick={cancelRename}
                          title="Cancel"
                          aria-label="Cancel rename"
                        >
                          <X size={12} />
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="portfolio-item-select-btn"
                          onClick={() => !isDeleting && handleActivate(p.id)}
                        >
                          <div className="portfolio-item-left">
                            <span className={`portfolio-item-radio ${isItemActive ? 'checked' : ''}`}>
                              {isItemActive && <Check size={12} />}
                            </span>

                            <div className="portfolio-item-info">
                              <div className="portfolio-item-name-row">
                                <span className="portfolio-item-name" title={p.name}>
                                  {p.name}
                                </span>
                                {isItemActive && (
                                  <span className="portfolio-item-tag active">Active</span>
                                )}
                              </div>
                              <span className="portfolio-item-meta">
                                {p.count} {p.count === 1 ? 'holding' : 'holdings'}
                                {p.total_value > 0 && ` · ${formatCompactCurrency(p.total_value)}`}
                                {p.imported_at && ` · ${formatDate(p.imported_at)}`}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="portfolio-item-actions">
                          {isBusy ? (
                            <Loader2 size={14} className="spin" />
                          ) : isDeleting ? (
                            <div className="portfolio-delete-confirm">
                              <span>Delete?</span>
                              <button
                                type="button"
                                className="portfolio-btn-danger"
                                onClick={() => handleDelete(p.id)}
                                title="Confirm delete"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className="portfolio-btn-subtle"
                                onClick={() => setDeleteConfirmId(null)}
                                title="Cancel"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="portfolio-action-btn"
                                onClick={() => startRename(p)}
                                title="Rename portfolio"
                                aria-label={`Rename ${p.name}`}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="portfolio-action-btn delete"
                                onClick={() => confirmDelete(p.id)}
                                title="Delete portfolio"
                                aria-label={`Delete ${p.name}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Switcher Footer: Upload New Portfolio */}
          <div className="portfolio-switcher-footer">
            <button
              type="button"
              className="portfolio-switcher-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={actionBusy === 'upload'}
            >
              {actionBusy === 'upload' ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Importing & Calculating...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Upload New Portfolio (CSV)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
