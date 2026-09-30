import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('marketplace diagnostic route authentication', () => {
  for (const route of [
    'app/api/mobile/v2/quality/route.ts',
    'app/api/mobile/v2/trust/route.ts',
  ]) {
    it(`${route} requires an authenticated user before accepting target ids`, () => {
      const source = readFileSync(resolve(process.cwd(), route), 'utf8')
      const authIndex = source.indexOf('authenticateRequest(request)')
      const unauthorizedIndex = source.indexOf("error: 'Unauthorized'")
      const paramsIndex = source.indexOf('searchParams')
      expect(authIndex).toBeGreaterThan(0)
      expect(unauthorizedIndex).toBeGreaterThan(authIndex)
      expect(paramsIndex).toBeGreaterThan(unauthorizedIndex)
    })
  }
})
