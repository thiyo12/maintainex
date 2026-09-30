import { PrismaClient, Prisma } from '@prisma/client'

function serializeBigInt(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}

/**
 * Change order status machine.
 *
 * Valid transitions:
 *   DRAFT → SUBMITTED → APPROVED / REJECTED
 *   DRAFT → CANCELLED
 *   SUBMITTED → CANCELLED (by provider before customer decision)
 */
export type ChangeOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

const CHANGE_ORDER_TRANSITIONS: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  DRAFT:     ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:  [],
  REJECTED:  [],
  CANCELLED: [],
}

const TERMINAL_CO_STATUSES: ChangeOrderStatus[] = ['APPROVED', 'REJECTED', 'CANCELLED']

export function isValidChangeOrderTransition(from: ChangeOrderStatus, to: ChangeOrderStatus): boolean {
  return CHANGE_ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

export function isChangeOrderTerminal(status: ChangeOrderStatus): boolean {
  return TERMINAL_CO_STATUSES.includes(status)
}

export interface CreateChangeOrderInput {
  jobId: string
  baseQuoteId: string
  providerType: 'INDIVIDUAL' | 'COMPANY'
  taskerId?: string
  companyId?: string
  reason: string
  scopeDelta?: string
  amountDeltaCents: bigint
  currency?: string
  createdBy: string
  lineItems?: Array<{
    type: string
    description: string
    quantity?: number
    unit?: string
    unitAmountCents: bigint
    totalAmountCents: bigint
    currency?: string
    sortOrder?: number
  }>
}

export async function createChangeOrder(
  client: PrismaClient | Prisma.TransactionClient,
  input: CreateChangeOrderInput,
): Promise<{ success: boolean; changeOrderId?: string; error?: string }> {
  const job = await client.marketplaceJob.findUnique({ where: { id: input.jobId } })
  if (!job) return { success: false, error: 'Job not found' }
  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
    return { success: false, error: 'Cannot create change order on completed/cancelled job' }
  }
  if (input.amountDeltaCents === 0n && (!input.scopeDelta || input.scopeDelta.trim().length === 0)) {
    return { success: false, error: 'Change order must modify price or scope' }
  }

  // Verify base quote exists and is accepted
  const baseQuote = await client.jobQuote.findUnique({ where: { id: input.baseQuoteId } })
  if (!baseQuote) return { success: false, error: 'Base quote not found' }
  if (baseQuote.jobId !== input.jobId) return { success: false, error: 'Base quote does not belong to this job' }
  if (baseQuote.status !== 'ACCEPTED') return { success: false, error: 'Base quote must be ACCEPTED' }

  // Verify provider identity
  if (input.taskerId && input.companyId) {
    return { success: false, error: 'Cannot specify both taskerId and companyId' }
  }
  if (input.taskerId && input.taskerId !== input.createdBy) {
    return { success: false, error: 'taskerId must match createdBy' }
  }

  // Verify provider owns the base quote
  if (baseQuote.providerId !== input.createdBy && baseQuote.providerId !== (input.taskerId ?? input.companyId)) {
    return { success: false, error: 'Provider does not own the base quote' }
  }

  // Get next revision number
  const lastOrder = await client.jobChangeOrder.findFirst({
    where: { jobId: input.jobId },
    orderBy: { revisionNumber: 'desc' },
  })
  const revisionNumber = (lastOrder?.revisionNumber ?? 0) + 1

  const changeOrder = await client.jobChangeOrder.create({
    data: {
      jobId: input.jobId,
      baseQuoteId: input.baseQuoteId,
      providerType: input.providerType,
      taskerId: input.taskerId ?? null,
      companyId: input.companyId ?? null,
      reason: input.reason,
      scopeDelta: input.scopeDelta ?? null,
      amountDeltaCents: input.amountDeltaCents,
      currency: input.currency ?? 'LKR',
      status: 'DRAFT',
      createdBy: input.createdBy,
      revisionNumber,
    },
  })

  // Create line items
  if (input.lineItems && input.lineItems.length > 0) {
    await client.jobChangeOrderLineItem.createMany({
      data: input.lineItems.map((item, idx) => ({
        changeOrderId: changeOrder.id,
        type: item.type,
        description: item.description,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? null,
        unitAmountCents: item.unitAmountCents,
        totalAmountCents: item.totalAmountCents,
        currency: item.currency ?? 'LKR',
        sortOrder: item.sortOrder ?? idx,
      })),
    })
  }

  return { success: true, changeOrderId: changeOrder.id }
}

export interface TransitionChangeOrderInput {
  changeOrderId: string
  userId: string
  toStatus: ChangeOrderStatus
  rejectionReason?: string
}

export async function transitionChangeOrder(
  client: PrismaClient | Prisma.TransactionClient,
  input: TransitionChangeOrderInput,
): Promise<{ success: boolean; error?: string }> {
  const co = await client.jobChangeOrder.findUnique({ where: { id: input.changeOrderId } })
  if (!co) return { success: false, error: 'Change order not found' }

  const currentStatus = co.status as ChangeOrderStatus
  if (isChangeOrderTerminal(currentStatus)) {
    return { success: false, error: `Cannot transition from terminal status ${currentStatus}` }
  }

  if (!isValidChangeOrderTransition(currentStatus, input.toStatus)) {
    return { success: false, error: `Invalid transition from ${currentStatus} to ${input.toStatus}` }
  }

  // Verify authorization
  const job = await client.marketplaceJob.findUnique({ where: { id: co.jobId } })
  if (!job) return { success: false, error: 'Job not found' }

  // SUBMITTED: only provider who created it
  if (input.toStatus === 'SUBMITTED') {
    if (co.createdBy !== input.userId) {
      return { success: false, error: 'Only the creator can submit' }
    }
  }

  // APPROVED / REJECTED: only customer
  if (input.toStatus === 'APPROVED' || input.toStatus === 'REJECTED') {
    if (job.customerId !== input.userId) {
      return { success: false, error: 'Only the customer can approve/reject' }
    }
  }

  // CANCELLED: provider who created it, or customer
  if (input.toStatus === 'CANCELLED') {
    if (co.createdBy !== input.userId && job.customerId !== input.userId) {
      return { success: false, error: 'Only creator or customer can cancel' }
    }
  }

  const now = new Date()
  const updateData: Record<string, any> = { status: input.toStatus }

  if (input.toStatus === 'SUBMITTED') updateData.submittedAt = now
  if (input.toStatus === 'APPROVED') {
    updateData.customerDecisionAt = now
    updateData.approvedByCustomerId = input.userId
  }
  if (input.toStatus === 'REJECTED') {
    updateData.customerDecisionAt = now
    updateData.rejectedAt = now
    updateData.rejectionReason = input.rejectionReason ?? null
  }
  if (input.toStatus === 'CANCELLED') updateData.cancelledAt = now

  await client.jobChangeOrder.update({ where: { id: input.changeOrderId }, data: updateData })

  return { success: true }
}

async function checkIdempotency(
  client: PrismaClient | Prisma.TransactionClient,
  idempotencyKey: string,
  userId: string,
  operation: string,
): Promise<{ status: string; resultPayload?: string; requestFingerprint?: string } | null> {
  const record = await client.idempotencyRecord.findFirst({
    where: {
      idempotencyKey,
      userId,
      operation,
    },
  })
  if (!record) return null
  if (record.expiresAt < new Date()) return null
  return { status: record.status, resultPayload: record.resultPayload ?? undefined, requestFingerprint: record.requestFingerprint ?? undefined }
}

export async function approveChangeOrder(
  client: PrismaClient,
  changeOrderId: string,
  customerId: string,
  idempotencyKey?: string,
): Promise<{ success: boolean; changeOrder?: any; finalAuthorizedAmountCents?: bigint; error?: string }> {
  const co = await client.jobChangeOrder.findUnique({
    where: { id: changeOrderId },
    select: {
      id: true,
      status: true,
      jobId: true,
      amountDeltaCents: true,
      baseQuoteId: true,
      job: {
        select: {
          customerId: true,
          finalAuthorizedAmountCents: true,
        },
      },
    },
  })

  if (!co) return { success: false, error: 'Change order not found' }
  if (co.job.customerId !== customerId) return { success: false, error: 'NOT_CUSTOMER' }
  if (co.status !== 'SUBMITTED') return { success: false, error: 'INVALID_STATUS' }

  const requestFingerprint = `APPROVE:${changeOrderId}:${customerId}:${co.amountDeltaCents}:${co.baseQuoteId}`

  if (idempotencyKey) {
    const existing = await checkIdempotency(client, idempotencyKey, customerId, 'APPROVE_CHANGE_ORDER')
    if (existing) {
      if (existing.status === 'COMPLETED') {
        if (existing.requestFingerprint && existing.requestFingerprint !== requestFingerprint) {
          return { success: false, error: 'IDEMPOTENCY_CONFLICT' }
        }
        const result = JSON.parse(existing.resultPayload!)
        return { success: true, changeOrder: result.changeOrder, finalAuthorizedAmountCents: BigInt(result.finalAuthorizedAmountCents) }
      }
      if (existing.status === 'PENDING') {
        return { success: false, error: 'CONCURRENT_APPROVAL' }
      }
    }
  }

  try {
    const result = await client.$transaction(async (tx) => {
      const now = new Date()

      const transition = await tx.jobChangeOrder.updateMany({
        where: { id: changeOrderId, status: 'SUBMITTED' },
        data: {
          status: 'APPROVED',
          customerDecisionAt: now,
          approvedByCustomerId: customerId,
        },
      })
      if (transition.count !== 1) {
        throw new Error('CONCURRENT_APPROVAL')
      }

      const updatedCo = await tx.jobChangeOrder.findUnique({
        where: { id: changeOrderId },
      })
      if (!updatedCo) {
        throw new Error('Change order not found')
      }

      const finalResult = await calculateFinalAuthorizedAmount(tx, co.jobId)
      if (!finalResult.success) throw new Error(finalResult.error)
      const newFinalAmount = finalResult.finalAmountCents!
      if (newFinalAmount <= 0n) {
        throw new Error('FINAL_AUTHORIZED_AMOUNT_MUST_BE_POSITIVE')
      }

      await tx.marketplaceJob.update({
        where: { id: co.jobId },
        data: { finalAuthorizedAmountCents: newFinalAmount },
      })

      if (idempotencyKey) {
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)

        const existingRecord = await tx.idempotencyRecord.findFirst({
          where: { idempotencyKey, userId: customerId, operation: 'APPROVE_CHANGE_ORDER' },
        })

        if (existingRecord) {
          await tx.idempotencyRecord.update({
            where: { id: existingRecord.id },
            data: {
              status: 'COMPLETED',
              requestFingerprint,
              resultPayload: serializeBigInt({
                changeOrder: updatedCo,
                finalAuthorizedAmountCents: newFinalAmount,
              }),
            },
          })
        } else {
          await tx.idempotencyRecord.create({
            data: {
              idempotencyKey,
              userId: customerId,
              operation: 'APPROVE_CHANGE_ORDER',
              status: 'COMPLETED',
              resultPayload: serializeBigInt({
                changeOrder: updatedCo,
                finalAuthorizedAmountCents: newFinalAmount,
              }),
              requestFingerprint,
              expiresAt,
            },
          })
        }
      }

      return { changeOrder: updatedCo, finalAuthorizedAmountCents: newFinalAmount }
    })

    return {
      success: true,
      changeOrder: result.changeOrder,
      finalAuthorizedAmountCents: result.finalAuthorizedAmountCents,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      message === 'CONCURRENT_APPROVAL' ||
      message === 'FINAL_AUTHORIZED_AMOUNT_MUST_BE_POSITIVE' ||
      message === 'Change order not found'
    ) {
      return { success: false, error: message }
    }
    throw error
  }
}

export async function rejectChangeOrder(
  client: PrismaClient,
  changeOrderId: string,
  customerId: string,
): Promise<{ success: boolean; changeOrder?: any; error?: string }> {
  const co = await client.jobChangeOrder.findUnique({
    where: { id: changeOrderId },
    select: {
      id: true,
      status: true,
      job: { select: { customerId: true } },
    },
  })

  if (!co) return { success: false, error: 'Change order not found' }
  if (co.job.customerId !== customerId) return { success: false, error: 'NOT_CUSTOMER' }
  if (co.status !== 'SUBMITTED') return { success: false, error: 'INVALID_STATUS' }

  const updatedCo = await client.jobChangeOrder.update({
    where: { id: changeOrderId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
    },
  })

  return { success: true, changeOrder: updatedCo }
}

export async function cancelChangeOrder(
  client: PrismaClient,
  changeOrderId: string,
  userId: string,
): Promise<{ success: boolean; changeOrder?: any; error?: string }> {
  const co = await client.jobChangeOrder.findUnique({
    where: { id: changeOrderId },
    select: {
      id: true,
      jobId: true,
      status: true,
      createdBy: true,
      job: { select: { customerId: true } },
    },
  })

  if (!co) return { success: false, error: 'Change order not found' }

  const isCustomer = co.job.customerId === userId
  const isCreator = co.createdBy === userId

  // Check if user is the provider via the accepted quote
  const acceptedQuote = await client.jobQuote.findFirst({
    where: { jobId: co.jobId, status: 'ACCEPTED' },
    select: { providerId: true },
  })
  const isProvider = acceptedQuote?.providerId === userId

  if (!isCustomer && !isCreator && !isProvider) return { success: false, error: 'NOT_AUTHORIZED' }

  if (co.status !== 'DRAFT' && co.status !== 'SUBMITTED') {
    return { success: false, error: 'INVALID_STATUS' }
  }

  const updatedCo = await client.jobChangeOrder.update({
    where: { id: changeOrderId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  })

  return { success: true, changeOrder: updatedCo }
}

/**
 * Calculate the final authorized amount for a job.
 * Only APPROVED change orders count.
 * SUBMITTED, REJECTED, CANCELLED do not affect the authorized amount.
 */
export async function calculateFinalAuthorizedAmount(
  client: PrismaClient | Prisma.TransactionClient,
  jobId: string,
): Promise<{ success: boolean; baseAmountCents?: bigint; changeOrderDeltaCents?: bigint; finalAmountCents?: bigint; error?: string }> {
  const job = await client.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { success: false, error: 'Job not found' }

  if (!job.approvedQuoteId) {
    return { success: false, error: 'Job has no approved quote' }
  }

  const approvedQuote = await client.jobQuote.findUnique({ where: { id: job.approvedQuoteId } })
  if (!approvedQuote) return { success: false, error: 'Approved quote not found' }

  const baseAmountCents = approvedQuote.totalCents ?? approvedQuote.price

  // Sum APPROVED change order deltas
  const approvedOrders = await client.jobChangeOrder.findMany({
    where: { jobId, status: 'APPROVED' },
  })

  const changeOrderDeltaCents = approvedOrders.reduce(
    (sum, co) => sum + co.amountDeltaCents,
    0n,
  )

  const finalAmountCents = baseAmountCents + changeOrderDeltaCents

  return { success: true, baseAmountCents, changeOrderDeltaCents, finalAmountCents }
}
