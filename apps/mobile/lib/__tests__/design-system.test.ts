import { describe, expect, it } from 'vitest'
import {
  spacing,
  borderRadius,
  fontSizes,
  lineHeights,
  hitSlop,
  opacity,
} from '../tokens'
import { lightColors, darkColors } from '../colors'

function luminance(hex: string): number {
  const c = hex.replace('#', '').slice(0, 6)
  const rgb = [0, 2, 4].map(i => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

describe('V2 design tokens', () => {
  it('keeps spacing ascending', () => {
    const values = Object.values(spacing)
    const sorted = [...values].sort((a, b) => a - b)
    expect(values).toEqual(sorted)
  })

  it('defines the canonical radius scale', () => {
    expect(borderRadius.button).toBe(14)
    expect(borderRadius.card).toBe(18)
    expect(borderRadius.full).toBeGreaterThan(1000)
  })

  it('pairs every font size with a line height', () => {
    for (const key of ['display', 'h1', 'h2', 'h3', 'body', 'bodySmall', 'caption'] as const) {
      expect(lineHeights[key]).toBeGreaterThanOrEqual(fontSizes[key])
    }
  })

  it('keeps touch slop at usable size', () => {
    expect(hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(12)
    expect(hitSlop.left + hitSlop.right).toBeGreaterThanOrEqual(12)
  })

  it('keeps disabled state visibly distinct from hidden', () => {
    expect(opacity.disabled).toBeGreaterThanOrEqual(0.4)
    expect(opacity.disabled).toBeLessThan(1)
  })
})

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('V2 palette contrast (%s)', (_name, palette) => {
  it('keeps primary text readable on background (WCAG AA)', () => {
    expect(contrastRatio(palette.textPrimary, palette.background)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps secondary text readable on background', () => {
    expect(contrastRatio(palette.textSecondary, palette.background)).toBeGreaterThanOrEqual(3)
  })

  it('keeps primary text readable on surface cards', () => {
    expect(contrastRatio(palette.textPrimary, palette.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps amber button text readable on amber', () => {
    expect(contrastRatio('#111111', palette.amber)).toBeGreaterThanOrEqual(4.5)
  })

  it('defines the canonical surface tokens', () => {
    for (const key of ['background', 'surface', 'surfaceHigh', 'elevated', 'border', 'overlay'] as const) {
      expect(typeof palette[key]).toBe('string')
    }
  })
})
