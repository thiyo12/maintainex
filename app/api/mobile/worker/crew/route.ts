import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import {
  acceptStagedCrewMemberInsideTransaction,
  rejectStagedCrewMemberInsideTransaction,
} from '@/lib/domain/company-crew-lifecycle'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { secureConsole } from '@/lib/shared/observability/secure-console'

/** Read only the authenticated worker's own staged invitations. No crew peers,
 * customer address, PIN, or competing quotes are ever exposed by this route. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked
    const rows = await prisma.companyJobAssignment.findMany({
      where: {
        workerUserId: user.id,
        crewDispatchId: { not: null },
        status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] },
        crewDispatch: { status: 'FORMING' },
        company: {
          teamMembers: {
            some: { userId: user.id, status: 'ACTIVE', role: 'WORKER' },
          },
        },
      },
      select: {
        id: true, status: true, acceptedAt: true,
        company: { select: { companyName: true } },
        job: { select: { title: true, countryCode: true, preferredDate: true, preferredTimeSlot: true } },
        crewDispatch: { select: { id: true, status: true, version: true, requiredWorkersCount: true } },
      },
      take: 50,
      orderBy: { assignedAt: 'desc' },
    })
    return NextResponse.json({
      invitations: rows.map(row => ({
        assignmentId: row.id, status: row.status,
        acceptedAt: row.acceptedAt,
        companyName: row.company.companyName,
        job: row.job,
        crew: row.crewDispatch,
        dispatchEnabled: false,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    secureConsole.error('Worker crew invitation listing failed:', error)
    return NextResponse.json({ error: 'Unable to load crew invitations' }, { status: 500 })
  }
}

/**
 * Each worker answers only their own reservation. No request-supplied worker
 * identity or company role is ever trusted; all mutations run under a single
 * SERIALIZABLE transaction and leave dispatch/work-start disabled.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid crew response' }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    if (typeof input.crewDispatchId !== 'string' ||
        !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
        !Number.isSafeInteger(input.expectedVersion) ||
        (input.expectedVersion as number) < 1 ||
        !['accept', 'reject'].includes(String(input.action)) ||
        'workerUserId' in input || 'actorUserId' in input ||
        (input.reason !== undefined &&
          (typeof input.reason !== 'string' || input.reason.length > 250))) {
      return NextResponse.json({ error: 'Invalid crew response' }, { status: 400 })
    }
    const decision = {
      crewDispatchId: input.crewDispatchId,
      expectedVersion: input.expectedVersion as number,
      workerUserId: user.id,
    }
    const result = await prisma.$transaction(
      tx => input.action === 'accept'
        ? acceptStagedCrewMemberInsideTransaction(tx, decision)
        : rejectStagedCrewMemberInsideTransaction(tx, {
          ...decision, reason: input.reason as string | undefined,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    return NextResponse.json({ ...result, dispatchEnabled: false }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof CrewCommitGateError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Crew response changed; retry with current roster version' }, { status: 409 })
    }
    secureConsole.error('Worker crew invitation response failed:', error)
    return NextResponse.json({ error: 'Unable to respond to crew invitation' }, { status: 500 })
  }
}
