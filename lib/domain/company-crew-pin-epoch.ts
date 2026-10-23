import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * INTERNAL ONLY; no storage, issuance, acceptance or work authority.
 * Future DB callers must additionally require authenticated customer issuance,
 * authenticated individual arrival, customer photo match, current crew locks,
 * expiry, atomic one-time consumption, throttling and safety checks.
 * Never reuse the legacy single-worker JobVerificationPin.
 */
export type CrewPinPurpose = 'ARRIVAL' | 'WORK_START'
export interface CrewPinScope {
  crewDispatchId: string
  jobId: string
  crewVersion: number
  assignmentId: string
  workerUserId: string
  purpose: CrewPinPurpose
}
function serializeScope(scope: CrewPinScope): string {
  if (!scope || !Number.isSafeInteger(scope.crewVersion) || scope.crewVersion < 1 ||
      !['ARRIVAL', 'WORK_START'].includes(scope.purpose) ||
      [scope.crewDispatchId, scope.jobId, scope.assignmentId, scope.workerUserId]
        .some(value => typeof value !== 'string' ||
          !value.trim() || value.length > 128 || value !== value.trim())) {
    throw new Error('Invalid crew PIN scope')
  }
  // JSON array encoding preserves field boundaries and their order.
  return JSON.stringify([
    'maintainex/crew-pin/v1', scope.crewDispatchId, scope.jobId,
    scope.crewVersion, scope.assignmentId, scope.workerUserId, scope.purpose,
  ])
}
function requireKey(secret: Buffer): void {
  if (!Buffer.isBuffer(secret) || secret.length < 32) {
    throw new Error('Crew PIN signing key is not configured')
  }
}
export function generateCrewPinCode(): string {
  return String(randomInt(100000, 1000000))
}
export function deriveCrewPinDigest(pin: string, scope: CrewPinScope, secret: Buffer): string {
  if (typeof pin !== 'string' || !/^[0-9]{6}$/.test(pin)) {
    throw new Error('Invalid crew PIN format')
  }
  const serialized = serializeScope(scope)
  requireKey(secret)
  return createHmac('sha256', secret).update(serialized).update('\n').update(pin).digest('hex')
}
export function matchesCrewPinDigest(
  enteredPin: string, expectedDigest: string, scope: CrewPinScope, secret: Buffer,
): boolean {
  if (typeof enteredPin !== 'string' || !/^[0-9]{6}$/.test(enteredPin) ||
      typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
    return false
  }
  try {
    const actual = Buffer.from(deriveCrewPinDigest(enteredPin, scope, secret), 'hex')
    return timingSafeEqual(actual, Buffer.from(expectedDigest, 'hex'))
  } catch {
    return false
  }
}
