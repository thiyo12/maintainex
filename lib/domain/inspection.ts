import { PrismaClient, Prisma } from '@prisma/client'

/**
 * Inspection status machine for INSPECTION_FIRST jobs.
 *
 * Valid transitions:
 *   REQUESTED → SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED
 *   REQUESTED → CANCELLED
 *   SCHEDULED → CANCELLED
 *   EN_ROUTE → NO_SHOW
 *   IN_PROGRESS → DISPUTED
 *   Any non-terminal → CANCELLED (by customer)
 */
export type InspectionStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'DISPUTED'

const INSPECTION_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  REQUESTED:   ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:   ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE:    ['ARRIVED', 'NO_SHOW'],
  ARRIVED:     ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
  DISPUTED:    [],
}

const TERMINAL_STATUSES: InspectionStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']

export function isValidInspectionTransition(from: InspectionStatus, to: InspectionStatus): boolean {
  return INSPECTION_TRANSITIONS[from]?.includes(to) ?? false
}

export function isInspectionTerminal(status: InspectionStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export interface CreateInspectionInput {
  jobId: string
  providerType: 'INDIVIDUAL' | 'COMPANY'
  taskerId?: string
  companyId?: string
  inspectionFeeCents?: bigint
  currency?: string
}

export async function createInspection(
  client: PrismaClient | Prisma.TransactionClient,
  input: CreateInspectionInput,
): Promise<{ success: boolean; inspectionId?: string; error?: string }> {
  const job = await client.marketplaceJob.findUnique({ where: { id: input.jobId } })
  if (!job) return { success: false, error: 'Job not found' }
  if (!job.requiresInspection) return { success: false, error: 'Job does not require inspection' }

  // Verify exactly one provider target
  if (input.taskerId && input.companyId) {
    return { success: false, error: 'Cannot specify both taskerId and companyId' }
  }
  if (!input.taskerId && !input.companyId) {
    return { success: false, error: 'Must specify either taskerId or companyId' }
  }

  // Check for existing active inspection
  const existing = await client.jobInspection.findFirst({
    where: { jobId: input.jobId, status: { notIn: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
  })
  if (existing) {
    return { success: false, error: 'Job already has an active inspection' }
  }

  const inspection = await client.jobInspection.create({
    data: {
      jobId: input.jobId,
      providerType: input.providerType,
      taskerId: input.taskerId ?? null,
      companyId: input.companyId ?? null,
      inspectionFeeCents: input.inspectionFeeCents ?? null,
      currency: input.currency ?? 'LKR',
      status: 'REQUESTED',
    },
  })

  return { success: true, inspectionId: inspection.id }
}

export async function verifyInspectionArrival(
  client: PrismaClient | Prisma.TransactionClient,
  inspectionId: string,
  customerId: string,
): Promise<{ success: true; inspection: any }> {
  const inspection = await client.jobInspection.findUnique({
    where: { id: inspectionId },
    select: {
      id: true,
      status: true,
      job: { select: { customerId: true } },
    },
  })

  if (!inspection) throw new Error('NOT_FOUND')
  if (inspection.job.customerId !== customerId) throw new Error('NOT_CUSTOMER')
  if (inspection.status !== 'ARRIVED') throw new Error('INVALID_STATUS')

  const updated = await client.jobInspection.update({
    where: { id: inspectionId },
    data: { verifiedByCustomer: true, verifiedAt: new Date() },
  })

  return { success: true, inspection: updated }
}

export interface TransitionInspectionInput {
  inspectionId: string
  userId: string
  toStatus: InspectionStatus
  notes?: string
}

export async function transitionInspection(
  client: PrismaClient | Prisma.TransactionClient,
  input: TransitionInspectionInput,
): Promise<{ success: boolean; error?: string }> {
  const inspection = await client.jobInspection.findUnique({ where: { id: input.inspectionId } })
  if (!inspection) return { success: false, error: 'Inspection not found' }

  const currentStatus = inspection.status as InspectionStatus
  if (isInspectionTerminal(currentStatus)) {
    return { success: false, error: `Cannot transition from terminal status ${currentStatus}` }
  }

  if (!isValidInspectionTransition(currentStatus, input.toStatus)) {
    return { success: false, error: `Invalid transition from ${currentStatus} to ${input.toStatus}` }
  }

  // Verify provider identity for provider-only transitions
  const isProviderTransition = ['EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(input.toStatus)
  if (isProviderTransition) {
    if (inspection.taskerId && inspection.taskerId !== input.userId) {
      return { success: false, error: 'Not the assigned provider' }
    }
    if (inspection.companyId && inspection.companyId !== input.userId) {
      return { success: false, error: 'Not the assigned company' }
    }
  }

  // Verify customer identity for customer-only transitions
  const isCustomerTransition = ['CANCELLED'].includes(input.toStatus)
  if (isCustomerTransition) {
    const job = await client.marketplaceJob.findUnique({ where: { id: inspection.jobId } })
    if (!job || job.customerId !== input.userId) {
      return { success: false, error: 'Not the job customer' }
    }
  }

  const now = new Date()
  const updateData: Record<string, any> = { status: input.toStatus }

  // Set timestamps based on transition
  if (input.toStatus === 'ARRIVED') {
    updateData.arrivedAt = now
    updateData.verifiedByCustomer = false
    updateData.verifiedAt = null
  }
  if (input.toStatus === 'IN_PROGRESS') updateData.startedAt = now
  if (input.toStatus === 'COMPLETED') updateData.completedAt = now
  if (input.toStatus === 'NO_SHOW') updateData.completedAt = now

  // Store notes
  if (input.notes) {
    if (input.toStatus === 'COMPLETED' || input.toStatus === 'IN_PROGRESS') {
      updateData.providerNotes = input.notes
    } else if (input.toStatus === 'CANCELLED') {
      updateData.customerNotes = input.notes
    }
  }

  await client.jobInspection.update({ where: { id: input.inspectionId }, data: updateData })

  return { success: true }
}

export interface CompleteInspectionInput {
  inspectionId: string
  providerId: string
  diagnosisSummary: string
  scopeSummary: string
  materialsSummary?: string
  estimatedDuration?: string
  risksAndLimitations?: string
}

export async function completeInspection(
  client: PrismaClient | Prisma.TransactionClient,
  input: CompleteInspectionInput,
): Promise<{ success: boolean; error?: string }> {
  const inspection = await client.jobInspection.findUnique({ where: { id: input.inspectionId } })
  if (!inspection) return { success: false, error: 'Inspection not found' }
  if (inspection.status !== 'IN_PROGRESS') {
    return { success: false, error: `Inspection must be IN_PROGRESS to complete, current: ${inspection.status}` }
  }

  // Verify provider
  if (inspection.taskerId && inspection.taskerId !== input.providerId) {
    return { success: false, error: 'Not the assigned provider' }
  }
  if (inspection.companyId && inspection.companyId !== input.providerId) {
    return { success: false, error: 'Not the assigned company' }
  }

  await client.jobInspection.update({
    where: { id: input.inspectionId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      diagnosisSummary: input.diagnosisSummary,
      scopeSummary: input.scopeSummary,
      materialsSummary: input.materialsSummary ?? null,
      estimatedDuration: input.estimatedDuration ?? null,
      risksAndLimitations: input.risksAndLimitations ?? null,
    },
  })

  return { success: true }
}

export interface ScheduleInspectionInput {
  inspectionId: string
  userId: string
  scheduledAt: Date
  windowStart?: string
  windowEnd?: string
}

export async function scheduleInspection(
  client: PrismaClient | Prisma.TransactionClient,
  input: ScheduleInspectionInput,
): Promise<{ success: boolean; error?: string }> {
  const inspection = await client.jobInspection.findUnique({ where: { id: input.inspectionId } })
  if (!inspection) return { success: false, error: 'Inspection not found' }
  if (inspection.status !== 'REQUESTED') {
    return { success: false, error: `Inspection must be REQUESTED to schedule, current: ${inspection.status}` }
  }

  await client.jobInspection.update({
    where: { id: input.inspectionId },
    data: {
      status: 'SCHEDULED',
      scheduledAt: input.scheduledAt,
      scheduledWindowStart: input.windowStart ?? null,
      scheduledWindowEnd: input.windowEnd ?? null,
    },
  })

  return { success: true }
}
