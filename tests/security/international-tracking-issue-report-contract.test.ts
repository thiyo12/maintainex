import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Post-acceptance issue reporting entry point', () => {
  for (const platform of ['native', 'web']) {
    it(`exposes existing job reporting from ${platform} tracking`, () => {
      const src = readFileSync(
        resolve(process.cwd(), `apps/mobile/components/tracking/LiveTrackingScreen.${platform}.tsx`),
        'utf8',
      )
      expect(src).toContain('Report a job concern')
      expect(src).toContain('/(customer)/jobs/dispute/')
      expect(src).toContain('${id}')
    })
  }
})
