import crypto from 'crypto'
import { prisma, type PrismaClientOrTx } from '../prisma'
import { hashPassword, verifyPassword } from '../security/password'
import { emitSecurityEvent } from '../security/events'
import { recordJobLifecycleEvent } from './job-lifecycle-audit'

const PIN_LENGTH = 6
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export interface PinGenerateResult {
  pin: string
  jobId: string
  version: number
}

export interface PinVerifyResult {
  valid: boolean
  error?: string
  locked?: boolean
}

export interface PinState {
  hasActivePin: boolean
  version: number | null
  locked: boolean
  lastSuccessfulUseAt: Date | null
  arrivalVerifiedAt: Date | null
  workStartVerifiedAt: Date | null
  completionVerifiedAt: Date | null
}

function generatePin(): string {
  const min = Math.pow(10, PIN_LENGTH - 1)
  const max = Math.pow(10, PIN_LENGTH) - 1
  return String(crypto.randomInt(min, max + 1))
}

export async function generateJobPin(
  jobId: string,
  customerId: string
): Promise<PinGenerateResult> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== customerId) throw new Error('Only the job owner can generate a PIN')
  if (!['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)) {
    throw new Error('PIN is only available for an accepted active booking')
  }
  const paymentReady = await prisma.jobEscrow.findFirst({
    where: { jobId, status: { in: ['PROTECTED', 'CASH_CONFIRMED'] } },
    select: { id: true, paymentMethod: true },
  })
  if (!paymentReady) throw new Error('Payment method must be confirmed before generating a PIN')

  const existingActive = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
  })
  if (existingActive) throw new Error('An active PIN already exists. Rotate instead.')

  const pin = generatePin()
  const pinHash = await hashPassword(pin)

  const lastPin = await prisma.jobVerificationPin.findFirst({
    where: { jobId },
    orderBy: { version: 'desc' },
    select: {
      version: true,
      arrivalVerifiedAt: true,
      workStartVerifiedAt: true,
      completionVerifiedAt: true,
    },
  })
  const nextVersion = (lastPin?.version ?? 0) + 1

  const record = await prisma.jobVerificationPin.create({
    data: {
      jobId,
      customerId,
      pinHash,
      status: 'ACTIVE',
      version: nextVersion,
      arrivalVerifiedAt: lastPin?.arrivalVerifiedAt ?? null,
      workStartVerifiedAt: lastPin?.workStartVerifiedAt ?? null,
      completionVerifiedAt: lastPin?.completionVerifiedAt ?? null,
    },
  })

  emitSecurityEvent({
    type: 'job_pin_generated',
    actorId: customerId,
    actorType: 'user',
    details: { jobId, pinVersion: record.version },
  })

  return { pin, jobId, version: record.version }
}

export async function rotateJobPin(
  jobId: string,
  customerId: string
): Promise<PinGenerateResult> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== customerId) throw new Error('Only the job owner can rotate a PIN')
  if (!['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)) {
    throw new Error('PIN is only available for an accepted active booking')
  }
  const paymentReady = await prisma.jobEscrow.findFirst({
    where: { jobId, status: { in: ['PROTECTED', 'CASH_CONFIRMED'] } },
    select: { id: true, paymentMethod: true },
  })
  if (!paymentReady) throw new Error('Payment method must be confirmed before rotating a PIN')

  const currentActive = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
  })
  const latestPin = currentActive ?? await prisma.jobVerificationPin.findFirst({
    where: { jobId },
    orderBy: { version: 'desc' },
  })

  const nextVersion = (latestPin?.version ?? 0) + 1

  const pin = generatePin()
  const pinHash = await hashPassword(pin)

  await prisma.$transaction(async (tx) => {
    if (currentActive) {
      await tx.jobVerificationPin.update({
        where: { id: currentActive.id },
        data: { status: 'ROTATED', rotatedAt: new Date() },
      })
    }

    await tx.jobVerificationPin.create({
      data: {
        jobId,
        customerId,
        pinHash,
        status: 'ACTIVE',
        version: nextVersion,
        arrivalVerifiedAt: latestPin?.arrivalVerifiedAt ?? null,
        workStartVerifiedAt: latestPin?.workStartVerifiedAt ?? null,
        completionVerifiedAt: latestPin?.completionVerifiedAt ?? null,
      },
    })
  })

  emitSecurityEvent({
    type: 'job_pin_rotated',
    actorId: customerId,
    actorType: 'user',
    details: { jobId, previousVersion: currentActive?.version ?? 0, newVersion: nextVersion },
  })

  return { pin, jobId, version: nextVersion }
}

export async function revokeJobPin(
  jobId: string,
  customerId: string
): Promise<{ success: boolean }> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== customerId) throw new Error('Only the job owner can revoke a PIN')

  const currentActive = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
  })

  if (currentActive) {
    await prisma.jobVerificationPin.update({
      where: { id: currentActive.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
  }

  emitSecurityEvent({
    type: 'job_pin_revoked',
    actorId: customerId,
    actorType: 'user',
    details: { jobId, pinVersion: currentActive?.version ?? 0 },
  })

  return { success: true }
}

export async function verifyJobPin(
  jobId: string,
  actorId: string,
  pin: string,
  purpose: 'ARRIVAL' | 'WORK_START' | 'COMPLETION'
): Promise<PinVerifyResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Read job within transaction for consistency
    const job = await tx.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return { valid: false, error: 'Job not found' }

    // 2. Resolve verifier (authorization before PIN comparison)
    const verifierType = await resolvePinVerifierTx(tx, jobId, actorId)
    if (!verifierType) return { valid: false, error: 'Not authorized to verify PIN' }

    // 3. Lock the ACTIVE PIN row with SELECT ... FOR UPDATE
    const pins = await tx.$queryRaw<{
      id: string
      jobId: string
      customerId: string
      pinHash: string
      status: string
      version: number
      failedAttempts: number
      lockedUntil: Date | null
      lastSuccessfulUseAt: Date | null
      arrivalVerifiedAt: Date | null
      workStartVerifiedAt: Date | null
      completionVerifiedAt: Date | null
    }[]>`
      SELECT * FROM "JobVerificationPin"
      WHERE "jobId" = ${jobId} AND "status" = 'ACTIVE'
      ORDER BY "version" DESC
      LIMIT 1
      FOR UPDATE
    `
    const pinRecord = pins[0]
    if (!pinRecord) return { valid: false, error: 'No active PIN for this job' }

    // 4. Check lockout
    if (pinRecord.lockedUntil && pinRecord.lockedUntil > new Date()) {
      emitSecurityEvent({
        type: 'job_pin_verify_failure',
        actorId,
        actorType: 'user',
        details: { jobId, reason: 'locked', pinVersion: pinRecord.version },
      })
      return { valid: false, error: 'PIN is temporarily locked', locked: true }
    }

    // 5. Validate lifecycle state for this purpose
    const purposeValid = await validatePurposeTx(tx, jobId, purpose)
    if (!purposeValid) return { valid: false, error: `Cannot verify PIN for ${purpose} in current job state` }

    // 6. Check if purpose already consumed (atomic per-purpose guard)
    const purposeField =
      purpose === 'ARRIVAL' ? 'arrivalVerifiedAt'
      : purpose === 'WORK_START' ? 'workStartVerifiedAt'
      : 'completionVerifiedAt'

    if (pinRecord[purposeField] !== null) {
      emitSecurityEvent({
        type: 'job_pin_verify_failure',
        actorId,
        actorType: 'user',
        details: { jobId, reason: 'already_verified', pinVersion: pinRecord.version, purpose },
      })
      return { valid: false, error: `PIN already verified for ${purpose}` }
    }

    // 7. Verify PIN hash
    const pinValid = await verifyPassword(pin, pinRecord.pinHash)
    if (!pinValid) {
      // Atomic increment: read from locked row, increment, write back
      const newAttempts = pinRecord.failedAttempts + 1
      const lockUntil = newAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null

      await tx.jobVerificationPin.update({
        where: { id: pinRecord.id },
        data: {
          failedAttempts: newAttempts,
          lockedUntil: lockUntil,
        },
      })

      emitSecurityEvent({
        type: 'job_pin_verify_failure',
        actorId,
        actorType: 'user',
        details: {
          jobId,
          reason: 'wrong_pin',
          pinVersion: pinRecord.version,
          failedAttempts: newAttempts,
          locked: lockUntil !== null,
        },
      })

      if (lockUntil) {
        emitSecurityEvent({
          type: 'job_pin_lockout',
          actorId,
          actorType: 'user',
          details: { jobId, pinVersion: pinRecord.version, lockMinutes: LOCKOUT_MINUTES },
        })
      }

      return { valid: false, error: 'Incorrect PIN', locked: lockUntil !== null }
    }

    // 8. Valid PIN: mark purpose consumed + canonical lifecycle transition (atomic)
    const now = new Date()
    const updateData: Record<string, unknown> = {
      failedAttempts: 0,
      lockedUntil: null,
      lastSuccessfulUseAt: now,
    }
    updateData[purposeField] = now

    await tx.jobVerificationPin.update({
      where: { id: pinRecord.id },
      data: {
        ...updateData,
        status: 'CONSUMED',
      },
    })

    // 9. Execute the single canonical WORK_START transition atomically.
    // Payment only protects escrow; work does not begin until this PIN succeeds.
    if (purpose === 'WORK_START') {
      const jobClaimed = await tx.marketplaceJob.updateMany({
        where: { id: jobId, status: 'QUOTE_ACCEPTED' },
        data: { status: 'IN_PROGRESS' },
      })
      if (jobClaimed.count !== 1) {
        throw new Error('Job state changed before work start')
      }

      const workspaceClaimed = await tx.jobWorkspace.updateMany({
        where: { jobId, progressStatus: 'ACCEPTED' },
        data: { progressStatus: 'IN_PROGRESS', updatedAt: now },
      })
      if (workspaceClaimed.count !== 1) {
        throw new Error('Workspace state changed before work start')
      }

      if (verifierType === 'COMPANY' || verifierType === 'ASSIGNED_WORKER') {
        const assignmentClaimed = await tx.companyJobAssignment.updateMany({
          where: {
            jobId,
            workerUserId: actorId,
            status: 'ACCEPTED',
          },
          data: { status: 'IN_PROGRESS', startedAt: now },
        })
        if (assignmentClaimed.count !== 1) {
          throw new Error('Only the accepted assigned company worker can start work')
        }
      }
    }

    await recordJobLifecycleEvent(tx, {
      jobId,
      actorId,
      actorType: verifierType,
      action:
        purpose === 'ARRIVAL'
          ? 'ARRIVAL_VERIFIED'
          : purpose === 'WORK_START'
            ? 'WORK_STARTED'
            : 'COMPLETION_PIN_VERIFIED',
      fromState: purpose === 'WORK_START' ? 'QUOTE_ACCEPTED' : null,
      toState: purpose === 'WORK_START' ? 'IN_PROGRESS' : null,
      metadata: { purpose, pinVersion: pinRecord.version },
    })

    // 10. Emit security events
    const eventType = purpose === 'ARRIVAL' ? 'job_pin_arrival_verified'
      : purpose === 'WORK_START' ? 'job_pin_work_start_verified'
      : 'job_pin_completion_verified'

    emitSecurityEvent({
      type: eventType,
      actorId,
      actorType: 'user',
      details: { jobId, purpose, pinVersion: pinRecord.version, verifierType },
    })

    emitSecurityEvent({
      type: 'job_pin_verify_success',
      actorId,
      actorType: 'user',
      details: { jobId, purpose, pinVersion: pinRecord.version },
    })

    return { valid: true }
  })
}

export async function getPinState(
  jobId: string,
  actorId: string
): Promise<PinState> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')

  const isCustomer = job.customerId === actorId
  const verifierType = isCustomer ? null : await resolvePinVerifierTx(prisma, jobId, actorId)
  if (!isCustomer && !verifierType) {
    throw new Error('Not authorized to view PIN state')
  }

  const activePin = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
  })
  const latestPin = activePin ?? await prisma.jobVerificationPin.findFirst({
    where: { jobId },
    orderBy: { version: 'desc' },
  })

  if (!latestPin) {
    return {
      hasActivePin: false,
      version: null,
      locked: false,
      lastSuccessfulUseAt: null,
      arrivalVerifiedAt: null,
      workStartVerifiedAt: null,
      completionVerifiedAt: null,
    }
  }

  const locked = activePin?.lockedUntil != null && activePin.lockedUntil > new Date()

  return {
    hasActivePin: !!activePin,
    version: latestPin.version,
    locked,
    lastSuccessfulUseAt: latestPin.lastSuccessfulUseAt,
    arrivalVerifiedAt: latestPin.arrivalVerifiedAt,
    workStartVerifiedAt: latestPin.workStartVerifiedAt,
    completionVerifiedAt: latestPin.completionVerifiedAt,
  }
}

async function resolvePinVerifierTx(
  tx: PrismaClientOrTx,
  jobId: string,
  userId: string
): Promise<'INDIVIDUAL' | 'COMPANY' | 'ASSIGNED_WORKER' | null> {
  const actor = await tx.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      isSuspended: true,
      isBanned: true,
      identityStatus: true,
    },
  })
  if (
    !actor ||
    !actor.isActive ||
    actor.isSuspended ||
    actor.isBanned ||
    actor.identityStatus !== 'VERIFIED'
  ) {
    return null
  }

  const acceptedQuote = await tx.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!acceptedQuote) return null

  if (acceptedQuote.providerType === 'INDIVIDUAL' && acceptedQuote.providerId === userId) {
    return 'INDIVIDUAL'
  }

  if (acceptedQuote.providerType === 'COMPANY') {
    const [assignment, membership] = await Promise.all([
      tx.companyJobAssignment.findFirst({
        where: {
          jobId,
          workerUserId: userId,
          companyId: acceptedQuote.providerId,
          status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
        },
        select: { id: true },
      }),
      tx.teamMember.findFirst({
        where: {
          companyId: acceptedQuote.providerId,
          userId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ])
    if (!assignment || !membership) return null

    const companyProfile = await tx.companyProfile.findFirst({
      where: { userId, id: acceptedQuote.providerId },
      select: { id: true },
    })
    return companyProfile ? 'COMPANY' : 'ASSIGNED_WORKER'
  }

  return null
}

async function validatePurposeTx(
  tx: PrismaClientOrTx,
  jobId: string,
  purpose: 'ARRIVAL' | 'WORK_START' | 'COMPLETION'
): Promise<boolean> {
  const job = await tx.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return false

  const workspace = await tx.jobWorkspace.findUnique({ where: { jobId } })
  const paymentReady = await tx.jobEscrow.findFirst({
    where: { jobId, status: { in: ['PROTECTED', 'CASH_CONFIRMED'] } },
    select: { id: true, paymentMethod: true },
  })

  switch (purpose) {
    case 'ARRIVAL':
      return job.status === 'QUOTE_ACCEPTED' &&
        workspace?.progressStatus === 'ACCEPTED' &&
        !!paymentReady

    case 'WORK_START': {
      if (job.status !== 'QUOTE_ACCEPTED') return false
      if (workspace?.progressStatus !== 'ACCEPTED') return false
      if (!paymentReady) return false

      const activePin = await tx.jobVerificationPin.findFirst({
        where: { jobId, status: 'ACTIVE' },
        orderBy: { version: 'desc' },
        select: { arrivalVerifiedAt: true },
      })
      if (!activePin?.arrivalVerifiedAt) return false

      if (job.requiresInspection) {
        const inspection = await tx.jobInspection.findFirst({
          where: { jobId, status: 'COMPLETED' },
        })
        if (!inspection) return false
        if (!inspection.verifiedByCustomer) return false
      }
      if (!job.approvedQuoteId) return false
      return true
    }

    case 'COMPLETION':
      return job.status === 'IN_PROGRESS' && workspace?.progressStatus === 'COMPLETION_REQUESTED'

    default:
      return false
  }
}
