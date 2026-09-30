import { prisma, type PrismaClientOrTx } from '@/lib/prisma'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { emitSecurityEvent } from '@/lib/security/events'
import { notifyCompanyWorkerAssigned } from '@/lib/notifications'
import { hasCompanyPermission, isValidCompanyRole } from '@/lib/phase6/rbac'
import { checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'

export type AssignmentStatus = 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'REVOKED'

const VALID_TRANSITIONS: Record<string, AssignmentStatus[]> = {
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'REVOKED'],
  ACCEPTED: ['IN_PROGRESS', 'REVOKED'],
  IN_PROGRESS: ['COMPLETED', 'REVOKED'],
  COMPLETED: [],
  REJECTED: [],
  REVOKED: [],
}

export interface AssignmentCreateParams {
  companyId: string
  jobId: string
  workerUserId: string
  assignedByUserId: string
  actorRole: string
}

export interface AssignmentResult {
  success: boolean
  assignmentId?: string
  error?: string
  reasons?: string[]
}

async function lockAndAssertWorkerScheduleAvailable(
  tx: PrismaClientOrTx,
  workerUserId: string,
  jobId: string,
  preferredDate: Date | null,
  preferredTimeSlot: string | null,
): Promise<void> {
  const lockedWorker = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "User"
    WHERE id = ${workerUserId}
    FOR UPDATE
  `
  if (lockedWorker.length !== 1) {
    throw new Error('Worker account not found')
  }
  if (!preferredDate) return

  const dayStart = new Date(preferredDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const slotFilter =
    preferredTimeSlot && preferredTimeSlot !== 'anytime'
      ? {
          OR: [
            { preferredTimeSlot },
            { preferredTimeSlot: 'anytime' },
            { preferredTimeSlot: null },
          ],
        }
      : {}

  const conflict = await tx.companyJobAssignment.findFirst({
    where: {
      workerUserId,
      jobId: { not: jobId },
      status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
      job: {
        preferredDate: { gte: dayStart, lt: dayEnd },
        ...slotFilter,
      },
    },
    select: { id: true, jobId: true },
  })
  if (conflict) {
    throw new Error('Worker scheduling conflict changed concurrently')
  }
}

export async function createAssignment(params: AssignmentCreateParams): Promise<AssignmentResult> {
  const { companyId, jobId, workerUserId, assignedByUserId, actorRole } = params

  const actorMembership = await prisma.teamMember.findFirst({
    where: { companyId, userId: assignedByUserId, status: 'ACTIVE' },
    select: { role: true },
  })
  if (
    !actorMembership ||
    !isValidCompanyRole(actorMembership.role) ||
    actorMembership.role !== actorRole ||
    !hasCompanyPermission(actorMembership.role, 'workers:assign')
  ) {
    return { success: false, error: 'Actor is not authorized to assign workers for this company' }
  }

  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { success: false, error: 'Job not found' }
  if (job.status !== 'QUOTE_ACCEPTED') return { success: false, error: 'Job must be in QUOTE_ACCEPTED status' }

  const eligibility = await checkWorkerEligibility(companyId, workerUserId, jobId)
  if (!eligibility.eligible) {
    return { success: false, error: 'Worker not eligible', reasons: eligibility.reasons }
  }

  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerId: companyId, providerType: 'COMPANY', status: 'ACCEPTED' },
  })
  if (!acceptedQuote) return { success: false, error: 'No accepted quote from this company on this job' }

  const companyIdentity = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { userId: true },
  })
  if (!companyIdentity) return { success: false, error: 'Company not found' }

  const existingAssignment = await prisma.companyJobAssignment.findFirst({
    where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
  })
  if (existingAssignment) {
    return { success: false, error: 'Job already has an active assignment. Revoke first.' }
  }

  const existingWorkerAssignment = await prisma.companyJobAssignment.findUnique({
    where: { jobId_workerUserId: { jobId, workerUserId } },
  })
  if (
    existingWorkerAssignment &&
    !['REJECTED', 'REVOKED'].includes(existingWorkerAssignment.status)
  ) {
    return { success: false, error: 'This worker is already assigned to this job' }
  }

  let assignment: { id: string }
  try {
    assignment = await prisma.$transaction(async (tx) => {
      await lockAndAssertWorkerScheduleAvailable(
        tx,
        workerUserId,
        jobId,
        job.preferredDate,
        job.preferredTimeSlot,
      )

      const claimed = await tx.marketplaceJob.updateMany({
      where: {
        id: jobId,
        status: 'QUOTE_ACCEPTED',
        OR: [
          { targetTaskerId: null },
          { targetTaskerId: companyId },
          { targetTaskerId: companyIdentity.userId },
        ],
      },
      data: { targetTaskerId: workerUserId },
    })
    if (claimed.count !== 1) throw new Error('Job state changed concurrently')

    await tx.jobWorkspace.upsert({
      where: { jobId },
      create: { jobId, progressStatus: 'ACCEPTED' },
      update: { progressStatus: 'ACCEPTED', updatedAt: new Date() },
    })

    const record = existingWorkerAssignment
      ? await tx.companyJobAssignment.update({
          where: { id: existingWorkerAssignment.id },
          data: {
            assignedBy: assignedByUserId,
            status: 'ASSIGNED',
            assignedAt: new Date(),
            acceptedAt: null,
            startedAt: null,
            completedAt: null,
            rejectedAt: null,
            revokedAt: null,
            revokedReason: null,
            rejectReason: null,
          },
        })
      : await tx.companyJobAssignment.create({
          data: {
            companyId,
            jobId,
            workerUserId,
            assignedBy: assignedByUserId,
            status: 'ASSIGNED',
          },
        })

    await writeCompanyAuditLog({
      companyId,
      actorId: assignedByUserId,
      actorRole,
      action: 'WORKER_ASSIGN',
      targetType: 'CompanyJobAssignment',
      targetId: record.id,
      description: `Assigned worker to job ${jobId}`,
      metadata: { workerUserId, jobId, assignmentId: record.id },
    }, tx)

      return record
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes('concurrently') ||
        error.message.includes('scheduling conflict') ||
        error.message === 'Worker account not found'
      )
    ) {
      return { success: false, error: error.message }
    }
    throw error
  }

  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { companyName: true },
  })
  await notifyCompanyWorkerAssigned(
    jobId,
    workerUserId,
    job.title,
    company?.companyName || 'Your company',
  )

  return { success: true, assignmentId: assignment.id }
}

export async function reassignWorker(
  companyId: string,
  jobId: string,
  newWorkerUserId: string,
  actorUserId: string,
  actorRole: string,
  reason?: string
): Promise<AssignmentResult> {
  const actorMembership = await prisma.teamMember.findFirst({
    where: { companyId, userId: actorUserId, status: 'ACTIVE' },
    select: { role: true },
  })
  if (
    !actorMembership ||
    !isValidCompanyRole(actorMembership.role) ||
    actorMembership.role !== actorRole ||
    !hasCompanyPermission(actorMembership.role, 'workers:assign')
  ) {
    return { success: false, error: 'Actor is not authorized to reassign workers for this company' }
  }

  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { success: false, error: 'Job not found' }

  const eligibility = await checkWorkerEligibility(companyId, newWorkerUserId, jobId)
  if (!eligibility.eligible) {
    return { success: false, error: 'Worker not eligible', reasons: eligibility.reasons }
  }

  if (job.status === 'IN_PROGRESS') {
    return { success: false, error: 'Cannot reassign after work has started. Raise a dispute or contact support.' }
  }
  if (job.status !== 'QUOTE_ACCEPTED') {
    return { success: false, error: `Cannot reassign: job status is ${job.status}` }
  }

  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerId: companyId, providerType: 'COMPANY', status: 'ACCEPTED' },
  })
  if (!acceptedQuote) return { success: false, error: 'Job does not belong to this company' }

  const currentAssignment = await prisma.companyJobAssignment.findFirst({
    where: { jobId, companyId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
  })
  if (!currentAssignment) {
    return { success: false, error: 'No active worker assignment exists to reassign' }
  }
  if (currentAssignment.status === 'IN_PROGRESS') {
    return { success: false, error: 'Cannot reassign after the worker has started work' }
  }
  if (currentAssignment.workerUserId === newWorkerUserId) {
    return { success: false, error: 'This worker is already the active assignee for this job' }
  }

  const reusableAssignment = await prisma.companyJobAssignment.findUnique({
    where: { jobId_workerUserId: { jobId, workerUserId: newWorkerUserId } },
  })
  if (
    reusableAssignment &&
    !['REJECTED', 'REVOKED'].includes(reusableAssignment.status)
  ) {
    return { success: false, error: 'This worker already has a non-terminal assignment for this job' }
  }

  let assignment: { id: string }
  try {
    assignment = await prisma.$transaction(async (tx) => {
      await lockAndAssertWorkerScheduleAvailable(
        tx,
        newWorkerUserId,
        jobId,
        job.preferredDate,
        job.preferredTimeSlot,
      )

      const claimed = await tx.marketplaceJob.updateMany({
        where: {
          id: jobId,
          status: 'QUOTE_ACCEPTED',
          targetTaskerId: currentAssignment.workerUserId,
        },
        data: { targetTaskerId: newWorkerUserId },
      })
      if (claimed.count !== 1) throw new Error('Job target changed before reassignment')

      const revoked = await tx.companyJobAssignment.updateMany({
        where: {
          id: currentAssignment.id,
          companyId,
          workerUserId: currentAssignment.workerUserId,
          status: { in: ['ASSIGNED', 'ACCEPTED'] },
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedReason: reason || 'Reassigned to another worker',
        },
      })
      if (revoked.count !== 1) throw new Error('Assignment changed before reassignment')

      await writeCompanyAuditLog({
        companyId,
        actorId: actorUserId,
        actorRole,
        action: 'WORKER_ASSIGN',
        targetType: 'CompanyJobAssignment',
        targetId: currentAssignment.id,
        description: `Revoked assignment (worker ${currentAssignment.workerUserId}) from job ${jobId}`,
        metadata: { previousWorkerUserId: currentAssignment.workerUserId, reason },
      }, tx)
    }

    const newRecord = reusableAssignment
      ? await tx.companyJobAssignment.update({
          where: { id: reusableAssignment.id },
          data: {
            assignedBy: actorUserId,
            status: 'ASSIGNED',
            assignedAt: new Date(),
            acceptedAt: null,
            startedAt: null,
            completedAt: null,
            rejectedAt: null,
            revokedAt: null,
            revokedReason: null,
            rejectReason: null,
          },
        })
      : await tx.companyJobAssignment.create({
          data: {
            companyId,
            jobId,
            workerUserId: newWorkerUserId,
            assignedBy: actorUserId,
            status: 'ASSIGNED',
          },
        })

    await writeCompanyAuditLog({
      companyId,
      actorId: actorUserId,
      actorRole,
      action: 'WORKER_ASSIGN',
      targetType: 'CompanyJobAssignment',
      targetId: newRecord.id,
      description: `Reassigned worker to job ${jobId}`,
      metadata: { workerUserId: newWorkerUserId, jobId, assignmentId: newRecord.id },
    }, tx)

      return newRecord
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes('reassignment') ||
        error.message.includes('scheduling conflict') ||
        error.message === 'Worker account not found'
      )
    ) {
      return { success: false, error: error.message }
    }
    throw error
  }

  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { companyName: true },
  })
  await notifyCompanyWorkerAssigned(
    jobId,
    newWorkerUserId,
    job.title,
    company?.companyName || 'Your company',
  )

  return { success: true, assignmentId: assignment.id }
}

export async function workerAcceptAssignment(
  assignmentId: string,
  workerUserId: string,
): Promise<AssignmentResult> {
  const assignment = await prisma.companyJobAssignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) return { success: false, error: 'Assignment not found' }
  if (assignment.workerUserId !== workerUserId) return { success: false, error: 'Not your assignment' }
  if (assignment.status !== 'ASSIGNED') return { success: false, error: `Cannot accept: current status is ${assignment.status}` }

  const eligibility = await checkWorkerEligibility(assignment.companyId, workerUserId, assignment.jobId)
  if (!eligibility.eligible) {
    return { success: false, error: 'Worker is no longer eligible for this assignment', reasons: eligibility.reasons }
  }

  const claimed = await prisma.companyJobAssignment.updateMany({
    where: { id: assignmentId, workerUserId, status: 'ASSIGNED' },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  })
  if (claimed.count !== 1) {
    return { success: false, error: 'Assignment changed before it could be accepted' }
  }

  return { success: true, assignmentId }
}

export async function workerRejectAssignment(
  assignmentId: string,
  workerUserId: string,
  reason?: string,
): Promise<AssignmentResult> {
  const assignment = await prisma.companyJobAssignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) return { success: false, error: 'Assignment not found' }
  if (assignment.workerUserId !== workerUserId) return { success: false, error: 'Not your assignment' }
  if (assignment.status !== 'ASSIGNED') return { success: false, error: `Cannot reject: current status is ${assignment.status}` }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.companyJobAssignment.updateMany({
      where: { id: assignmentId, workerUserId, status: 'ASSIGNED' },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectReason: reason || undefined },
    })
    if (claimed.count !== 1) throw new Error('Assignment changed before it could be rejected')

    const targetRestored = await tx.marketplaceJob.updateMany({
      where: {
        id: assignment.jobId,
        status: 'QUOTE_ACCEPTED',
        targetTaskerId: workerUserId,
      },
      data: { targetTaskerId: assignment.companyId },
    })
    if (targetRestored.count !== 1) {
      throw new Error('Job target changed before assignment rejection')
    }

    await writeCompanyAuditLog({
      companyId: assignment.companyId,
      actorId: workerUserId,
      actorRole: 'WORKER',
      action: 'WORKER_ASSIGN',
      targetType: 'CompanyJobAssignment',
      targetId: assignmentId,
      description: `Worker rejected assignment for job ${assignment.jobId}`,
      metadata: { reason },
    }, tx)
  })

  return { success: true, assignmentId }
}

export async function revokeAssignment(
  assignmentId: string,
  companyId: string,
  actorUserId: string,
  actorRole: string,
  reason?: string,
): Promise<AssignmentResult> {
  const actorMembership = await prisma.teamMember.findFirst({
    where: { companyId, userId: actorUserId, status: 'ACTIVE' },
    select: { role: true },
  })
  if (
    !actorMembership ||
    !isValidCompanyRole(actorMembership.role) ||
    actorMembership.role !== actorRole ||
    !hasCompanyPermission(actorMembership.role, 'workers:assign')
  ) {
    return { success: false, error: 'Actor is not authorized to revoke assignments for this company' }
  }

  const assignment = await prisma.companyJobAssignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) return { success: false, error: 'Assignment not found' }
  if (assignment.companyId !== companyId) return { success: false, error: 'Assignment does not belong to this company' }
  if (assignment.status === 'IN_PROGRESS') {
    return { success: false, error: 'Cannot revoke an assignment after work has started. Raise a dispute or contact support.' }
  }
  if (!['ASSIGNED', 'ACCEPTED'].includes(assignment.status)) {
    return { success: false, error: `Cannot revoke: current status is ${assignment.status}` }
  }

  await prisma.$transaction(async (tx) => {
    await tx.companyJobAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason || undefined },
    })

    const targetRestored = await tx.marketplaceJob.updateMany({
      where: {
        id: assignment.jobId,
        status: 'QUOTE_ACCEPTED',
        targetTaskerId: assignment.workerUserId,
      },
      data: { targetTaskerId: companyId },
    })
    if (targetRestored.count !== 1) {
      throw new Error('Job target changed before assignment revocation')
    }

    await writeCompanyAuditLog({
      companyId,
      actorId: actorUserId,
      actorRole,
      action: 'WORKER_ASSIGN',
      targetType: 'CompanyJobAssignment',
      targetId: assignmentId,
      description: `Revoked assignment for job ${assignment.jobId}`,
      metadata: { workerUserId: assignment.workerUserId, reason },
    }, tx)
  })

  return { success: true, assignmentId }
}

export async function completeAssignment(
  assignmentId: string,
  companyId: string,
): Promise<AssignmentResult> {
  const assignment = await prisma.companyJobAssignment.findUnique({
    where: { id: assignmentId },
    include: { job: { select: { status: true } } },
  })
  if (!assignment) return { success: false, error: 'Assignment not found' }
  if (assignment.companyId !== companyId) return { success: false, error: 'Assignment does not belong to this company' }
  if (assignment.job.status !== 'COMPLETED') {
    return { success: false, error: 'Assignment completes only after the customer-approved job is completed' }
  }
  if (assignment.status === 'COMPLETED') return { success: true, assignmentId }
  if (assignment.status !== 'IN_PROGRESS') {
    return { success: false, error: `Cannot complete: current status is ${assignment.status}` }
  }

  await prisma.companyJobAssignment.updateMany({
    where: { id: assignmentId, companyId, status: 'IN_PROGRESS' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })

  return { success: true, assignmentId }
}

export async function listCompanyAssignments(
  companyId: string,
  options?: {
    status?: AssignmentStatus
    jobId?: string
    workerUserId?: string
    limit?: number
    offset?: number
  }
) {
  const where: Record<string, unknown> = { companyId }
  if (options?.status) where.status = options.status
  if (options?.jobId) where.jobId = options.jobId
  if (options?.workerUserId) where.workerUserId = options.workerUserId

  const [assignments, total] = await Promise.all([
    prisma.companyJobAssignment.findMany({
      where,
      include: {
        job: { select: { id: true, title: true, status: true, createdAt: true } },
        worker: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.companyJobAssignment.count({ where }),
  ])

  return { assignments, total }
}

export async function getWorkerActiveAssignments(workerUserId: string, companyId: string) {
  return prisma.companyJobAssignment.findMany({
    where: {
      workerUserId,
      companyId,
      status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
    },
    include: {
      job: { select: { id: true, title: true, status: true, preferredDate: true, preferredTimeSlot: true } },
    },
    orderBy: { assignedAt: 'desc' },
  })
}
