import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Percent,
  Scale,
  Shield,
  ShieldAlert,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { api } from '../api/client'
import { calculateBracketPrices, calculateOrderSizing } from '../domain/orderSizing'
import type { BrokerAlpacaStatus, Holding } from '../types'
import { ModalOverlay } from './ModalOverlay'

interface OrderStagingModalProps {
  symbol: string
  name?: string
  currentPrice: number
  triggerPrice?: number
  portfolioValue?: number
  onClose: () => void
  onOrderExecuted?: (receipt: {
    id: string
    symbol: string
    qty: number
    side: string
    status: string
    simulated: boolean
    message?: string
  }) => void
}

export function OrderStagingModal({
  symbol,
  name,
  currentPrice,
  triggerPrice,
  portfolioValue = 100000,
  onClose,
  onOrderExecuted,
}: OrderStagingModalProps) {
  // Sizing inputs
  const [allocationPct, setAllocationPct] = useState<number>(3.0)
  const [customShares, setCustomShares] = useState<number | null>(null)

  // Execution parameters
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState<number>(triggerPrice ?? currentPrice)
  const [timeInForce, setTimeInForce] = useState<'day' | 'gtc'>('day')

  // Bracket parameters
  const [useBracket, setUseBracket] = useState<boolean>(true)
  const [profitTargetPct, setProfitTargetPct] = useState<number>(15.0)
  const [stopLossPct, setStopLossPct] = useState<number>(6.0)

  // Broker status
  const [alpacaStatus, setAlpacaStatus] = useState<BrokerAlpacaStatus | null>(null)
  const [forceSimulate, setForceSimulate] = useState<boolean>(false)

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{
    id: string
    symbol: string
    qty: number
    side: string
    status: string
    simulated: boolean
    message?: string
  } | null>(null)

  useEffect(() => {
    api.brokerAlpacaStatus().then(setAlpacaStatus).catch(() => {})
  }, [])

  const effectivePrice = orderType === 'limit' ? limitPrice : currentPrice

  // Auto-calculated sizing
  const sizing = useMemo(() => {
    return calculateOrderSizing(portfolioValue, allocationPct, effectivePrice)
  }, [portfolioValue, allocationPct, effectivePrice])

  const sharesToOrder = customShares !== null ? customShares : sizing.shares
  const totalCost = Math.round(sharesToOrder * effectivePrice * 100) / 100
  const actualAlloc = Math.round((totalCost / Math.max(1, portfolioValue)) * 10000) / 100

  // Bracket calculations
  const brackets = useMemo(() => {
    return calculateBracketPrices(effectivePrice, profitTargetPct, stopLossPct, sharesToOrder)
  }, [effectivePrice, profitTargetPct, stopLossPct, sharesToOrder])

  const handleExecute = async () => {
    if (sharesToOrder <= 0) {
      setErrorMsg('Please specify at least 1 share.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        quantity: sharesToOrder,
        side: 'buy' as const,
        type: orderType,
        limit_price: orderType === 'limit' ? limitPrice : undefined,
        time_in_force: timeInForce,
        order_class: useBracket ? 'bracket' : 'simple',
        take_profit_price: useBracket ? brackets.takeProfitPrice : undefined,
        stop_loss_price: useBracket ? brackets.stopLossPrice : undefined,
        simulate: forceSimulate || !alpacaStatus?.configured,
      }

      const res = await api.placeBrokerOrder(payload)
      setReceipt(res)
      if (onOrderExecuted) {
        onOrderExecuted(res)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Order submission failed'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const isBrokerLive = alpacaStatus?.configured && !forceSimulate

  return (
    <ModalOverlay label="Stage Alpaca Bracket Order" className="modal-overlay" onClose={onClose}>
      <div
        className="modal-box"
        style={{
          maxWidth: '560px',
          width: '94%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '14px',
          border: '1px solid var(--line)',
          background: 'var(--panel)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h3 id="order-staging-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Stage Alpaca Bracket Order
              </h3>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                {symbol} {name ? `· ${name}` : ''} @ ${currentPrice.toFixed(2)}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
            style={{ width: '30px', height: '30px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {receipt ? (
            /* Execution Receipt View */
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Order Staged &amp; Accepted!
              </h4>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px', maxWidth: '400px' }}>
                {receipt.message || `Order #${receipt.id.slice(0, 8)} for ${receipt.qty} shares of ${receipt.symbol} processed.`}
              </p>

              <div
                style={{
                  width: '100%',
                  background: 'var(--subtle)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginTop: '10px',
                  border: '1px solid var(--line)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  textAlign: 'left',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>Status:</span>{' '}
                  <strong style={{ color: '#10b981', textTransform: 'uppercase' }}>{receipt.status}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Execution Engine:</span>{' '}
                  <strong>{receipt.simulated ? '⚡ Simulation' : '🟢 Alpaca Paper'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Quantity:</span>{' '}
                  <strong>{receipt.qty} Shares</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Order Class:</span>{' '}
                  <strong>{useBracket ? 'Bracket (TP/SL)' : 'Simple'}</strong>
                </div>
                {useBracket && (
                  <>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Profit Target:</span>{' '}
                      <strong style={{ color: '#10b981' }}>${brackets.takeProfitPrice.toFixed(2)} (+{profitTargetPct}%)</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Stop Loss:</span>{' '}
                      <strong style={{ color: '#ef4444' }}>${brackets.stopLossPrice.toFixed(2)} (-{stopLossPct}%)</strong>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                className="banner-primary"
                onClick={onClose}
                style={{ marginTop: '14px', width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                Done &amp; Return to Dashboard
              </button>
            </div>
          ) : (
            /* Order Setup View */
            <>
              {/* Account Status Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: isBrokerLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                  border: `1px solid ${isBrokerLive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={15} color={isBrokerLive ? '#10b981' : '#d97706'} />
                  <span>
                    <strong>{isBrokerLive ? 'Alpaca Paper Broker Connected' : 'Simulation Mode Active'}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>
                      ({isBrokerLive ? 'Live API sandbox' : 'Offline testing fallback'})
                    </span>
                  </span>
                </div>
                {alpacaStatus?.configured && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px' }}>
                    <input
                      type="checkbox"
                      checked={forceSimulate}
                      onChange={(e) => setForceSimulate(e.target.checked)}
                    />
                    Simulate
                  </label>
                )}
              </div>

              {/* Sizing & Portfolio Allocation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="alloc-pct-slider" style={{ fontSize: '12px', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scale size={14} color="var(--accent-dark)" />
                    Portfolio Allocation Rule
                  </label>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-dark)' }}>
                    {allocationPct.toFixed(1)}% (${sizing.targetDollarAmount.toLocaleString()} target)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    id="alloc-pct-slider"
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={allocationPct}
                    onChange={(e) => {
                      setAllocationPct(parseFloat(e.target.value))
                      setCustomShares(null)
                    }}
                    style={{ flex: 1, accentColor: 'var(--accent-dark)' }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[2, 3, 5, 8].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setAllocationPct(pct)
                          setCustomShares(null)
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '6px',
                          border: '1px solid var(--line)',
                          background: allocationPct === pct ? 'var(--accent-dark)' : 'var(--subtle)',
                          color: allocationPct === pct ? '#fff' : 'var(--ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sizing result breakdown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    background: 'var(--subtle)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Shares Sized
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                      <input
                        type="number"
                        min="1"
                        value={sharesToOrder}
                        onChange={(e) => setCustomShares(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: '70px',
                          textAlign: 'center',
                          padding: '3px',
                          fontSize: '14px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid var(--line)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Est. Total Outlay
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '6px' }}>
                      ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Effective Weight
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-dark)', marginTop: '6px' }}>
                      {actualAlloc.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Type & Execution Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="order-type-select" style={{ fontSize: '12px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>
                    Order Type
                  </label>
                  <select
                    id="order-type-select"
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as 'market' | 'limit')}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
                  >
                    <option value="market">Market Order</option>
                    <option value="limit">Limit Order</option>
                  </select>
                </div>

                {orderType === 'limit' ? (
                  <div>
                    <label htmlFor="limit-price-input" style={{ fontSize: '12px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>
                      Limit Price ($)
                    </label>
                    <input
                      id="limit-price-input"
                      type="number"
                      step="0.01"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(parseFloat(e.target.value) || effectivePrice)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="tif-select" style={{ fontSize: '12px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>
                      Time in Force
                    </label>
                    <select
                      id="tif-select"
                      value={timeInForce}
                      onChange={(e) => setTimeInForce(e.target.value as 'day' | 'gtc')}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
                    >
                      <option value="day">Day Only (Market Hours)</option>
                      <option value="gtc">Good 'Til Cancelled (GTC)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Automated Bracket Rules */}
              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '14px',
                  background: 'var(--surface-hover)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={useBracket}
                      onChange={(e) => setUseBracket(e.target.checked)}
                      style={{ accentColor: 'var(--accent-dark)' }}
                    />
                    Automated Bracket Defense (Take Profit + Stop Loss)
                  </label>
                  {useBracket && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-dark)',
                        fontWeight: 700,
                      }}
                    >
                      {brackets.riskRewardRatio}:1 R:R
                    </span>
                  )}
                </div>

                {useBracket && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                    {/* Profit Target */}
                    <div
                      style={{
                        background: 'var(--panel)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 650 }}>
                          <Target size={12} /> Profit Target
                        </span>
                        <span>+{profitTargetPct}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <strong style={{ fontSize: '15px', color: '#10b981' }}>
                          ${brackets.takeProfitPrice.toFixed(2)}
                        </strong>
                        <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                          (+${brackets.potentialGainTotal.toFixed(0)})
                        </small>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="35"
                        step="1"
                        value={profitTargetPct}
                        onChange={(e) => setProfitTargetPct(parseFloat(e.target.value))}
                        style={{ width: '100%', marginTop: '8px', accentColor: '#10b981' }}
                      />
                    </div>

                    {/* Stop Loss */}
                    <div
                      style={{
                        background: 'var(--panel)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 650 }}>
                          <ShieldAlert size={12} /> Stop Loss
                        </span>
                        <span>-{stopLossPct}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <strong style={{ fontSize: '15px', color: '#ef4444' }}>
                          ${brackets.stopLossPrice.toFixed(2)}
                        </strong>
                        <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                          (-${brackets.potentialLossTotal.toFixed(0)})
                        </small>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        step="0.5"
                        value={stopLossPct}
                        onChange={(e) => setStopLossPct(parseFloat(e.target.value))}
                        style={{ width: '100%', marginTop: '8px', accentColor: '#ef4444' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="banner-primary"
                  onClick={handleExecute}
                  disabled={submitting}
                  style={{
                    padding: '9px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                  }}
                >
                  <Zap size={14} className={submitting ? 'spin' : ''} />
                  {submitting ? 'Submitting Order…' : `⚡ Stage & Execute ${sharesToOrder} Shares`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}
