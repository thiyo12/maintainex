import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { issueStagedCrewArrivalPinsInsideTransaction } from '@/lib/domain/company-crew-pin-issue'
import { getPhase04CrewPinTestKey } from '@/lib/domain/company-crew-pin-dev-api-guard'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { secureConsole } from '@/lib/shared/observability/secure-console'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** Customer-only developer fixture. Disabled in production and without TWO
 * independent explicit flags, strong server key and disposable local DB.
 * PINs are not saved or logged in plaintext. No crew arrival/start is enabled.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const key = getPhase04CrewPinTestKey()
  if (!key) return NextResponse.json({ error: 'Crew PIN issuance is disabled' },
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
      return NextResponse.json({ error: 'JSON required' },
        { status: 415, headers: NO_STORE })
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
    if (Object.keys(input).some(k => !['crewDispatchId', 'expectedVersion'].includes(k)) ||
        typeof input.crewDispatchId !== 'string' ||
        !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1) {
      return NextResponse.json({ error: 'Invalid crew PIN request' },
        { status: 400, headers: NO_STORE })
    }
    const issued = await prisma.$transaction(async tx => {
      const [booking, crew] = await Promise.all([
        tx.marketplaceJob.findFirst({
          where: { id: jobId, customerId: user.id },
          select: { id: true },
        }),
        tx.companyCrewDispatch.findFirst({
          where: { id: input.crewDispatchId as string, jobId },
          select: { id: true },
        }),
      ])
      if (!booking || !crew) throw new CrewCommitGateError('Crew booking not found', 404)
      return issueStagedCrewArrivalPinsInsideTransaction(tx, {
        crewDispatchId: crew.id,
        expectedVersion: input.expectedVersion as number,
        authenticatedCustomerUserId: user.id,
        signingKey: key,
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    // Only the authenticated booking customer receives the distinct temporary
    // one-time codes, to pass each to their matching worker in person.
    return NextResponse.json({
      crewDispatchId: issued.crewDispatchId,
      crewVersion: issued.crewVersion,
      memberCodes: issued.memberCodes,
      arrivalEnabled: false, workStartEnabled: false,
    }, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof CrewCommitGateError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034','P2002'].includes(err.code)) {
      return NextResponse.json({ error: 'Crew PIN issuance changed; retry after refreshing' },
        { status: 409, headers: NO_STORE })
    }
    // Never log code material, signed digests, request bodies or key.
    secureConsole.error('Crew PIN issuance failed in isolated test environment')
    return NextResponse.json({ error: 'Unable to issue crew PINs' },
      { status: 500, headers: NO_STORE })
  }
}
