import crypto from 'crypto'
import type { Prisma } from '@prisma/client'

export type StrongIdentityClaimType =
  | 'NATIONAL_ID_HASH'
  | 'PASSPORT_HASH'
  | 'DRIVERS_LICENSE_HASH'
  | 'COMPANY_REG_HASH'
  | 'BANK_ACCOUNT_HASH'
  | 'VERIFIED_PHONE_HASH'

function getIdentityClaimPepper(): string {
  const pepper = process.env.IDENTITY_CLAIM_PEPPER
  if (!pepper) {
    throw new Error('[SECURITY] IDENTITY_CLAIM_PEPPER env var is required for strong identity claims')
  }
  return pepper
}

export function normalizeStrongIdentifier(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function hashStrongIdentityClaim(
  claimType: StrongIdentityClaimType,
  rawValue: string,
): string {
  const normalized = normalizeStrongIdentifier(rawValue)
  if (normalized.length < 5) {
    throw new Error('STRONG_IDENTITY_CLAIM_TOO_SHORT')
  }

  return crypto
    .createHmac('sha256', getIdentityClaimPepper())
    .update(`maintainex:v1:${claimType}:${normalized}`)
    .digest('hex')
}

export function claimTypeForDocument(docType: string): StrongIdentityClaimType | null {
  if (docType === 'NATIONAL_ID') return 'NATIONAL_ID_HASH'
  if (docType === 'PASSPORT') return 'PASSPORT_HASH'
  if (docType === 'DRIVERS_LICENSE') return 'DRIVERS_LICENSE_HASH'
  return null
}

export async function recordStrongIdentityClaim(
  tx: Prisma.TransactionClient,
  input: {
    providerIdentityId: string
    userId: string
    claimType: StrongIdentityClaimType
    rawValue: string
    source: string
  },
) {
  const claimHash = hashStrongIdentityClaim(input.claimType, input.rawValue)

  const matches = await tx.providerIdentityClaim.findMany({
    where: {
      claimType: input.claimType,
      claimHash,
      status: 'ACTIVE',
      providerIdentityId: { not: input.providerIdentityId },
    },
    include: {
      providerIdentity: {
        select: {
          id: true,
          currentUserId: true,
          standingStatus: true,
          closedAt: true,
          financialAccounts: {
            select: {
              currency: true,
              commissionDue: true,
              status: true,
            },
          },
        },
      },
    },
  })

  await tx.providerIdentityClaim.upsert({
    where: {
      providerIdentityId_claimType_claimHash: {
        providerIdentityId: input.providerIdentityId,
        claimType: input.claimType,
        claimHash,
      },
    },
    create: {
      providerIdentityId: input.providerIdentityId,
      claimType: input.claimType,
      claimHash,
      isStrongIdentifier: true,
      verified: false,
      status: 'ACTIVE',
      source: input.source,
    },
    update: {
      status: 'ACTIVE',
      source: input.source,
    },
  })

  const debtMatches = matches.filter(match =>
    match.providerIdentity.financialAccounts.some(account => account.commissionDue > 0n)
  )
  const closedWithBalance = matches.filter(
    match => match.providerIdentity.standingStatus === 'CLOSED_WITH_BALANCE'
  )
  const highRisk = debtMatches.length > 0 || closedWithBalance.length > 0

  if (matches.length > 0) {
    const signalType = highRisk
      ? 'STRONG_IDENTITY_MATCH_WITH_FINANCIAL_LIABILITY'
      : 'STRONG_IDENTITY_REUSE'
    const severity = highRisk ? 'CRITICAL' : 'HIGH'
    const metadata = {
      claimType: input.claimType,
      matchedProviderIdentityIds: matches.map(match => match.providerIdentityId),
      financialLiabilityMatches: debtMatches.map(match => ({
        providerIdentityId: match.providerIdentityId,
        balances: match.providerIdentity.financialAccounts
          .filter(account => account.commissionDue > 0n)
          .map(account => ({
            currency: account.currency,
            commissionDueMinor: account.commissionDue.toString(),
            status: account.status,
          })),
      })),
    }

    let integritySignal = await tx.providerIntegritySignal.findFirst({
      where: {
        providerIdentityId: input.providerIdentityId,
        signalType,
        signalHash: claimHash,
        status: { in: ['OPEN', 'REVIEWED', 'CONFIRMED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!integritySignal) {
      integritySignal = await tx.providerIntegritySignal.create({
        data: {
          providerIdentityId: input.providerIdentityId,
          userId: input.userId,
          signalType,
          severity,
          signalHash: claimHash,
          source: input.source,
          status: 'OPEN',
          metadata: JSON.stringify(metadata),
        },
      })

      await tx.marketplaceRiskEvent.create({
        data: {
          actorUserId: input.userId,
          eventType: signalType,
          severity,
          metadata: JSON.stringify({
            providerIntegritySignalId: integritySignal.id,
            providerIdentityId: input.providerIdentityId,
            ...metadata,
          }),
        },
      })
    }

    await tx.providerIdentity.update({
      where: { id: input.providerIdentityId },
      data: {
        standingStatus: 'REVIEW_REQUIRED',
      },
    })
  }

  return {
    claimHash,
    duplicateMatch: matches.length > 0,
    highRisk,
    matchedProviderIdentityIds: matches.map(match => match.providerIdentityId),
  }
}
