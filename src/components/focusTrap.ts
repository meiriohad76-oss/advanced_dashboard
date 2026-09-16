// Pure, unit-tested focus-trap helper (kept out of the component file so the
// component module exports only a component — react-refresh friendly).
// Given the dialog's ordered focusable elements, the currently focused one, and
// whether Shift is held, return the element Tab should wrap to when focus would
// otherwise leave the dialog — or null to let the browser handle it normally.
export function trapTarget<T>(focusables: T[], active: T, shift: boolean): T | null {
  if (focusables.length === 0) return null
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (shift && active === first) return last
  if (!shift && active === last) return first
  return null
}
