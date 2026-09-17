import { useCallback, useEffect, useState } from 'react'
import { Scale, CheckCircle2, RefreshCw, X, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react'
import { api } from '../api/client'
import { ModalOverlay } from './ModalOverlay'
import type { RebalanceResponse } from '../types'

interface RebalanceModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export function RebalanceModal({ onClose, onSuccess }: RebalanceModalProps) {
  const [data, setData] = useState<RebalanceResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [executing, setExecuting] = useState<boolean>(false)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set())
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [maxPosition, setMaxPosition] = useState<number>(12)
  const [maxSector, setMaxSector] = useState<number>(30)

  const loadRebalance = useCallback((pos = maxPosition, sec = maxSector) => {
    setLoading(true)
    setResultMessage(null)
    api.portfolioRebalance(pos, sec)
      .then((res) => {
        setData(res)
        // Select all by default
        const allSyms = new Set(res.orders.map((o) => o.symbol))
        setSelectedSymbols(allSyms)
        setLoading(false)
      })
      .catch((err) => {
        setResultMessage(`Failed to compute rebalance: ${String(err)}`)
        setLoading(false)
      })
  }, [maxPosition, maxSector])

  useEffect(() => {
    loadRebalance(maxPosition, maxSector)
  }, [loadRebalance, maxPosition, maxSector])

  const toggleSelect = (sym: string) => {
    const next = new Set(selectedSymbols)
    if (next.has(sym)) next.delete(sym)
    else next.add(sym)
    setSelectedSymbols(next)
  }

  const toggleAll = () => {
    if (!data) return
    if (selectedSymbols.size === data.orders.length) {
      setSelectedSymbols(new Set())
    } else {
      setSelectedSymbols(new Set(data.orders.map((o) => o.symbol)))
    }
  }

  const handleExecute = async () => {
    if (!data || selectedSymbols.size === 0) return
    setExecuting(true)
    setResultMessage(null)

    const toExecute = data.orders
      .filter((o) => selectedSymbols.has(o.symbol))
      .map((o) => ({
        symbol: o.symbol,
        quantity: o.quantity,
        side: o.side,
      }))

    try {
      const res = await api.executeRebalance(toExecute)
      setResultMessage(`Executed ${res.executed_count} orders via Alpaca Paper Broker!`)
      if (onSuccess) onSuccess()
      setTimeout(() => {
        loadRebalance()
      }, 1500)
    } catch (err) {
      setResultMessage(`Execution error: ${String(err)}`)
    } finally {
      setExecuting(false)
    }
  }

  const orders = data?.orders || []
  const selectedOrders = orders.filter((o) => selectedSymbols.has(o.symbol))
  const selectedNotional = selectedOrders.reduce((sum, o) => sum + o.estimated_amount, 0)
  const buyCount = selectedOrders.filter((o) => o.side === 'buy').length
  const sellCount = selectedOrders.filter((o) => o.side === 'sell').length

  return (
    <ModalOverlay label="Portfolio Rebalancing" className="decision-modal" onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent-dark)', display: 'grid', placeItems: 'center' }}>
            <Scale size={20} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Portfolio Rebalance &amp; Trade</h2>
            <small style={{ color: 'var(--muted)' }}>Align weights to model signal conviction &amp; concentration caps</small>
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
      </div>

      {/* Constraints Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', fontWeight: 650, letterSpacing: '0.04em' }}>MAX POSITION CAP</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <input
              type="number"
              min="5"
              max="25"
              value={maxPosition}
              onChange={(e) => setMaxPosition(Number(e.target.value))}
              style={{ width: '60px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>%</span>
          </div>
        </div>

        <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', fontWeight: 650, letterSpacing: '0.04em' }}>MAX SECTOR EXPOSURE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <input
              type="number"
              min="15"
              max="50"
              value={maxSector}
              onChange={(e) => setMaxSector(Number(e.target.value))}
              style={{ width: '60px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>%</span>
          </div>
        </div>

        <div style={{ background: 'var(--subtle)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', fontWeight: 650, letterSpacing: '0.04em' }}>SELECTED NOTIONAL</span>
          <strong style={{ fontSize: '16px', display: 'block', marginTop: '2px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            ${Math.round(selectedNotional).toLocaleString()}
          </strong>
          <small style={{ fontSize: '10px', color: 'var(--muted)' }}>{buyCount} buys · {sellCount} sells</small>
        </div>
      </div>

      {resultMessage && (
        <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: resultMessage.includes('Executed') ? 'var(--accent-soft)' : 'var(--subtle)', border: '1px solid var(--line)', fontSize: '12px', color: 'var(--ink)' }}>
          {resultMessage}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          <RefreshCw size={16} className="spin" /> Calculating optimal rebalancing delta…
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          <CheckCircle2 size={24} color="var(--accent-dark)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
          Portfolio is balanced! Current weights match target allocations within tolerance.
        </div>
      ) : (
        <>
          <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '14px', background: 'var(--panel)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: 'var(--ink)' }}>
              <thead>
                <tr style={{ background: 'var(--subtle)', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px', width: '32px' }}>
                    <input
                      type="checkbox"
                      checked={selectedSymbols.size === orders.length && orders.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th style={{ padding: '8px 10px' }}>Asset</th>
                  <th style={{ padding: '8px 10px' }}>Weight (Cur → Target)</th>
                  <th style={{ padding: '8px 10px' }}>Action</th>
                  <th style={{ padding: '8px 10px' }}>Est. Amount</th>
                  <th style={{ padding: '8px 10px' }}>Model Rationale</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const isBuy = o.side === 'buy'
                  const isChecked = selectedSymbols.has(o.symbol)
                  return (
                    <tr
                      key={o.symbol}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        background: isChecked ? 'var(--panel)' : 'var(--subtle)',
                        opacity: isChecked ? 1 : 0.6,
                        color: 'var(--ink)',
                      }}
                    >
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(o.symbol)}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <strong style={{ color: 'var(--ink)', fontSize: '13px' }}>{o.symbol}</strong>
                        <small style={{ display: 'block', fontSize: '10px', color: 'var(--muted)' }}>{o.sector}</small>
                      </td>
                      <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--muted)' }}>{o.current_weight.toFixed(1)}%</span> → <strong style={{ color: 'var(--ink)' }}>{o.target_weight.toFixed(1)}%</strong>
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: isBuy ? 'var(--accent-dark)' : 'var(--red)',
                          }}
                        >
                          {isBuy ? '+' : ''}{o.delta_weight.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: isBuy ? 'var(--accent-soft)' : 'var(--red-soft)',
                            color: isBuy ? 'var(--accent-dark)' : 'var(--red)',
                          }}
                        >
                          {isBuy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {o.side.toUpperCase()} {o.quantity} shs
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        ${Math.round(o.estimated_amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--muted)' }}>
                        {o.reason}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Selected {selectedSymbols.size} of {orders.length} trade proposals
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="banner-primary"
                onClick={handleExecute}
                disabled={executing || selectedSymbols.size === 0}
                style={{ padding: '8px 18px', fontSize: '12px' }}
              >
                <Zap size={14} className={executing ? 'spin' : ''} />
                {executing ? 'Executing…' : `Execute ${selectedSymbols.size} Trades via Alpaca`}
              </button>
            </div>
          </div>
        </>
      )}
    </ModalOverlay>
  )
}
