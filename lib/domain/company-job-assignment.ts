import { prisma, type PrismaClientOrTx } from '@/lib/prisma'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { emitSecurityEvent } from '@/lib/security/events'
import { notifyUser } from '@/lib/notifications'

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

export async function createAssignment(params: AssignmentCreateParams): Promise<AssignmentResult> {
  const { companyId, jobId, workerUserId, assignedByUserId, actorRole } = params

  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { success: false, error: 'Job not found' }
  if (job.status !== 'QUOTE_ACCEPTED') return { success: false, error: 'Job must be in QUOTE_ACCEPTED status' }

  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerId: companyId, providerType: 'COMPANY', status: 'ACCEPTED' },
  })
  if (!acceptedQuote) return { success: false, error: 'No accepted quote from this company on this job' }

  const existingAssignment = await prisma.companyJobAssignment.findFirst({
    where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
  })
  if (existingAssignment) {
    return { success: false, error: 'Job already has an active assignment. Revoke first.' }
  }

  const existingWorkerAssignment = await prisma.companyJobAssignment.findUnique({
    where: { jobId_workerUserId: { jobId, workerUserId } },
  })
  if (existingWorkerAssignment) {
    return { success: false, error: 'This worker is already assigned to this job' }
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const claimed = await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: 'QUOTE_ACCEPTED', targetTaskerId: null },
      data: { targetTaskerId: workerUserId },
    })
    if (claimed.count !== 1) throw new Error('Job state changed concurrently')

    await tx.jobWorkspace.upsert({
      where: { jobId },
      create: { jobId, progressStatus: 'ACCEPTED' },
      update: { progressStatus: 'ACCEPTED', updatedAt: new Date() },
    })

    const record = await tx.companyJobAssignment.create({
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

  await notifyUser({
    userId: workerUserId,
    title: 'New company job assignment',
    body: `You were assigned to "${job.title}". Open MaintainEX to review and accept it.`,
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'COMPANY_ASSIGNMENT', assignmentId: assignment.id, jobId },
    channelId: 'job-opportunities',
    priority: 'high',
  })

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
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { success: false, error: 'Job not found' }

  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerId: companyId, providerType: 'COMPANY', status: 'ACCEPTED' },
  })
  if (!acceptedQuote) return { success: false, error: 'Job does not belong to this company' }

  const currentAssignment = await prisma.companyJobAssignment.findFirst({
    where: { jobId, companyId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
  })

  const assignment = await prisma.$transaction(async (tx) => {
    if (currentAssignment) {
      await tx.companyJobAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedReason: reason || 'Reassigned to another worker',
        },
      })

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

    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: { in: ['QUOTE_ACCEPTED', 'IN_PROGRESS'] } },
      data: { targetTaskerId: newWorkerUserId },
    })

    const newRecord = await tx.companyJobAssignment.create({
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

  await notifyUser({
    userId: newWorkerUserId,
    title: 'Company job reassigned to you',
    body: `A company job has been reassigned to you. Open MaintainEX to review it.`,
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'COMPANY_ASSIGNMENT', assignmentId: assignment.id, jobId },
    channelId: 'job-opportunities',
    priority: 'high',
  })

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

  await prisma.companyJobAssignment.update({
    where: { id: assignmentId },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  })

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
    await tx.companyJobAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectReason: reason || undefined },
    })

    await tx.marketplaceJob.update({
      where: { id: assignment.jobId },
      data: { targetTaskerId: null },
    })

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
  const assignment = await prisma.companyJobAssignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) return { success: false, error: 'Assignment not found' }
  if (assignment.companyId !== companyId) return { success: false, error: 'Assignment does not belong to this company' }
  if (!['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    return { success: false, error: `Cannot revoke: current status is ${assignment.status}` }
  }

  await prisma.$transaction(async (tx) => {
    await tx.companyJobAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason || undefined },
    })

    await tx.marketplaceJob.update({
      where: { id: assignment.jobId },
      data: { targetTaskerId: null },
    })

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
  const assignment = await prisma.companyJobAssignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) return { success: false, error: 'Assignment not found' }
  if (assignment.companyId !== companyId) return { success: false, error: 'Assignment does not belong to this company' }
  if (assignment.status !== 'IN_PROGRESS') return { success: false, error: `Cannot complete: current status is ${assignment.status}` }

  await prisma.companyJobAssignment.update({
    where: { id: assignmentId },
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
      job: { select: { id: true, title: true, status: true, preferredDate: true, preferredTimeSlot: true, addressStreet: true } },
    },
    orderBy: { assignedAt: 'desc' },
  })
}
