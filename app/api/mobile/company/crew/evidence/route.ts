import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { prisma } from '@/lib/prisma'
import { assertStagedCrewIdentityEvidenceInsideTransaction } from '@/lib/domain/company-crew-barrier'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { secureConsole } from '@/lib/shared/observability/secure-console'

/**
 * Authorized dispatcher, read-only review of all-member evidence.
 * This is NOT the transition that enables the crew to start a booking.
 * Both the route and domain return explicit false PIN/work-start flags.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid crew evidence request' }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    if (typeof input.companyId !== 'string' || !input.companyId.trim() ||
        input.companyId.length > 128 ||
        typeof input.crewDispatchId !== 'string' || !input.crewDispatchId.trim() ||
        input.crewDispatchId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1 ||
        'actorUserId' in input || 'actorRole' in input || 'workerUserIds' in input) {
      return NextResponse.json({ error: 'Invalid crew evidence request' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(
      user.id, input.companyId, 'workers:assign',
    )
    if (error) return error
    if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const result = await prisma.$transaction(
      tx => assertStagedCrewIdentityEvidenceInsideTransaction(tx, {
        crewDispatchId: input.crewDispatchId as string,
        expectedVersion: input.expectedVersion as number,
        actorUserId: user.id,
        actorRole: context.role,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof CrewCommitGateError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Crew evidence changed; refresh and retry' }, { status: 409 })
    }
    secureConsole.error('Crew evidence check failed:', error)
    return NextResponse.json({ error: 'Unable to validate crew evidence' }, { status: 500 })
  }
}
