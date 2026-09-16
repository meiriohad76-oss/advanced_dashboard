import { describe, expect, it } from 'vitest'
import { trapTarget } from './focusTrap'

describe('trapTarget (focus-trap wrap logic)', () => {
  const items = ['first', 'middle', 'last']

  it('wraps forward: Tab on the last element goes to the first', () => {
    expect(trapTarget(items, 'last', false)).toBe('first')
  })

  it('wraps backward: Shift+Tab on the first element goes to the last', () => {
    expect(trapTarget(items, 'first', true)).toBe('last')
  })

  it('does not interfere in the middle (browser handles it)', () => {
    expect(trapTarget(items, 'middle', false)).toBeNull()
    expect(trapTarget(items, 'middle', true)).toBeNull()
  })

  it('is a no-op with no focusable elements', () => {
    expect(trapTarget([], 'x', false)).toBeNull()
  })

  it('single element wraps to itself in both directions', () => {
    expect(trapTarget(['only'], 'only', false)).toBe('only')
    expect(trapTarget(['only'], 'only', true)).toBe('only')
  })
})
