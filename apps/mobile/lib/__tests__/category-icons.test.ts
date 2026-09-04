import { describe, expect, it } from 'vitest'
import { getCategoryIcon } from '../category-icons'

describe('getCategoryIcon', () => {
  it('maps flash to flash-outline', () => {
    expect(getCategoryIcon('flash')).toBe('flash-outline')
  })

  it('maps water to water-outline', () => {
    expect(getCategoryIcon('water')).toBe('water-outline')
  })

  it('maps snowflake to snowflake-outline', () => {
    expect(getCategoryIcon('snowflake')).toBe('snowflake-outline')
  })

  it('maps color-palette to color-palette-outline', () => {
    expect(getCategoryIcon('color-palette')).toBe('color-palette-outline')
  })

  it('maps hammer to hammer-outline', () => {
    expect(getCategoryIcon('hammer')).toBe('hammer-outline')
  })

  it('maps grid to grid-outline', () => {
    expect(getCategoryIcon('grid')).toBe('grid-outline')
  })

  it('maps construct to construct-outline', () => {
    expect(getCategoryIcon('construct')).toBe('construct-outline')
  })

  it('maps home to home-outline', () => {
    expect(getCategoryIcon('home')).toBe('home-outline')
  })

  it('maps bug to bug-outline', () => {
    expect(getCategoryIcon('bug')).toBe('bug-outline')
  })

  it('maps sparkles to sparkles-outline', () => {
    expect(getCategoryIcon('sparkles')).toBe('sparkles-outline')
  })

  it('maps leaf to leaf-outline', () => {
    expect(getCategoryIcon('leaf')).toBe('leaf-outline')
  })

  it('maps lock-closed to lock-closed-outline', () => {
    expect(getCategoryIcon('lock-closed')).toBe('lock-closed-outline')
  })

  it('maps car to car-outline', () => {
    expect(getCategoryIcon('car')).toBe('car-outline')
  })

  it('maps car-sport to car-sport-outline', () => {
    expect(getCategoryIcon('car-sport')).toBe('car-sport-outline')
  })

  it('maps desktop to desktop-outline', () => {
    expect(getCategoryIcon('desktop')).toBe('desktop-outline')
  })

  it('maps musical-notes to musical-notes-outline', () => {
    expect(getCategoryIcon('musical-notes')).toBe('musical-notes-outline')
  })

  it('maps body to body-outline', () => {
    expect(getCategoryIcon('body')).toBe('body-outline')
  })

  it('maps business to business-outline', () => {
    expect(getCategoryIcon('business')).toBe('business-outline')
  })

  it('maps sunny to sunny-outline', () => {
    expect(getCategoryIcon('sunny')).toBe('sunny-outline')
  })

  it('maps wrench to wrench-outline', () => {
    expect(getCategoryIcon('wrench')).toBe('wrench-outline')
  })

  it('maps diamond to diamond-outline', () => {
    expect(getCategoryIcon('diamond')).toBe('diamond-outline')
  })

  it('maps hardware-chip to hardware-chip-outline', () => {
    expect(getCategoryIcon('hardware-chip')).toBe('hardware-chip-outline')
  })

  it('maps key to key-outline', () => {
    expect(getCategoryIcon('key')).toBe('key-outline')
  })

  it('maps shirt to shirt-outline', () => {
    expect(getCategoryIcon('shirt')).toBe('shirt-outline')
  })

  it('falls back to construct-outline for unknown icon', () => {
    expect(getCategoryIcon('unknown-icon-name')).toBe('construct-outline')
  })

  it('falls back to construct-outline for empty string', () => {
    expect(getCategoryIcon('')).toBe('construct-outline')
  })
})
