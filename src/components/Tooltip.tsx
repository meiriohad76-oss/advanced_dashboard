import type { ReactNode } from 'react'
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

export interface TooltipProps {
  content: string
  children?: ReactNode
  icon?: boolean
}

export function Tooltip({ content, children, icon = true }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span 
      className="tooltip-wrapper" 
      role="button"
      tabIndex={0}
      aria-label={typeof children === 'string' ? `${children} help` : 'Help info'}
      onMouseEnter={() => setVisible(true)} 
      onMouseLeave={() => setVisible(false)}
      onClick={(e) => { e.stopPropagation(); setVisible(!visible) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          setVisible((v) => !v)
        } else if (e.key === 'Escape' && visible) {
          e.stopPropagation()
          setVisible(false)
        }
      }}
    >
      {children}
      {icon && <HelpCircle size={13} className="tooltip-icon" aria-hidden="true" />}
      {visible && (
        <span className="tooltip-box" role="tooltip">
          {content}
        </span>
      )}
    </span>
  )
}

