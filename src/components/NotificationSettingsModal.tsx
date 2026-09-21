import { useEffect, useState } from 'react'
import { Bell, Send, CheckCircle2, X, ShieldAlert, Radio, Sun } from 'lucide-react'
import { api } from '../api/client'
import { ModalOverlay } from './ModalOverlay'
import type { NotificationSettings } from '../types'

interface NotificationSettingsModalProps {
  onClose: () => void
}

export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>({
    telegram_token: '',
    telegram_chat_id: '',
    telegram_enabled: false,
    webhook_url: '',
    webhook_enabled: false,
    min_severity: 'warning',
    premarket_briefing_enabled: false,
    premarket_briefing_time: '08:30 ET',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testingBriefing, setTestingBriefing] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [briefingPreview, setBriefingPreview] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api.notificationSettings()
      .then((s) => {
        if (alive) {
          setSettings(s)
          setLoading(false)
        }
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setStatusMessage(null)
    try {
      const updated = await api.saveNotificationSettings(settings)
      setSettings(updated)
      setStatusMessage('Settings saved successfully.')
      setTimeout(() => setStatusMessage(null), 3500)
    } catch {
      setStatusMessage('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.testNotifications()
      let msg = `Test run: ${res.status}`
      if (res.results.telegram) {
        msg += ` | Telegram: ${res.results.telegram.success ? 'OK' : res.results.telegram.error || 'Failed'}`
      }
      if (res.results.webhook) {
        msg += ` | Webhook: ${res.results.webhook.success ? 'OK' : res.results.webhook.error || 'Failed'}`
      }
      setTestResult(msg)
    } catch {
      setTestResult('Test request failed.')
    } finally {
      setTesting(false)
    }
  }

  const handleTestBriefing = async () => {
    setTestingBriefing(true)
    setBriefingPreview(null)
    try {
      const res = await api.sendTestBriefing()
      if (res.success) {
        setStatusMessage('Pre-market briefing dispatched to Telegram successfully!')
      } else {
        setStatusMessage(res.error ? `Briefing notice: ${res.error}` : 'Briefing preview generated.')
      }
      if (res.briefing) {
        setBriefingPreview(res.briefing)
      }
    } catch {
      setStatusMessage('Failed to trigger test briefing.')
    } finally {
      setTestingBriefing(false)
    }
  }

  return (
    <ModalOverlay label="Notification Settings" className="decision-modal" onClose={onClose}>
      <div className="modal-panel" style={{ maxWidth: '620px', width: '92vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--accent-dark)" />
            <h2 style={{ margin: 0, fontSize: '18px' }}>Notification Channels</h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>Loading notification settings…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {statusMessage && (
              <div style={{ padding: '8px 12px', background: '#ecfdf5', color: '#047857', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} />
                {statusMessage}
              </div>
            )}

            {testResult && (
              <div style={{ padding: '8px 12px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '6px', fontSize: '12px' }}>
                {testResult}
              </div>
            )}

            {/* Telegram Settings */}
            <section style={{ background: 'var(--subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={15} color="#0284c7" />
                  <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Telegram Bot Notifications</strong>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--ink)' }}>
                  <input
                    type="checkbox"
                    checked={settings.telegram_enabled}
                    onChange={(e) => setSettings({ ...settings, telegram_enabled: e.target.checked })}
                  />
                  <span>Enable Telegram</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="tg-bot-token" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Bot Token
                  </label>
                  <input
                    id="tg-bot-token"
                    type="password"
                    placeholder="123456789:ABCdefGHI..."
                    value={settings.telegram_token}
                    onChange={(e) => setSettings({ ...settings, telegram_token: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label htmlFor="tg-chat-id" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Chat ID or Channel
                  </label>
                  <input
                    id="tg-chat-id"
                    type="text"
                    placeholder="@my_channel or -100123..."
                    value={settings.telegram_chat_id}
                    onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
                  />
                </div>
              </div>
              <small style={{ display: 'block', marginTop: '6px', fontSize: '10px', color: 'var(--muted)' }}>
                Create a bot via @BotFather in Telegram, start a chat with it, and paste token and chat ID here.
              </small>
            </section>

            {/* Webhook Settings */}
            <section style={{ background: 'var(--subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio size={15} color="var(--accent-dark)" />
                  <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Generic Webhook (Slack / Discord / Custom)</strong>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--ink)' }}>
                  <input
                    type="checkbox"
                    checked={settings.webhook_enabled}
                    onChange={(e) => setSettings({ ...settings, webhook_enabled: e.target.checked })}
                  />
                  <span>Enable Webhook</span>
                </label>
              </div>

              <div>
                <label htmlFor="webhook-url-input" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Webhook URL
                </label>
                <input
                  id="webhook-url-input"
                  type="text"
                  placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                  value={settings.webhook_url}
                  onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
                />
              </div>
            </section>

            {/* Scheduled Daily Pre-Market Briefing */}
            <section style={{ background: 'var(--subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sun size={16} color="#f59e0b" />
                  <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Scheduled Pre-Market Briefing</strong>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--ink)' }}>
                  <input
                    type="checkbox"
                    checked={settings.premarket_briefing_enabled || false}
                    onChange={(e) => setSettings({ ...settings, premarket_briefing_enabled: e.target.checked })}
                  />
                  <span>Enable Daily Briefing</span>
                </label>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px 0' }}>
                Dispatches an institutional morning digest to Telegram at ~08:30 ET before US open, covering portfolio health, nearing triggers (&lt;3.5%), and rating upgrades.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--accent-dark)', fontWeight: 600 }}>
                  ⏰ Schedule: Weekdays at 08:30 ET
                </span>
                <button
                  type="button"
                  disabled={testingBriefing}
                  onClick={handleTestBriefing}
                  className="ask-button"
                  style={{ fontSize: '11px', padding: '5px 10px' }}
                >
                  <Send size={12} /> {testingBriefing ? 'Dispatching…' : 'Send Test Briefing'}
                </button>
              </div>
              {briefingPreview && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  background: 'var(--panel)',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  color: 'var(--ink)',
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  {briefingPreview}
                </div>
              )}
            </section>

            {/* Severity filter */}
            <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--subtle)', border: '1px solid var(--line)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} color="var(--accent-dark)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>Minimum Severity to Dispatch</span>
              </div>
              <select
                value={settings.min_severity}
                onChange={(e) => setSettings({ ...settings, min_severity: e.target.value })}
                style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
              >
                <option value="critical">Critical Only</option>
                <option value="warning">Warning &amp; Critical</option>
                <option value="info">All Alerts (Info, Warning, Critical)</option>
              </select>
            </section>

          {testResult && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#166534' }}>
              {testResult}
            </div>
          )}

          {statusMessage && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#1e40af' }}>
              {statusMessage}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleTest}
              disabled={testing || saving}
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              <Send size={14} className={testing ? 'spin' : ''} />
              {testing ? 'Testing…' : 'Send Test Notification'}
            </button>
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
                onClick={handleSave}
                disabled={saving || testing}
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                <CheckCircle2 size={14} />
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </ModalOverlay>
  )
}
