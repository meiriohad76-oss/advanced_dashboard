import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { trapTarget } from './focusTrap'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Accessible modal wrapper (BL-003): focuses the first control on open, traps Tab
// within the dialog, closes on Escape or an outside click, and returns focus to the
// element that opened it on close. Renders role="dialog" aria-modal semantics.
export function ModalOverlay({ label, className, onClose, children }: {
  label: string
  className: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
    ;(focusables[0] ?? dialog).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      const target = trapTarget(items, document.activeElement as HTMLElement, event.shiftKey)
      if (target) {
        event.preventDefault()
        target.focus()
      }
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!dialog.contains(event.target as Node)) onCloseRef.current()
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onPointerDown, true)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div className="drawer-backdrop">
      <div ref={dialogRef} className={className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  )
}
