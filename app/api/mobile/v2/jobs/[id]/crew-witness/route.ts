import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { recordCrewPresenceWitnessInsideTransaction } from '@/lib/domain/company-crew-presence-record'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { isPhase04CrewWitnessIsolatedTestEnvironment } from '@/lib/domain/company-crew-witness-isolated-db'
import { secureConsole } from '@/lib/shared/observability/secure-console'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const MAX_REQUEST_BYTES = 2048

/**
 * Development-only actor-bound dual-witness collection, disabled by default.
 * No PINs, other workers' identities, addresses or customer data are returned.
 * This does NOT establish physical presence, crew arrival, READY or work-start.
 * Production MUST stay disabled even if an operator sets the opt-in flag.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isPhase04CrewWitnessIsolatedTestEnvironment()) {
    return NextResponse.json({ error: 'Crew witness recording is not enabled' },
      { status: 409, headers: NO_STORE })
  }
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId } = await params
    const lengthHeader = request.headers.get('content-length')
    const length = lengthHeader === null ? 0 : Number(lengthHeader)
    if (typeof jobId !== 'string' || !jobId.trim() || jobId.length > 128 ||
        !Number.isSafeInteger(length) || length < 0 || length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Invalid crew witness scope' },
        { status: 400, headers: NO_STORE })
    }
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Invalid crew witness scope' },
        { status: 400, headers: NO_STORE })
    }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = null }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid crew witness scope' },
        { status: 400, headers: NO_STORE })
    }
    const input = parsed as Record<string, unknown>
    // A client can nominate a crew and slot but NEVER itself choose whose
    // acknowledgment is written, a PIN, a user, an actor role or a timestamp.
    if (Object.keys(input).some(k =>
          !['crewDispatchId', 'assignmentId', 'expectedVersion'].includes(k)) ||
        typeof input.crewDispatchId !== 'string' ||
        !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
        typeof input.assignmentId !== 'string' ||
        !input.assignmentId.trim() || input.assignmentId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1) {
      return NextResponse.json({ error: 'Invalid crew witness scope' },
        { status: 400, headers: NO_STORE })
    }

    const receipt = await prisma.$transaction(async tx => {
      // Scope the URL's job and submitted crew together BEFORE any ownership
      // decision. Otherwise a customer with two bookings could point this
      // endpoint at an unrelated job's crew.
      const crew = await tx.companyCrewDispatch.findFirst({
        where: { id: input.crewDispatchId as string, jobId },
        select: { id: true },
      })
      if (!crew) throw new CrewCommitGateError('Crew witness not found', 404)

      // Actual persisted relationship determines the participant. The
      // request body cannot promote an employee to CUSTOMER or vice versa.
      const [customer, worker] = await Promise.all([
        tx.marketplaceJob.findFirst({
          where: { id: jobId, customerId: user.id },
          select: { id: true },
        }),
        tx.companyJobAssignment.findFirst({
          where: {
            id: input.assignmentId as string, jobId,
            crewDispatchId: crew.id, workerUserId: user.id,
            status: 'CREW_ACCEPTED',
          },
          select: { id: true },
        }),
      ])
      // Never accept the same identity as two independent witnesses.
      if (customer && worker) {
        throw new CrewCommitGateError('Crew witness requires distinct customer and worker accounts')
      }
      if (!customer && !worker) {
        throw new CrewCommitGateError('Crew witness not found', 404)
      }
      const result = await recordCrewPresenceWitnessInsideTransaction(tx, {
        crewDispatchId: crew.id,
        assignmentId: input.assignmentId as string,
        expectedVersion: input.expectedVersion as number,
        authenticatedUserId: user.id,
        participant: customer ? 'CUSTOMER' : 'WORKER',
      })
      // An upstream internal result cannot accidentally turn this receipt
      // into an arrival/payment/start authority token.
      return {
        crewDispatchId: result.crewDispatchId,
        crewVersion: result.crewVersion,
        assignmentId: result.assignmentId,
        participantRecorded: result.participantRecorded,
        physicalPresenceVerified: false as const,
        arrivalEnabled: false as const,
        workStartEnabled: false as const,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json(receipt, { headers: NO_STORE })
  } catch (error) {
    if (error instanceof CrewCommitGateError) {
      return NextResponse.json({ error: error.message },
        { status: error.status, headers: NO_STORE })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)) {
      return NextResponse.json({ error: 'Crew witness changed; refresh and retry' },
        { status: 409, headers: NO_STORE })
    }
    secureConsole.error('Crew witness collection failed:', error)
    return NextResponse.json({ error: 'Unable to record crew witness' },
      { status: 500, headers: NO_STORE })
  }
}
