import type { Prisma } from '@prisma/client'

export type MarketplaceProviderType = 'INDIVIDUAL' | 'COMPANY'

/**
 * Locks the provider records that determine marketplace availability and fails
 * closed if the provider became inactive, restricted, unverified, or otherwise
 * unavailable between quote submission and a later commercial transition.
 *
 * Call this only inside the same database transaction as the state/money claim
 * that depends on provider availability.
 */
export async function lockAndAssertProviderAvailable(
  tx: Prisma.TransactionClient,
  providerType: MarketplaceProviderType,
  providerId: string,
  errorMessage = 'Provider is no longer available',
): Promise<void> {
  if (providerType === 'INDIVIDUAL') {
    const users = await tx.$queryRaw<Array<{
      id: string
      isActive: boolean
      isSuspended: boolean
      isBanned: boolean
      identityStatus: string | null
    }>>`
      SELECT id, "isActive", "isSuspended", "isBanned", "identityStatus"
      FROM "User"
      WHERE id = ${providerId}
      FOR UPDATE
    `
    const user = users[0]
    if (
      !user ||
      !user.isActive ||
      user.isSuspended ||
      user.isBanned ||
      user.identityStatus !== 'VERIFIED'
    ) {
      throw new Error(errorMessage)
    }

    const profiles = await tx.$queryRaw<Array<{
      id: string
      verificationStatus: string
      isVerified: boolean
    }>>`
      SELECT id, "verificationStatus", "isVerified"
      FROM "TaskerProfile"
      WHERE "userId" = ${providerId}
      FOR UPDATE
    `
    const profile = profiles[0]
    if (
      !profile ||
      profile.verificationStatus !== 'VERIFIED' ||
      !profile.isVerified
    ) {
      throw new Error(errorMessage)
    }
    return
  }

  const companies = await tx.$queryRaw<Array<{
    id: string
    userId: string
    verificationStatus: string
    isVerified: boolean
    subscriptionStatus: string
  }>>`
    SELECT id, "userId", "verificationStatus", "isVerified", "subscriptionStatus"
    FROM "CompanyProfile"
    WHERE id = ${providerId}
    FOR UPDATE
  `
  const company = companies[0]
  if (
    !company ||
    company.verificationStatus !== 'VERIFIED' ||
    !company.isVerified ||
    company.subscriptionStatus === 'CANCELLED'
  ) {
    throw new Error(errorMessage)
  }

  const owners = await tx.$queryRaw<Array<{
    id: string
    isActive: boolean
    isSuspended: boolean
    isBanned: boolean
  }>>`
    SELECT id, "isActive", "isSuspended", "isBanned"
    FROM "User"
    WHERE id = ${company.userId}
    FOR UPDATE
  `
  const owner = owners[0]
  if (!owner || !owner.isActive || owner.isSuspended || owner.isBanned) {
    throw new Error(errorMessage)
  }

  const activeOwners = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "TeamMember"
    WHERE "companyId" = ${providerId}
      AND role = 'COMPANY_OWNER'
      AND status = 'ACTIVE'
    LIMIT 1
    FOR UPDATE
  `
  if (activeOwners.length === 0) {
    throw new Error(errorMessage)
  }
}
