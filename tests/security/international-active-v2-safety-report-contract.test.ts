import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const route = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/complete/route.ts'), 'utf8')
const screen = readFileSync(resolve(process.cwd(), 'apps/mobile/features/jobs/screens/customer/dispute/[id].tsx'), 'utf8')

describe('Active V2 mobile safety report to CRM escalation', () => {
  const reasons = [
    'SAFETY_IMMEDIATE_DANGER',
    'SAFETY_THREAT_OR_HARASSMENT',
    'SAFETY_INJURY',
    'SAFETY_UNSAFE_WORK',
    'SAFETY_IDENTITY_MISMATCH',
  ]
  for (const reason of reasons) {
    it(`offers and escalates ${reason}`, () => {
      expect(screen).toContain(reason)
      expect(route).toContain(reason)
    })
  }
  it('preserves authenticated job-participant verification and lifecycle dispute hold', () => {
    expect(route.indexOf("if (!isCustomer && !providerActor)")).toBeLessThan(route.indexOf('const safetyReasons = new Set'))
    expect(route).toContain('await raiseJobDispute(')
  })
  it('routes urgent incidents to the existing critical-priority staff queue', () => {
    expect(route).toContain("category: isSafetyReport ? 'tasker_escalation' : 'dispute'")
    expect(route).toContain("severity: isSafetyReport ? 'critical' : 'high'")
    expect(route).toContain("priority: isSafetyReport ? 'critical' : 'high'")
  })
})
