import { prisma } from '@/lib/prisma'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { requireJobMarket } from '@/lib/geography/market-engine'

export const MAX_CREW_PREVIEW_WORKERS = 12

export class CrewReadinessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'CrewReadinessError'
  }
}

export interface CrewCandidateReadiness {
  workerUserId: string
  eligible: boolean
  reasons: string[]
}

export interface CrewReadinessReport {
  previewOnly: true
  dispatchEnabled: false
  companyId: string
  jobId: string
  requiredWorkersCount: number
  selectedWorkersCount: number
  preflightReady: boolean
  blockers: string[]
  workers: CrewCandidateReadiness[]
}

/**
 * Non-mutating crew capacity preview. Real crew dispatch is intentionally
 * disabled until a versioned crew model, all-worker acceptance, identity,
 * schedule locks and lifecycle/PIN barriers are implemented.
 *
 * This is a point-in-time estimate, not an assignment reservation. Every
 * check must be repeated under transaction locks when dispatch is built.
 */
export async function previewCompanyCrewReadiness(input: {
  companyId: string
  jobId: string
  workerUserIds: string[]
}): Promise<CrewReadinessReport> {
  const { companyId, jobId, workerUserIds } = input

  if (!Array.isArray(workerUserIds) ||
      workerUserIds.length > MAX_CREW_PREVIEW_WORKERS ||
      workerUserIds.some(id => typeof id !== 'string' || id.length === 0 ||
        id.length > 128 || id !== id.trim()) ||
      new Set(workerUserIds).size !== workerUserIds.length) {
    throw new CrewReadinessError('Worker list must contain unique, valid worker IDs', 400)
  }

  // Check the accepted quote *before* retrieving a booking, so an authorized
  // manager cannot probe unrelated customer jobs through this preview API.
  const quote = await prisma.jobQuote.findFirst({
    where: {
      jobId, providerId: companyId, providerType: 'COMPANY', status: 'ACCEPTED',
    },
    select: { id: true },
  })
  if (!quote) throw new CrewReadinessError('Accepted company booking not found', 404)

  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { status: true, workersCount: true, countryCode: true, latitude: true, longitude: true },
  })
  if (!job) throw new CrewReadinessError('Accepted company booking not found', 404)
  if (job.status !== 'QUOTE_ACCEPTED') {
    throw new CrewReadinessError('Booking is not awaiting workforce assignment', 409)
  }
  if (!Number.isSafeInteger(job.workersCount) || job.workersCount < 2) {
    throw new CrewReadinessError('Crew readiness is only available for multi-worker bookings', 409)
  }
  if (job.workersCount > MAX_CREW_PREVIEW_WORKERS) {
    throw new CrewReadinessError('Booking exceeds the supported crew-preview size', 409)
  }

  const activeAssignment = await prisma.companyJobAssignment.findFirst({
    where: {
      jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
    },
    select: { id: true },
  })

  // A roster cannot be considered preflight-ready if the quote's company has
  // since lost verification, its active owner, subscription or market authority.
  // These are point-in-time checks, not authorization to dispatch; dispatch
  // must repeat them under locks before any future crew roster is persisted.
  const [companyEligibility, companyMarket] = await Promise.all([
    checkCompanyEligibility(companyId),
    prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { countryCode: true },
    }),
  ])
  const jobMarket = requireJobMarket(job)

  const workers = await Promise.all(workerUserIds.map(async workerUserId => {
    const result = await checkCrewCandidateEligibility(companyId, workerUserId, jobId)
    // Crew operations need an approved photo for *every* person who will
    // enter the customer's premises. The booking's single-worker optional
    // photo flag must not make a multi-person roster appear identity-ready.
    const photo = await prisma.providerIdentity.findFirst({
      where: {
        currentUserId: workerUserId,
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED',
        verifiedPhotoUrl: { not: null },
      },
      select: { id: true },
    })
    const reasons = [...result.reasons]
    if (!photo) reasons.push('Crew member verified profile photo not approved')
    return {
      workerUserId,
      eligible: reasons.length === 0,
      reasons,
    }
  }))

  const blockers: string[] = []
  if (!companyEligibility.eligible) {
    blockers.push('Company is not eligible to dispatch: ' + companyEligibility.reasons.join('; '))
  }
  if (!companyMarket) {
    blockers.push('Company registration is unavailable')
  } else if (!jobMarket.ok) {
    blockers.push('Booking service address is not in a supported launch market')
  } else if (companyMarket.countryCode.trim().toUpperCase() !== jobMarket.countryCode) {
    blockers.push('Company registered market does not match the booking service market')
  }
  if (workerUserIds.length !== job.workersCount) {
    blockers.push(`Select exactly ${job.workersCount} distinct workers for this booking`)
  }
  if (activeAssignment) {
    blockers.push('Booking already has an active single-worker assignment')
  }
  if (workers.some(worker => !worker.eligible)) {
    blockers.push('One or more crew candidates fail mandatory eligibility checks')
  }

  return {
    previewOnly: true,
    dispatchEnabled: false,
    companyId,
    jobId,
    requiredWorkersCount: job.workersCount,
    selectedWorkersCount: workers.length,
    preflightReady: blockers.length === 0,
    blockers,
    workers,
  }
}
