import { describe, expect, it } from 'vitest'
import { aiSearch } from '@/lib/ai-search'

describe('international service search aliases', () => {
  it.each([
    ['மின்சார', 'electrical-works'],
    ['විදුලි', 'electrical-works'],
    ['குழாய்', 'plumbing'],
    ['ජලනල', 'plumbing'],
  ])('routes %s to %s', (query, categoryId) => {
    expect(aiSearch(query).some(result => result.categoryId === categoryId)).toBe(true)
  })
})
