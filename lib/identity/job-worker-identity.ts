import type { Prisma } from '@prisma/client'
import { ensureProviderIdentity } from '@/lib/finance/commissions/provider-balance-service'

export type ResolvedJobWorkerIdentity = {
  providerIdentityId: string
  providerType: 'INDIVIDUAL' | 'COMPANY'
  assignedWorkerUserId: string
  displayName: string
  verifiedPhotoUrl: string | null
  identityVerified: boolean
  companyId: string | null
  companyName: string | null
}

function userKycVerified(status: string | null | undefined): boolean {
  return status === 'VERIFIED' || status === 'APPROVED'
}

export async function ensureCompanyWorkerIdentity(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    userId: string
    countryCode?: string | null
  },
) {
  const [company, member, workerUser] = await Promise.all([
    tx.companyProfile.findUnique({
      where: { id: input.companyId },
      select: {
        id: true,
        companyName: true,
        countryCode: true,
      },
    }),
    tx.teamMember.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.userId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
      },
    }),
    tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        identityStatus: true,
        countryCode: true,
      },
    }),
  ])
  if (!company || !member || !workerUser) return null

  const companyIdentity = await ensureProviderIdentity(tx, {
    providerId: company.id,
    providerType: 'COMPANY',
    countryCode: company.countryCode || input.countryCode || 'LK',
  })

  const approvedPersonalIdentity = await tx.providerIdentity.findFirst({
    where: {
      currentUserId: workerUser.id,
      kycStatus: 'VERIFIED',
      verifiedPhotoUrl: { not: null },
      identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      verifiedPhotoUrl: true,
      verifiedAt: true,
    },
  })

  const workerKycStatus = userKycVerified(workerUser.identityStatus)
    ? 'VERIFIED'
    : 'PENDING'

  const identity = await tx.providerIdentity.upsert({
    where: {
      identityType_subjectId: {
        identityType: 'COMPANY_WORKER',
        subjectId: member.id,
      },
    },
    create: {
      identityType: 'COMPANY_WORKER',
      subjectId: member.id,
      currentUserId: workerUser.id,
      parentProviderIdentityId: companyIdentity.id,
      countryCode: company.countryCode || workerUser.countryCode || input.countryCode || 'LK',
      kycStatus: workerKycStatus,
      standingStatus: 'ACTIVE',
      verifiedDisplayName: member.name || workerUser.name,
      verifiedPhotoUrl: approvedPersonalIdentity?.verifiedPhotoUrl || null,
      photoLocked: true,
      verifiedAt: approvedPersonalIdentity?.verifiedAt || null,
    },
    update: {
      currentUserId: workerUser.id,
      parentProviderIdentityId: companyIdentity.id,
      countryCode: company.countryCode || workerUser.countryCode || input.countryCode || 'LK',
      kycStatus: workerKycStatus,
      verifiedDisplayName: member.name || workerUser.name,
      ...(approvedPersonalIdentity?.verifiedPhotoUrl
        ? {
            verifiedPhotoUrl: approvedPersonalIdentity.verifiedPhotoUrl,
            verifiedAt: approvedPersonalIdentity.verifiedAt,
          }
        : {}),
      photoLocked: true,
    },
  })

  return {
    identity,
    member,
    workerUser,
    company,
  }
}

export async function resolveJobWorkerIdentity(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<ResolvedJobWorkerIdentity | null> {
  const job = await tx.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, countryCode: true },
  })
  if (!job) return null

  const quote = await tx.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!quote) return null

  if (quote.providerType === 'INDIVIDUAL') {
    const tasker = await tx.taskerProfile.findUnique({
      where: { userId: quote.providerId },
      select: {
        id: true,
        userId: true,
        countryCode: true,
        isVerified: true,
        verificationStatus: true,
        user: {
          select: {
            name: true,
            identityStatus: true,
          },
        },
      },
    })
    if (!tasker) return null

    const identity = await ensureProviderIdentity(tx, {
      providerId: tasker.userId,
      providerType: 'INDIVIDUAL',
      countryCode: tasker.countryCode || job.countryCode || 'LK',
    })

    return {
      providerIdentityId: identity.id,
      providerType: 'INDIVIDUAL',
      assignedWorkerUserId: tasker.userId,
      displayName: identity.verifiedDisplayName || tasker.user.name,
      verifiedPhotoUrl: identity.verifiedPhotoUrl || null,
      identityVerified:
        userKycVerified(tasker.user.identityStatus) &&
        tasker.isVerified &&
        tasker.verificationStatus === 'VERIFIED' &&
        identity.kycStatus === 'VERIFIED' &&
        Boolean(identity.verifiedPhotoUrl),
      companyId: null,
      companyName: null,
    }
  }

  if (quote.providerType !== 'COMPANY') return null

  const assignment = await tx.companyJobAssignment.findFirst({
    where: {
      jobId,
      companyId: quote.providerId,
      status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
    },
    orderBy: { assignedAt: 'desc' },
    select: {
      workerUserId: true,
    },
  })
  if (!assignment) return null

  const resolved = await ensureCompanyWorkerIdentity(tx, {
    companyId: quote.providerId,
    userId: assignment.workerUserId,
    countryCode: job.countryCode || 'LK',
  })
  if (!resolved) return null

  const { identity, member, workerUser, company } = resolved

  return {
    providerIdentityId: identity.id,
    providerType: 'COMPANY',
    assignedWorkerUserId: workerUser.id,
    displayName: identity.verifiedDisplayName || member.name || workerUser.name,
    verifiedPhotoUrl: identity.verifiedPhotoUrl || null,
    identityVerified:
      userKycVerified(workerUser.identityStatus) &&
      identity.kycStatus === 'VERIFIED' &&
      Boolean(identity.verifiedPhotoUrl),
    companyId: company.id,
    companyName: company.companyName,
  }
}
