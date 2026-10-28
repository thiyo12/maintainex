import { describe, expect, it } from 'vitest'
import {
  matchesLegacyTaskerJob,
  matchesLegacyCompanyJob,
} from '@/lib/matching/eligibility'

const category = 'plumbing'
const selected = 'pipe-repair'
const sibling = 'drain-clean'
const skill = (jobId: string) => ({ jobId, job: { categoryId: category } })

describe('Phase 04 — one selected job cannot authorize a sibling service', () => {
  it('keeps the exact service selected by an individual provider eligible', () => {
    expect(matchesLegacyTaskerJob([skill(selected)], {
      categoryId: category, templateJobId: selected,
    })).toBe(true)
  })

  it('does not authorize a sibling just because the category matches', () => {
    expect(matchesLegacyTaskerJob([skill(selected)], {
      categoryId: category, templateJobId: sibling,
    })).toBe(false)
  })

  it('rejects empty selections even for the correct category', () => {
    expect(matchesLegacyTaskerJob([], { categoryId: category, templateJobId: selected })).toBe(false)
  })

  it('preserves legacy category matching when the old booking has no TemplateJob', () => {
    expect(matchesLegacyTaskerJob([skill(selected)], { categoryId: category })).toBe(true)
    expect(matchesLegacyTaskerJob([skill(selected)], { categoryId: 'electrical' })).toBe(false)
  })

  it('allows the exact job a company selected', () => {
    const specialties = [{ categoryId: category, jobId: selected }]
    expect(matchesLegacyCompanyJob(specialties, {
      categoryId: category, templateJobId: selected,
    })).toBe(true)
  })

  it('does not broaden a job-specific company specialty to an entire category', () => {
    const specialties = [{ categoryId: category, jobId: selected }]
    expect(matchesLegacyCompanyJob(specialties, {
      categoryId: category, templateJobId: sibling,
    })).toBe(false)
  })

  it('preserves explicitly category-wide company specialties', () => {
    const specialties = [{ categoryId: category, jobId: null }]
    expect(matchesLegacyCompanyJob(specialties, {
      categoryId: category, templateJobId: sibling,
    })).toBe(true)
  })

  it('does not treat unrelated category grants as permission', () => {
    expect(matchesLegacyCompanyJob([{
      categoryId: 'electrical', jobId: null,
    }], { categoryId: category, templateJobId: selected })).toBe(false)
  })

  it('does not allow blank company selections', () => {
    expect(matchesLegacyCompanyJob([], { categoryId: category, templateJobId: selected })).toBe(false)
  })

  it('retains historical company category matching on bookings without a TemplateJob', () => {
    expect(matchesLegacyCompanyJob([{
      categoryId: category, jobId: selected,
    }], { categoryId: category })).toBe(true)
  })
})
