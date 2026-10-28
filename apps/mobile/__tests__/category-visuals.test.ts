import { describe, expect, it, vi } from 'vitest'

vi.mock('phosphor-react-native', () => ({
  Sparkle: 'Sparkle', Lightning: 'Lightning', Drop: 'Drop', Snowflake: 'Snowflake', Palette: 'Palette',
  Laptop: 'Laptop', Wrench: 'Wrench', PaintBrush: 'PaintBrush', Hammer: 'Hammer', SquaresFour: 'SquaresFour',
  Wall: 'Wall', House: 'House', Bug: 'Bug', Leaf: 'Leaf', Lock: 'Lock', Truck: 'Truck', Car: 'Car',
  Desktop: 'Desktop', Gift: 'Gift', HandHeart: 'HandHeart', HouseSimple: 'HouseSimple', Sun: 'Sun',
  FrameCorners: 'FrameCorners', TShirt: 'TShirt', Television: 'Television',
}))

import { CATEGORY_SLUG_ICON, categoryVisualBySlug } from '../lib/categoryVisuals'

const catalogIconNames = [
  'flash', 'water', 'snowflake', 'color-palette', 'hammer', 'grid', 'construct', 'home',
  'bug', 'sparkles', 'leaf', 'lock-closed', 'car', 'car-sport', 'desktop', 'musical-notes',
  'body', 'business', 'sunny', 'wrench', 'diamond', 'hardware-chip', 'key', 'shirt',
]

describe('V3 category icon names from the service catalogue', () => {
  it('maps every current catalog iconName to an explicit visual', () => {
    for (const iconName of catalogIconNames) {
      expect(CATEGORY_SLUG_ICON[iconName], iconName).toBeDefined()
    }
  })

  it('uses distinct icons for unlike catalog categories instead of the wrench fallback', () => {
    const icons = ['flash', 'water', 'snowflake', 'color-palette', 'sparkles'].map(
      name => categoryVisualBySlug(name).icon,
    )
    expect(new Set(icons).size).toBe(icons.length)
  })

  it('keeps slug mappings and the documented unknown-icon fallback', () => {
    expect(categoryVisualBySlug('electrical-works').icon).toBe(CATEGORY_SLUG_ICON['electrical-works'])
    expect(categoryVisualBySlug('unknown-catalog-icon').icon).toBe(categoryVisualBySlug().icon)
  })
})
