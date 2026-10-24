import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  deriveCrewPinDigest, generateCrewPinCode, matchesCrewPinDigest,
  type CrewPinScope,
} from '@/lib/domain/company-crew-pin-epoch'

const key = Buffer.alloc(32, 0x5e) // Test-only, never a live PIN pepper.
const scope: CrewPinScope = {
  crewDispatchId: 'crew-1', jobId: 'job-1', crewVersion: 3,
  assignmentId: 'slot-1', workerUserId: 'member-1', purpose: 'ARRIVAL',
}
const sign = (pin = '045321', s = scope, pepper = key) => deriveCrewPinDigest(pin, s, pepper)

describe('Phase04 — per-person epoch and purpose bound PIN primitive, no work authorization', () => {
  it('generates six-digit cryptographically random format without Math.random', () => {
    for (let n = 0; n < 30; n++) expect(generateCrewPinCode()).toMatch(/^[1-9][0-9]{5}$/)
    const source = readFileSync(resolve(process.cwd(), 'lib/domain/company-crew-pin-epoch.ts'), 'utf8')
    expect(source).toContain("randomInt(100000, 1000000)")
    expect(source).not.toContain('Math.random')
  })

  it('accepts the exact worker/crew/version/job/purpose, not only the PIN digits', () => {
    const digest = sign()
    expect(digest).toMatch(/^[a-f0-9]{64}$/)
    expect(matchesCrewPinDigest('045321', digest, scope, key)).toBe(true)
    expect(matchesCrewPinDigest('045322', digest, scope, key)).toBe(false)
    const variations: CrewPinScope[] = [
      { ...scope, crewDispatchId: 'crew-2' },
      { ...scope, jobId: 'job-2' },
      { ...scope, crewVersion: 4 },
      { ...scope, assignmentId: 'slot-2' },
      { ...scope, workerUserId: 'member-2' },
      { ...scope, purpose: 'WORK_START' },
    ]
    for (const other of variations) {
      expect(matchesCrewPinDigest('045321', digest, other, key)).toBe(false)
      expect(sign('045321', other)).not.toBe(digest)
    }
  })

  it('does not allow one worker to reuse another member’s arrival PIN across 2/3+ rosters', () => {
    const first = sign()
    for (const num of [2, 3, 4]) {
      const other = {
        ...scope, assignmentId: 'slot-' + num, workerUserId: 'member-' + num,
      }
      expect(matchesCrewPinDigest('045321', first, other, key)).toBe(false)
    }
  })

  it('rejects malformed PINs, versions, scopes, secrets and stored digests', () => {
    for (const bad of ['12345', '1234567', '12a456', '１２３４５６', '']) {
      expect(() => sign(bad)).toThrow('Invalid crew PIN format')
      expect(matchesCrewPinDigest(bad, sign(), scope, key)).toBe(false)
    }
    for (const invalid of [
      { ...scope, crewVersion: 0 },
      { ...scope, crewVersion: 1.5 },
      { ...scope, workerUserId: '' },
      { ...scope, assignmentId: ' member ' },
      { ...scope, purpose: 'PAYMENT' as 'ARRIVAL' },
    ]) {
      expect(() => sign('045321', invalid)).toThrow('Invalid crew PIN scope')
      expect(matchesCrewPinDigest('045321', sign(), invalid, key)).toBe(false)
    }
    expect(() => sign('045321', scope, Buffer.from('short'))).toThrow('key is not configured')
    expect(matchesCrewPinDigest('045321', sign(), scope, Buffer.from('short'))).toBe(false)
    expect(matchesCrewPinDigest('045321', 'invalid', scope, key)).toBe(false)
    expect(matchesCrewPinDigest('045321', '0'.repeat(64), scope, key)).toBe(false)
  })

  it('uses an independently required server key, not a plaintext/unsalted PIN hash', () => {
    expect(sign('045321', scope, Buffer.alloc(32, 0x01)))
      .not.toBe(sign('045321', scope, Buffer.alloc(32, 0x02)))
    const digest = sign()
    expect(digest).not.toContain('045321')
    expect(matchesCrewPinDigest('045321', digest, scope, Buffer.alloc(32, 0x02)))
      .toBe(false)
  })

  it('does not wire PINs into an active customer/worker route or bypass existing crew ban', () => {
    const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
    const pin = source('lib/domain/job-pin.ts')
    expect(pin.split("if ((job.workersCount ?? 1) !== 1)").length - 1).toBe(3)
    expect(pin).toContain('Multi-worker jobs require crew-specific PIN verification')
    const worker = source('app/api/mobile/worker/crew/route.ts')
    const roster = source('app/api/mobile/company/crew/roster/route.ts')
    expect(worker).not.toContain('deriveCrewPinDigest')
    expect(roster).not.toContain('deriveCrewPinDigest')
  })
})
