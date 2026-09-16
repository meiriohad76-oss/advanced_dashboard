import type { TimeframeKey } from '../domain/timeframe'

export type { TimeframeKey }

export interface TimeframeSelectorProps {
  selected: TimeframeKey
  onChange: (timeframe: TimeframeKey) => void
}

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: '1W', label: '1 Week' },
  { key: '1M', label: '1 Month' },
  { key: '3M', label: '3 Months' },
  { key: '6M', label: '6 Months' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1 Year' },
]

export function TimeframeSelector({ selected, onChange }: TimeframeSelectorProps) {
  return (
    <div className="timeframe-selector" role="group" aria-label="Performance Timeframe Selector">
      {TIMEFRAMES.map(({ key, label }) => (
        <button
          key={key}
          className={`tf-button ${selected === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
          title={`Show performance for ${label}`}
        >
          {key}
        </button>
      ))}
    </div>
  )
}

