import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { consumeStagedCrewMemberPinInsideTransaction } from '@/lib/domain/company-crew-pin-consume'
import { getPhase04CrewPinTestKey } from '@/lib/domain/company-crew-pin-dev-api-guard'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { secureConsole } from '@/lib/shared/observability/secure-console'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** Authenticated worker's own six-digit arrival code, one-time consumption.
 * Strictly isolated, opt-in nonproduction testing only. Never returns or logs
 * PIN plaintext, never marks ARRIVED/READY/WORK_START or permits payments.
 * Failed attempts are written and COMMITTED, not thrown away on rollback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const key = getPhase04CrewPinTestKey()
  if (!key) return NextResponse.json({ error: 'Crew PIN verification is disabled' },
    { status: 409, headers: NO_STORE })
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' },
      { status: 401, headers: NO_STORE })
    const blocked = assertNotSuspended(user)
    if (blocked) {
      blocked.headers.set('Cache-Control', 'private, no-store')
      return blocked
    }
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      return NextResponse.json({ error: 'JSON required' }, { status: 415, headers: NO_STORE })
    }
    const { id: jobId } = await params
    const len = request.headers.get('content-length')
    const size = len === null ? 0 : Number(len)
    if (!jobId || jobId.length > 128 || !Number.isSafeInteger(size) ||
        size < 0 || size > 1024) {
      return NextResponse.json({ error: 'Invalid crew PIN request' },
        { status: 400, headers: NO_STORE })
    }
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > 1024) {
      return NextResponse.json({ error: 'Invalid crew PIN request' },
        { status: 400, headers: NO_STORE })
    }
    let body: unknown
    try { body = JSON.parse(raw) } catch { body = null }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid crew PIN request' },
        { status: 400, headers: NO_STORE })
    }
    const input = body as Record<string, unknown>
    if (Object.keys(input).some(k => !['crewDispatchId', 'expectedVersion','pin'].includes(k)) ||
        typeof input.crewDispatchId !== 'string' ||
        !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1 ||
        typeof input.pin !== 'string' || !/^[0-9]{6}$/.test(input.pin)) {
      return NextResponse.json({ error: 'Invalid crew PIN request' },
        { status: 400, headers: NO_STORE })
    }
    const result = await prisma.$transaction(async tx => {
      const [crew, slot] = await Promise.all([
        tx.companyCrewDispatch.findFirst({
          where: { id: input.crewDispatchId as string, jobId },
          select: { id: true },
        }),
        tx.companyJobAssignment.findFirst({
          where: {
            crewDispatchId: input.crewDispatchId as string, jobId,
            workerUserId: user.id, status: 'CREW_ACCEPTED',
          },
          select: { id: true },
        }),
      ])
      if (!crew || !slot) throw new CrewCommitGateError('Crew invitation not found', 404)
      return consumeStagedCrewMemberPinInsideTransaction(tx, {
        crewDispatchId: crew.id,
        expectedVersion: input.expectedVersion as number,
        authenticatedWorkerUserId: user.id,
        purpose: 'ARRIVAL',
        pin: input.pin as string,
        signingKey: key,
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json({
      pinVerified: result.pinVerified,
      attemptsRemaining: result.attemptsRemaining,
      arrivalEnabled: false, workStartEnabled: false,
    }, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof CrewCommitGateError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034','P2002'].includes(err.code)) {
      return NextResponse.json({ error: 'Crew PIN changed; refresh and retry' },
        { status: 409, headers: NO_STORE })
    }
    // Do not log secret submitted codes or signed digests.
    secureConsole.error('Crew PIN verification failed in isolated test environment')
    return NextResponse.json({ error: 'Unable to verify crew PIN' },
      { status: 500, headers: NO_STORE })
  }
}
