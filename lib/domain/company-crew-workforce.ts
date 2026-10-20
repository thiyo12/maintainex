import { Prisma } from '@prisma/client'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { revokeCrewPinChallengesInsideTransaction } from '@/lib/domain/company-crew-pin-revocation'

// Must be called under the SAME SERIALIZABLE transaction and current membership
// locks as the worker role/status write. Terminal: never enables PIN or work.
export async function blockWorkerFormingCrewsInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    workerUserId: string
    actorUserId: string
    actorRole: string
    reason: 'ROLE_CHANGED' | 'SUSPENDED' | 'REMOVED'
  },
): Promise<{ blockedCrewsCount: number; revokedCrewSlotsCount: number }> {
  const held = await tx.companyJobAssignment.findMany({
    where: {
      companyId: input.companyId, workerUserId: input.workerUserId,
      status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] },
    },
    select: { id: true, crewDispatchId: true, jobId: true },
  })
  if (!held.length) return { blockedCrewsCount: 0, revokedCrewSlotsCount: 0 }
  if (held.some(slot => !slot.crewDispatchId)) throw new Error('CREW_WORKFORCE_STATE_CONFLICT')

  const crewIds = [...new Set(held.map(slot => slot.crewDispatchId!))].sort()
  let revokedCrewSlotsCount = 0
  for (const crewId of crewIds) {
    const key = await tx.companyCrewDispatch.findUnique({
      where: { id: crewId }, select: { companyId: true, jobId: true },
    })
    if (!key || key.companyId !== input.companyId) throw new Error('CREW_WORKFORCE_STATE_CONFLICT')

    // Job then crew: same serialization order as crew decision/cancellation.
    // Conflicting target-member locks produce a transaction abort, never a
    // partially revoked roster. The HTTP paths convert retry conflicts to 409.
    const jobs = await tx.$queryRaw<Array<{
      id: string; status: string; workersCount: number
    }>>`
      SELECT id, status, "workersCount"
      FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
    `
    const crews = await tx.$queryRaw<Array<{
      id: string; companyId: string; jobId: string; status: string
      version: number; requiredWorkersCount: number
      leadWorkerUserId: string | null
    }>>`
      SELECT id, "companyId", "jobId", status, version,
        "requiredWorkersCount", "leadWorkerUserId"
      FROM "CompanyCrewDispatch" WHERE id = ${crewId} FOR UPDATE
    `
    const crew = crews[0]
    if (!crew || crew.companyId !== input.companyId ||
        crew.jobId !== key.jobId || crew.status !== 'FORMING' ||
        jobs[0]?.status !== 'QUOTE_ACCEPTED' ||
        jobs[0]?.workersCount !== crew.requiredWorkersCount ||
        crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
      throw new Error('CREW_WORKFORCE_STATE_CONFLICT')
    }

    const [arrival, pin, slots] = await Promise.all([
      tx.jobVerificationPin.findFirst({
        where: { jobId: crew.jobId, arrivalVerifiedAt: { not: null } },
        select: { id: true },
      }),
      tx.jobVerificationPin.findFirst({
        where: { jobId: crew.jobId, status: 'ACTIVE' },
        select: { id: true },
      }),
      tx.companyJobAssignment.findMany({
        where: { crewDispatchId: crew.id },
        select: {
          id: true, companyId: true, jobId: true, workerUserId: true,
          status: true, crewSlot: true, crewRole: true,
          crewArrivedAt: true, startedAt: true,
        },
      }),
    ])
    if (arrival || pin || slots.length !== crew.requiredWorkersCount ||
        !slots.some(slot => slot.workerUserId === input.workerUserId) ||
        new Set(slots.map(slot => slot.workerUserId)).size !== slots.length ||
        new Set(slots.map(slot => slot.crewSlot)).size !== slots.length ||
        slots.filter(slot => slot.crewRole === 'LEAD').length !== 1 ||
        slots.find(slot => slot.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
        slots.some(slot => slot.companyId !== crew.companyId ||
          slot.jobId !== crew.jobId || !slot.crewSlot ||
          slot.crewArrivedAt !== null || slot.startedAt !== null ||
          !['CREW_RESERVED', 'CREW_ACCEPTED'].includes(slot.status))) {
      throw new Error('CREW_WORKFORCE_STATE_CONFLICT')
    }

    // Under the same job/crew lock, withdraw all unconsumed member codes.
    // Consumed proof is a support-only state and stops this membership write.
    try {
      await revokeCrewPinChallengesInsideTransaction(tx, {
        crewDispatchId: crew.id, crewVersion: crew.version,
      })
    } catch {
      throw new Error('CREW_WORKFORCE_STATE_CONFLICT')
    }

    const now = new Date()
    const released = await tx.companyJobAssignment.updateMany({
      where: { crewDispatchId: crew.id, status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] } },
      data: {
        status: 'REVOKED', revokedAt: now,
        revokedReason: 'Crew blocked by workforce ' + input.reason.toLowerCase(),
      },
    })
    if (released.count !== slots.length) throw new Error('CREW_WORKFORCE_STATE_CONFLICT')
    const blocked = await tx.companyCrewDispatch.updateMany({
      where: { id: crew.id, version: crew.version, status: 'FORMING' },
      data: { status: 'BLOCKED', version: { increment: 1 } },
    })
    if (blocked.count !== 1) throw new Error('CREW_WORKFORCE_STATE_CONFLICT')

    await writeCompanyAuditLog({
      companyId: input.companyId, actorId: input.actorUserId,
      actorRole: input.actorRole, action: 'CREW_WORKFORCE_INVALIDATED',
      targetType: 'CompanyCrewDispatch', targetId: crew.id,
      description: 'Whole staged crew blocked following workforce transition; no work authorized',
      metadata: {
        jobId: crew.jobId, previousVersion: crew.version,
        trigger: input.reason, affectedWorkerUserId: input.workerUserId,
        revokedCrewSlots: released.count,
      },
    }, tx)
    revokedCrewSlotsCount += released.count
  }
  return { blockedCrewsCount: crewIds.length, revokedCrewSlotsCount }
}
