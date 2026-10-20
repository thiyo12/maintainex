import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { secureConsole } from '@/lib/shared/observability/secure-console'

/**
 * Customer-only crew photo preview. Reads already accepted individual
 * reservations and independently verified personal photos; it never creates
 * a MATCHED confirmation, changes a booking or grants PIN/work authority.
 *
 * In particular, a legacy single-worker identity check MUST NOT stand in
 * for the other crew members or automatically make a multi-worker job ready.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId } = await params
    if (!jobId || jobId.length > 128) {
      return NextResponse.json({ error: 'Invalid booking' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const job = await tx.marketplaceJob.findUnique({
        where: { id: jobId },
        select: { customerId: true, status: true, workersCount: true },
      })
      if (!job || job.customerId !== user.id) return null

      // Crew job ownership is established through a specific ACCEPTED company
      // quote; a malicious user cannot probe details of an unrelated roster.
      if (job.workersCount < 2 || job.workersCount > 12) {
        return { error: 'NOT_CREW' as const }
      }
      const crew = await tx.companyCrewDispatch.findUnique({
        where: { jobId },
        select: {
          id: true, companyId: true, status: true, version: true,
          requiredWorkersCount: true,
          assignments: {
            select: {
              id: true, workerUserId: true, status: true,
              crewSlot: true, crewRole: true, acceptedAt: true,
              crewIdentityConfirmedAt: true,
              worker: {
                select: {
                  name: true, isActive: true, isSuspended: true,
                  isBanned: true, identityStatus: true,
                },
              },
            },
            orderBy: { crewSlot: 'asc' },
          },
        },
      })
      if (!crew) return { crew: null, workers: [], allConfirmed: false }
      const quote = await tx.jobQuote.findFirst({
        where: {
          jobId, providerType: 'COMPANY',
          providerId: crew.companyId, status: 'ACCEPTED',
        },
        select: { id: true },
      })
      if (!quote) return null
      if (crew.status !== 'FORMING' || job.status !== 'QUOTE_ACCEPTED') {
        return {
          crew: { id: crew.id, status: crew.status, version: crew.version },
          workers: [], allConfirmed: false,
        }
      }

      const accepted = crew.assignments.filter(a => a.status === 'CREW_ACCEPTED')
      const acceptedIds = accepted.map(a => a.workerUserId)
      const [identities, memberships, confirmations] = await Promise.all([
        tx.providerIdentity.findMany({
          where: {
            currentUserId: { in: acceptedIds },
            identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
            kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
          },
          select: {
            id: true, currentUserId: true, verifiedPhotoUrl: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        tx.teamMember.findMany({
          where: {
            companyId: crew.companyId, userId: { in: acceptedIds },
            role: 'WORKER', status: 'ACTIVE',
          },
          select: { userId: true },
        }),
        tx.jobWorkerIdentityCheck.findMany({
          where: { jobId, assignedWorkerUserId: { in: acceptedIds } },
          select: {
            assignedWorkerUserId: true, providerIdentityId: true,
            status: true, confirmedAt: true, photoSnapshotUrl: true,
          },
        }),
      ])
      const validMembers = new Set(memberships.map(m => m.userId))
      const uniqueIdentity = new Map<string, { id: string; verifiedPhotoUrl: string | null }>()
      for (const identity of identities) {
        if (identity.currentUserId && !uniqueIdentity.has(identity.currentUserId)) {
          uniqueIdentity.set(identity.currentUserId, identity)
        }
      }
      const workers = crew.assignments.map(slot => {
        const accountOk = slot.worker.isActive && !slot.worker.isSuspended &&
          !slot.worker.isBanned && slot.worker.identityStatus === 'VERIFIED'
        const memberOk = validMembers.has(slot.workerUserId)
        const isAccepted = slot.status === 'CREW_ACCEPTED'
        const identity = isAccepted && accountOk && memberOk
          ? uniqueIdentity.get(slot.workerUserId) : undefined
        const check = confirmations.find(entry =>
          entry.assignedWorkerUserId === slot.workerUserId &&
          entry.providerIdentityId === identity?.id &&
          entry.status === 'MATCHED' &&
          entry.photoSnapshotUrl === identity?.verifiedPhotoUrl &&
          entry.confirmedAt !== null &&
          slot.acceptedAt !== null &&
          entry.confirmedAt! >= slot.acceptedAt)
        const confirmed = !!check && slot.crewIdentityConfirmedAt !== null &&
          slot.crewIdentityConfirmedAt >= slot.acceptedAt!
        return {
          assignmentId: slot.id,
          crewSlot: slot.crewSlot,
          crewRole: slot.crewRole,
          status: slot.status,
          // Do not reveal unaccepted employees or suspended identities.
          displayName: identity ? slot.worker.name : null,
          verifiedPhotoUrl: identity?.verifiedPhotoUrl ?? null,
          photoReady: !!identity,
          customerConfirmed: confirmed,
        }
      })
      return {
        crew: {
          id: crew.id, status: crew.status,
          version: crew.version,
          requiredWorkersCount: crew.requiredWorkersCount,
        },
        workers,
        allConfirmed: workers.length === crew.requiredWorkersCount &&
          workers.every(w => w.status === 'CREW_ACCEPTED' &&
            w.photoReady && w.customerConfirmed),
      }
    })

    if (result === null) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if ('error' in result) {
      return NextResponse.json({ error: 'Booking does not require a crew' }, { status: 409 })
    }
    return NextResponse.json({
      ...result,
      dispatchEnabled: false,
      workStartEnabled: false,
      arrivalPinEnabled: false,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    secureConsole.error('Customer crew identity preview failed:', error)
    return NextResponse.json({ error: 'Unable to load crew identity preview' }, { status: 500 })
  }
}
