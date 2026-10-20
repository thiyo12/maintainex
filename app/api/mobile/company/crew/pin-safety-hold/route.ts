import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { getPhase04CrewPinTestKey } from '@/lib/domain/company-crew-pin-dev-api-guard'
import { holdCrewAfterPinClaimInsideTransaction } from '@/lib/domain/company-crew-pin-safety-hold'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { secureConsole } from '@/lib/shared/observability/secure-console'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * Strictly opt-in local isolated-DB MANAGER safety-review test endpoint.
 * Uses the PIN-test guard only as a SECOND disabled-by-default boundary;
 * no PIN key or code is passed to the safety-hold transaction or logged.
 * Never releases an accepted crew, pays, marks arrival, starts work, or
 * resolves support/cancellation: the epoch is BLOCKED awaiting human review.
 */
export async function POST(request: NextRequest) {
  if (!getPhase04CrewPinTestKey()) {
    return NextResponse.json({ error: 'Crew safety hold is disabled' },
      { status: 409, headers: NO_STORE })
  }
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' },
      { status: 401, headers: NO_STORE })
    const restricted = assertNotSuspended(user)
    if (restricted) {
      restricted.headers.set('Cache-Control', 'private, no-store')
      return restricted
    }
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      return NextResponse.json({ error: 'JSON required' }, { status: 415, headers: NO_STORE })
    }
    const declared = request.headers.get('content-length')
    const size = declared === null ? 0 : Number(declared)
    if (!Number.isSafeInteger(size) || size < 0 || size > 2048) {
      return NextResponse.json({ error: 'Invalid safety hold scope' },
        { status: 400, headers: NO_STORE })
    }
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > 2048) {
      return NextResponse.json({ error: 'Invalid safety hold scope' },
        { status: 400, headers: NO_STORE })
    }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = null }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid safety hold scope' },
        { status: 400, headers: NO_STORE })
    }
    const input = parsed as Record<string, unknown>
    // Neither an arbitrary role, actor ID, booking ID nor any worker list can
    // ever be submitted to the domain containment primitive by a client.
    if (Object.keys(input).some(k =>
          !['companyId', 'crewDispatchId', 'expectedVersion', 'reason'].includes(k)) ||
        typeof input.companyId !== 'string' || !input.companyId.trim() ||
        input.companyId.length > 128 ||
        typeof input.crewDispatchId !== 'string' || !input.crewDispatchId.trim() ||
        input.crewDispatchId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1 ||
        typeof input.reason !== 'string' || !input.reason.trim() ||
        input.reason.trim().length > 250) {
      return NextResponse.json({ error: 'Invalid safety hold scope' },
        { status: 400, headers: NO_STORE })
    }
    const { context, error } = await resolveCompanyContext(
      user.id, input.companyId, 'workers:assign',
    )
    if (error) {
      error.headers.set('Cache-Control', 'private, no-store')
      return error
    }
    if (!context) return NextResponse.json({ error: 'Forbidden' },
      { status: 403, headers: NO_STORE })

    const held = await prisma.$transaction(
      tx => holdCrewAfterPinClaimInsideTransaction(tx, {
        crewDispatchId: input.crewDispatchId as string,
        companyId: context.companyId,
        expectedVersion: input.expectedVersion as number,
        actorUserId: user.id,
        actorRole: context.role,
        reason: input.reason as string,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    return NextResponse.json({
      crewDispatchId: held.crewDispatchId,
      crewVersion: held.crewVersion,
      status: 'BLOCKED',
      preservedConsumedPinClaims: held.preservedConsumedPinClaims,
      revokedUnusedPinChallenges: held.revokedUnusedPinChallenges,
      capacityHeldWorkerCount: held.capacityHeldWorkerCount,
      supportReviewRequired: true,
      physicalPresenceVerified: false,
      arrivalEnabled: false,
      workStartEnabled: false,
      paymentsEnabled: false,
    }, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof CrewCommitGateError) {
      return NextResponse.json({ error: err.message },
        { status: err.status, headers: NO_STORE })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(err.code)) {
      return NextResponse.json({ error: 'Crew safety state changed; refresh and retry' },
        { status: 409, headers: NO_STORE })
    }
    // Never print customer/worker submissions, PINs, signing keys or photos.
    secureConsole.error('Isolated crew safety containment failed')
    return NextResponse.json({ error: 'Unable to contain crew safety state' },
      { status: 500, headers: NO_STORE })
  }
}
