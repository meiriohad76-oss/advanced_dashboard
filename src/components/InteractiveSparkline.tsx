import React, { useRef, useState } from 'react'

interface InteractiveSparklineProps {
  values: number[]
  labels?: string[]
  color?: 'green' | 'slate' | 'amber'
  fill?: boolean
  height?: number
  formatValue?: (val: number) => string
}

export function InteractiveSparkline({
  values,
  labels = [],
  color = 'green',
  fill = false,
  height = 180,
  formatValue = (v) => `$${v.toFixed(2)}`,
}: InteractiveSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  if (!values || values.length === 0) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '11px' }}>No series data</div>
  }

  const width = 640
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const range = max - min || 1

  const points = values
    .map((val, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  const area = `0,${height} ${points} ${width},${height}`

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const relativeX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const ratio = relativeX / rect.width
    const index = Math.round(ratio * (values.length - 1))
    const clampedIndex = Math.max(0, Math.min(values.length - 1, index))

    setHoverIndex(clampedIndex)
    setMousePos({ x: relativeX, y: e.clientY - rect.top })
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
    setMousePos(null)
  }

  const activeX = hoverIndex !== null ? (hoverIndex / Math.max(1, values.length - 1)) * width : null
  const activeY = hoverIndex !== null ? height - ((values[hoverIndex] - min) / range) * height : null

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', width: '100%', height, cursor: 'crosshair' }}
    >
      <svg
        className="sparkline"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Interactive performance sparkline chart"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={`interactive-fade-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color === 'green' ? '#10b981' : color === 'amber' ? '#f59e0b' : '#64748b'} stopOpacity=".25" />
            <stop offset="1" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="0" x2={width} y1={line * (height / 3)} y2={line * (height / 3)} className="chart-grid" />
        ))}

        {fill && <polygon points={area} fill={`url(#interactive-fade-${color})`} />}
        <polyline points={points} className={`chart-line ${color}`} strokeWidth="2.5" />

        {/* Hover scrubber vertical line and dot */}
        {activeX !== null && activeY !== null && (
          <g>
            <line
              x1={activeX}
              x2={activeX}
              y1={0}
              y2={height}
              stroke="var(--ink)"
              strokeDasharray="3 3"
              strokeWidth="1.5"
              opacity="0.6"
            />
            <circle
              cx={activeX}
              cy={activeY}
              r="5"
              fill={color === 'green' ? '#10b981' : color === 'amber' ? '#f59e0b' : '#64748b'}
              stroke="var(--panel)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Floating tooltip */}
      {hoverIndex !== null && mousePos !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(mousePos.x, 60), (containerRef.current?.clientWidth || 300) - 60),
            top: Math.max(10, mousePos.y - 45),
            transform: 'translateX(-50%)',
            background: 'var(--nav)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
          }}
        >
          <span>{formatValue(values[hoverIndex])}</span>
          {labels[hoverIndex] && (
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#94a3b8' }}>
              {labels[hoverIndex]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
