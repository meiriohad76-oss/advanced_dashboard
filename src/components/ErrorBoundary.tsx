import React, { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Atlas Application Uncaught Render Error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleResetState = () => {
    try {
      localStorage.removeItem('atlas_user_alerts')
      localStorage.removeItem('atlas_rec_statuses')
    } catch { /* ignore */ }
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg, #0b1320)',
          color: 'var(--ink, #f3f4f6)',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--panel, #111c2e)',
            border: '1px solid var(--line, #1f293d)',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: 'var(--ink, #f3f4f6)' }}>
              Something went wrong
            </h2>

            <p style={{ fontSize: '13px', color: 'var(--muted, #94a3b8)', margin: '0 0 16px', lineHeight: 1.5 }}>
              An unexpected render error occurred in the dashboard interface.
            </p>

            {this.state.error && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px',
                maxHeight: '120px',
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: 'var(--accent, #10b981)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} /> Reload Dashboard
              </button>

              <button
                onClick={this.handleResetState}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--muted, #94a3b8)',
                  border: '1px solid var(--line, #1f293d)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} /> Reset Cached State
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
