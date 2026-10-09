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
  it('rejects oversized safety report fields and avoids claiming escrow is always held', () => {
    expect(route).toContain("!body.reason.trim()")
    expect(route).toContain("body.reason.trim().length > 120")
    expect(route).toContain("body.description.length > 5000")
    expect(route).toContain("error: 'Invalid dispute reason'")
    expect(route).toContain("error: 'Invalid dispute description'")
    expect(route).toContain('Confirm escrow state separately.')
    expect(route).not.toContain('and escrow is now on hold.')
  })
  it('does not falsely promise escrow is held in the mobile success receipt', () => {
    expect(screen).not.toContain("t('dispute.escrowHeld')")
    expect(screen).toContain('Payment status and next steps will be reviewed')
  })
  it('routes urgent incidents to the existing critical-priority staff queue', () => {
    expect(route).toContain("category: isSafetyReport ? 'tasker_escalation' : 'dispute'")
    expect(route).toContain("severity: isSafetyReport ? 'critical' : 'high'")
    expect(route).toContain("priority: isSafetyReport ? 'critical' : 'high'")
  })
})
