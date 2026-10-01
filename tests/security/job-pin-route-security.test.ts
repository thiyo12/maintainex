import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const mutationRoutes = [
  'app/api/mobile/v2/jobs/[id]/pin/route.ts',
  'app/api/mobile/v2/jobs/[id]/pin/rotate/route.ts',
  'app/api/mobile/v2/jobs/[id]/pin/revoke/route.ts',
  'app/api/mobile/v2/jobs/[id]/pin/verify/route.ts',
]

describe('job PIN route account restrictions', () => {
  for (const route of mutationRoutes) {
    it(`${route} blocks suspended and banned accounts before mutation`, () => {
      const source = readFileSync(resolve(process.cwd(), route), 'utf-8')
      expect(source).toContain('assertNotSuspended')
      const authIndex = source.indexOf('authenticateRequest(request)')
      const blockedIndex = source.indexOf('assertNotSuspended(auth)')
      expect(authIndex).toBeGreaterThan(0)
      expect(blockedIndex).toBeGreaterThan(authIndex)
    })
  }

  it('localizes standalone escrow-release notifications to the job market', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/release-escrow/route.ts'),
      'utf-8'
    )
    expect(source).toContain('getCurrencyForCountry(job.countryCode)')
    expect(source).toContain('job.countryCode,')
  })
})
