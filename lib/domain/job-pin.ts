import crypto from 'crypto'
import { prisma, type PrismaClientOrTx } from '../prisma'
import { hashPassword, verifyPassword } from '../security/password'
import { emitSecurityEvent } from '../security/events'

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

  const existingActive = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
  })
  if (existingActive) throw new Error('An active PIN already exists. Rotate instead.')

  const pin = generatePin()
  const pinHash = await hashPassword(pin)

  const record = await prisma.jobVerificationPin.create({
    data: {
      jobId,
      customerId,
      pinHash,
      status: 'ACTIVE',
      version: 1,
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

  const currentActive = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
  })

  const nextVersion = currentActive ? currentActive.version + 1 : 1

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
      data: updateData,
    })

    // 9. Execute canonical lifecycle transition for WORK_START (within same transaction)
    if (purpose === 'WORK_START') {
      const workspace = await tx.jobWorkspace.findUnique({ where: { jobId } })
      if (workspace && workspace.progressStatus === 'ACCEPTED') {
        await tx.jobWorkspace.updateMany({
          where: { jobId, progressStatus: 'ACCEPTED' },
          data: { progressStatus: 'IN_PROGRESS', updatedAt: now },
        })
      }

      await tx.companyJobAssignment.updateMany({
        where: {
          jobId,
          status: 'ACCEPTED',
        },
        data: { status: 'IN_PROGRESS', startedAt: now },
      })
    }

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
  customerId: string
): Promise<PinState> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== customerId) throw new Error('Only the job owner can view PIN state')

  const activePin = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
  })

  if (!activePin) {
    return { hasActivePin: false, version: null, locked: false, lastSuccessfulUseAt: null }
  }

  const locked = activePin.lockedUntil != null && activePin.lockedUntil > new Date()

  return {
    hasActivePin: true,
    version: activePin.version,
    locked,
    lastSuccessfulUseAt: activePin.lastSuccessfulUseAt,
  }
}

async function resolvePinVerifierTx(
  tx: PrismaClientOrTx,
  jobId: string,
  userId: string
): Promise<'INDIVIDUAL' | 'COMPANY' | 'ASSIGNED_WORKER' | null> {
  const acceptedQuote = await tx.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!acceptedQuote) return null

  if (acceptedQuote.providerType === 'INDIVIDUAL' && acceptedQuote.providerId === userId) {
    return 'INDIVIDUAL'
  }

  if (acceptedQuote.providerType === 'COMPANY') {
    const companyProfile = await tx.companyProfile.findFirst({
      where: { userId, id: acceptedQuote.providerId },
      select: { id: true },
    })
    if (companyProfile) return 'COMPANY'

    const assignment = await tx.companyJobAssignment.findFirst({
      where: {
        jobId,
        workerUserId: userId,
        companyId: acceptedQuote.providerId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
      select: { id: true },
    })
    if (assignment) return 'ASSIGNED_WORKER'
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

  switch (purpose) {
    case 'ARRIVAL':
      return job.status === 'QUOTE_ACCEPTED' || job.status === 'IN_PROGRESS'

    case 'WORK_START': {
      if (job.status !== 'IN_PROGRESS') return false
      if (workspace?.progressStatus !== 'ACCEPTED') return false

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
