import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const matchingSource = readFileSync(resolve(process.cwd(), 'lib/matching/eligibility.ts'), 'utf8')
const deploymentSource = readFileSync(resolve(process.cwd(), 'tests/structural/deployment-safety.test.ts'), 'utf8')

describe('Phase 03 — named service area remains authoritative without GPS', () => {
  it('only preserves fallback for truly unlocated legacy jobs', () => {
    expect(matchingSource).toContain('if (!hasValidatedAddress && !areaId) return true')
    expect(matchingSource).not.toContain('if (!hasValidatedAddress) return true')
  })

  it('still compares exact area id and area names for area-bound jobs', () => {
    expect(matchingSource).toContain('const normalizedAreaId = areaId.toLowerCase()')
    expect(matchingSource).toContain('fullLocation.includes(area)')
  })

  it('makes both individual and company matching use the same area check', () => {
    expect(matchingSource).toContain('configuredAreaMatches(profile?.serviceAreas, target?.areaId ?? null')
    expect(matchingSource).toContain('configuredAreaMatches(company.serviceAreas, target?.areaId ?? null')
  })

  it('checks actual container startup migration safety rather than stale Dockerfile content', () => {
    expect(deploymentSource).toContain("container startup runs migrate deploy with the dedicated migration role")
    expect(deploymentSource).toContain('scripts/start-production.sh')
    expect(deploymentSource).not.toContain("expect(content).toContain('prisma migrate deploy')")
  })
})
