import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { stageCrewReservationInsideTransaction, CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { cancelStagedCrewInsideTransaction } from '@/lib/domain/company-crew-lifecycle'
import { secureConsole } from '@/lib/shared/observability/secure-console'

async function authorizedCompany(request: NextRequest, input: Record<string, unknown>) {
  const user = await authenticateMarketplaceUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const blocked = assertNotSuspended(user)
  if (blocked) return { error: blocked }
  if (typeof input.companyId !== 'string' || !input.companyId.trim() || input.companyId.length > 128) {
    return { error: NextResponse.json({ error: 'Invalid company' }, { status: 400 }) }
  }
  const result = await resolveCompanyContext(user.id, input.companyId, 'workers:assign')
  if (result.error) return { error: result.error }
  if (!result.context) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actorId: user.id, companyId: result.context.companyId, role: result.context.role }
}


/**
 * Authorized dispatcher read model. No customer contact or location data,
 * competing quotes, raw photo IDs, identity documents or PINs are exposed.
 * A FORMING roster is an internal hold, not active crew dispatch.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked
    if (!companyId.trim() || companyId.length > 128) {
      return NextResponse.json({ error: 'Invalid company' }, { status: 400 })
    }
    const result = await resolveCompanyContext(user.id, companyId, 'workers:read')
    if (result.error) return result.error
    if (!result.context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const rows = await prisma.companyCrewDispatch.findMany({
      where: { companyId: result.context.companyId, status: 'FORMING' },
      select: {
        id: true, status: true, version: true,
        requiredWorkersCount: true, leadWorkerUserId: true,
        job: { select: { id: true, title: true, countryCode: true } },
        assignments: {
          select: {
            id: true, status: true, crewSlot: true, crewRole: true,
            worker: { select: { id: true, name: true } },
          },
          orderBy: { crewSlot: 'asc' },
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      crews: rows.map(row => ({
        ...row, dispatchEnabled: false,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    secureConsole.error('Crew roster listing failed:', error)
    return NextResponse.json({ error: 'Unable to load crew rosters' }, { status: 500 })
  }
}

/**
 * Staging is deliberately unavailable on production and opt-in in test/dev.
 * It reserves capacity but never sends invitations, grants PINs, changes
 * booking state, or authorizes work. No feature activation by this PR.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' ||
      process.env.MAINTAINEX_PHASE04_CREW_STAGING_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Crew dispatch is not enabled' }, { status: 409 })
  }
  try {
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid crew roster' }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    if (typeof input.jobId !== 'string' || !input.jobId.trim() || input.jobId.length > 128 ||
        !Array.isArray(input.workerUserIds) ||
        typeof input.leadWorkerUserId !== 'string' ||
        'actorUserId' in input || 'actorRole' in input) {
      return NextResponse.json({ error: 'Invalid crew roster' }, { status: 400 })
    }
    const actor = await authorizedCompany(request, input)
    if (actor.error) return actor.error
    const result = await prisma.$transaction(
      tx => stageCrewReservationInsideTransaction(tx, {
        companyId: actor.companyId!, jobId: input.jobId as string,
        workerUserIds: input.workerUserIds as string[],
        leadWorkerUserId: input.leadWorkerUserId as string,
        actorUserId: actor.actorId!, actorRole: actor.role!,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return handleError(error, 'Crew reservation failed')
  }
}

/** Always permit authorized cancellation of still-FORMING capacity, even
 * when staging has since been turned off. This cannot revoke started work. */
export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid crew cancellation' }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    if (typeof input.crewDispatchId !== 'string' ||
        !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1 ||
        (input.reason !== undefined &&
          (typeof input.reason !== 'string' || input.reason.length > 250)) ||
        'actorUserId' in input || 'actorRole' in input) {
      return NextResponse.json({ error: 'Invalid crew cancellation' }, { status: 400 })
    }
    const actor = await authorizedCompany(request, input)
    if (actor.error) return actor.error
    const result = await prisma.$transaction(
      tx => cancelStagedCrewInsideTransaction(tx, {
        companyId: actor.companyId!, crewDispatchId: input.crewDispatchId as string,
        expectedVersion: input.expectedVersion as number,
        actorUserId: actor.actorId!, actorRole: actor.role!,
        reason: input.reason as string | undefined,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return handleError(error, 'Crew cancellation failed')
  }
}

function handleError(error: unknown, context: string) {
  if (error instanceof CrewCommitGateError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return NextResponse.json({ error: 'Crew roster changed; refresh and retry' }, { status: 409 })
  }
  secureConsole.error(context, error)
  return NextResponse.json({ error: context }, { status: 500 })
}
