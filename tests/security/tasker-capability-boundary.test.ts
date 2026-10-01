import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('tasker capability mutation boundary', () => {
  it('does not allow raw skills mutation through generic profile editing', () => {
    const profile = read('app/api/mobile/taskers/profile/route.ts')
    expect(profile).toContain('Service skills must be updated through the validated job-selection endpoint.')
    expect(profile).not.toContain('updateData.skills = JSON.stringify(skills)')
  })

  it('validates service pricing and experience before persistence', () => {
    const skills = read('app/api/mobile/taskers/skills/route.ts')
    expect(skills).toContain('hourlyRate')
    expect(skills).toContain('must be a non-negative number')
    expect(skills).toContain('experienceYears must be an integer from 0 to 80')
    expect(skills).toContain('experienceLevel must be an integer from 1 to 5')
  })

  it('normalizes capability ids consistently and rejects company-only services', () => {
    const skills = read('app/api/mobile/taskers/skills/route.ts')
    expect(skills).toContain('allowedIds.has(s.jobId.trim())')
    expect(skills).toContain('taskerId_jobId: { taskerId: tasker.id, jobId: s.jobId.trim() }')
    expect(skills).toContain("jobs.filter(j => !j.isCompanyOnly)")
  })

  it('uses the tasker market currency for both new and existing skill rows', () => {
    const skills = read('app/api/mobile/taskers/skills/route.ts')
    const matches = skills.match(/currency: getCurrencyForCountry\(user\.countryCode\)/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})
